import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ALL_ENDPOINT_CODES,
  ALERT_THRESHOLD,
  AUTO_RESPONSE_THRESHOLD,
  SEVERE_EMAIL_THRESHOLD,
  generateLiveEvent,
  pick,
} from "@/lib/simulation";
import { reportIncidentEmail } from "@/lib/reportIncident";
import { correlateAlert } from "@/lib/correlate";
import { ALERT_INCLUDE } from "@/lib/alertInclude";
import { getCurrentAnalyst, unauthorized, forbidden, canRespond } from "@/lib/auth";
import { aiAssessEvent } from "@/lib/aiScoring";

export async function POST() {
  const me = await getCurrentAnalyst();
  if (!me) return unauthorized();
  if (!canRespond(me.role)) return forbidden("Security Managers have read-only access.");
  // The simulator fabricates random events and turns high-risk ones into
  // Alert rows. Off unless explicitly enabled, so a console with no real
  // agents attached stays empty instead of filling with synthetic incidents.
  if (process.env.NEXT_PUBLIC_ENABLE_SIMULATION !== "true") {
    return NextResponse.json(
      { error: "Simulation is disabled (set NEXT_PUBLIC_ENABLE_SIMULATION=true to enable)" },
      { status: 403 }
    );
  }

  const endpointCode = pick(ALL_ENDPOINT_CODES);
  const event = generateLiveEvent(endpointCode);

  // AI risk scoring for suspected-attack events (benign traffic keeps its
  // cheap heuristic score, so we don't call the model on every tick).
  let assessment = null;
  if (event.attackType) {
    assessment = await aiAssessEvent({ ...event }, event.riskScore);
    event.riskScore = assessment.riskScore;
  }

  const crossedThreshold = Boolean(event.attackType) && event.riskScore >= ALERT_THRESHOLD;
  if (!crossedThreshold) {
    return NextResponse.json({ event, alertCreated: false });
  }

  const endpoint = await prisma.endpoint.upsert({
    where: { code: endpointCode },
    update: {},
    create: { code: endpointCode },
  });

  const autoResponse = event.riskScore >= AUTO_RESPONSE_THRESHOLD;
  const status = autoResponse ? "Contained" : "New";

  const timelineCreate = [
    {
      text:
        assessment?.scoredBy === "ai"
          ? `AI risk engine (${assessment.model}) scored this event ${event.riskScore}/100: ${assessment.rationale}`
          : `AI engine flagged this event - risk score ${event.riskScore}/100.`,
    },
  ];
  if (autoResponse) {
    timelineCreate.push({
      text: `Automated response triggered - endpoint isolated from network automatically (risk >= ${AUTO_RESPONSE_THRESHOLD}, no analyst action required).`,
    });
  }

  let alert = await prisma.alert.create({
    data: {
      eventId: event.eventId,
      endpointId: endpoint.id,
      attackType: event.attackType,
      riskScore: event.riskScore,
      status,
      cpuUsage: event.cpuUsage,
      networkBytes: event.networkBytes,
      failedLogins: event.failedLogins,
      connectionsPerMin: event.connectionsPerMin,
      source: "simulated",
      timeline: { create: timelineCreate },
    },
    include: ALERT_INCLUDE,
  });

  // FR-09: correlate with any related alerts on the same endpoint within
  // the correlation window before deciding on the email (so a correlated,
  // multi-event incident is fully recorded either way).
  alert = await correlateAlert(alert);

  if (event.riskScore >= SEVERE_EMAIL_THRESHOLD) {
    alert = await reportIncidentEmail(alert, { reporterName: "Aegis SOC (automated)", auto: true });
  }

  return NextResponse.json({ event, alertCreated: true, alert });
}
