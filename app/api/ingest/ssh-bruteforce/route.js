import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ALERT_THRESHOLD,
  AUTO_RESPONSE_THRESHOLD,
  SEVERE_EMAIL_THRESHOLD,
  scoreRealBruteForce,
} from "@/lib/simulation";
import { reportIncidentEmail } from "@/lib/reportIncident";
import { correlateAlert } from "@/lib/correlate";
import { ALERT_INCLUDE } from "@/lib/alertInclude";

/**
 * Called by agent/ssh_bruteforce_watcher.py running on a real victim VM.
 * This is the one place in the app where a real, externally-observed
 * event (not the synthetic simulator) can create an Alert row - so it's
 * the only route in the app that requires an API key, checked against
 * INGEST_API_KEY in .env.local. If that env var isn't set, the route
 * refuses every request rather than silently accepting unauthenticated
 * writes.
 */
export async function POST(request) {
  const expectedKey = process.env.INGEST_API_KEY;
  if (!expectedKey) {
    return NextResponse.json(
      { error: "INGEST_API_KEY is not configured on the server - see .env.local.example" },
      { status: 503 }
    );
  }
  const providedKey = request.headers.get("x-ingest-key");
  if (providedKey !== expectedKey) {
    return NextResponse.json({ error: "Invalid or missing x-ingest-key header" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { sourceIp, failedLoginCount, windowSeconds } = body || {};
  const endpointCode = typeof body?.endpointCode === "string" ? body.endpointCode.trim() : "";
  if (!endpointCode || !sourceIp || !Number.isFinite(failedLoginCount)) {
    return NextResponse.json(
      { error: "endpointCode, sourceIp, and failedLoginCount are required" },
      { status: 400 }
    );
  }
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(endpointCode)) {
    return NextResponse.json(
      { error: "endpointCode must be 1-64 characters: letters, digits, '.', '_' or '-'" },
      { status: 400 }
    );
  }

  // Endpoints aren't seeded: a host is registered the first time its
  // (authenticated) agent reports in.
  const endpoint = await prisma.endpoint.upsert({
    where: { code: endpointCode },
    update: {},
    create: { code: endpointCode },
  });

  const riskScore = scoreRealBruteForce(failedLoginCount);
  if (riskScore < ALERT_THRESHOLD) {
    // Real, but not severe enough yet to raise a case - acknowledge without creating one.
    return NextResponse.json({ received: true, alertCreated: false, riskScore });
  }

  const autoResponse = riskScore >= AUTO_RESPONSE_THRESHOLD;
  const status = autoResponse ? "Contained" : "New";

  const timelineCreate = [
    {
      text: `Live agent on ${endpointCode} detected ${failedLoginCount} failed SSH logins from ${sourceIp} in the last ${
        windowSeconds || 60
      }s - risk score ${riskScore}/100 (real attack, not simulated).`,
    },
  ];
  if (autoResponse) {
    timelineCreate.push({
      text: `Automated response triggered - endpoint isolated from network automatically (risk >= ${AUTO_RESPONSE_THRESHOLD}, no analyst action required).`,
    });
  }

  let alert = await prisma.alert.create({
    data: {
      eventId: `EVT-AGENT-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      endpointId: endpoint.id,
      attackType: "brute_force",
      riskScore,
      status,
      cpuUsage: 0,
      networkBytes: 0,
      failedLogins: failedLoginCount,
      connectionsPerMin: 0,
      source: "live-agent",
      sourceIp,
      timeline: { create: timelineCreate },
    },
    include: ALERT_INCLUDE,
  });

  alert = await correlateAlert(alert);

  if (riskScore >= SEVERE_EMAIL_THRESHOLD) {
    alert = await reportIncidentEmail(alert, { reporterName: "Aegis SOC (live agent)", auto: true });
  }

  return NextResponse.json({ received: true, alertCreated: true, alert });
}
