import { prisma } from "@/lib/prisma";
import { sendIncidentEmail, alertForEmail } from "@/lib/mailer";
import { ALERT_INCLUDE } from "@/lib/alertInclude";
import { aiIncidentSummary } from "@/lib/aiScoring";

/** Sends (or simulates) the incident-report email for an alert that is
 * already loaded with its relations, records the real result on the row,
 * and appends a real timeline entry. Returns the updated alert
 * (with relations) either way - it never throws. */
export async function reportIncidentEmail(alertWithRelations, { reporterName, auto }) {
  const { id } = alertWithRelations;
  await prisma.alert.update({ where: { id }, data: { emailStatus: "sending" } });

  // AI-written incident summary (falls back to a templated line if the AI
  // key is missing or the call fails).
  const summary = await aiIncidentSummary(alertWithRelations);

  try {
    const result = await sendIncidentEmail(alertForEmail(alertWithRelations), { name: reporterName, summary });
    const status = result.simulated ? "simulated" : "sent";
    return await prisma.alert.update({
      where: { id },
      data: {
        emailStatus: status,
        timeline: {
          create: [
            { text: `AI incident summary: ${summary}` },
            {
              text: `${auto ? "Automated severe-incident report" : `Incident report sent by ${reporterName}`} \u2014 email ${
                status === "sent" ? "delivered to the SOC distribution list" : "simulated (no SMTP configured in .env.local)"
              }.`,
            },
          ],
        },
      },
      include: ALERT_INCLUDE,
    });
  } catch (err) {
    console.error("Failed to send incident email:", err);
    return prisma.alert.update({
      where: { id },
      data: { emailStatus: "failed" },
      include: ALERT_INCLUDE,
    });
  }
}
