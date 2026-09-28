// lib/mailer.js
//
// Wraps Nodemailer (Node's standard library for sending email) so the API
// route stays thin. If SMTP env vars aren't configured, sendIncidentEmail()
// falls back to logging the email to the server console and returning
// { simulated: true } instead of throwing - so the reporting flow always
// completes in the UI, even before real SMTP credentials are wired up.

import nodemailer from "nodemailer";
import { ATTACK_META } from "@/lib/simulation";

/** Converts a Prisma Alert row (with endpoint + assignedAnalyst included)
 * into the flat shape buildIncidentEmail() expects. */
export function alertForEmail(alert) {
  const meta = ATTACK_META[alert.attackType];
  return {
    id: alert.eventId,
    endpoint: alert.endpoint.code,
    attackLabel: meta.label,
    risk: alert.riskScore,
    status: alert.status,
    assigned: alert.assignedAnalyst?.name || "Unassigned",
    indicators: meta.indicators({
      cpuUsage: alert.cpuUsage,
      networkBytes: alert.networkBytes,
      failedLogins: alert.failedLogins,
      connectionsPerMin: alert.connectionsPerMin,
      endpointCode: alert.endpoint.code,
    }),
  };
}

function isConfigured() {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
  );
}

let cachedTransporter = null;
function getTransporter() {
  if (!isConfigured()) return null;
  if (cachedTransporter) return cachedTransporter;
  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return cachedTransporter;
}

function riskLabel(risk) {
  if (risk >= 95) return "CRITICAL - automated response triggered";
  if (risk >= 90) return "CRITICAL";
  if (risk >= 70) return "HIGH";
  return "MEDIUM";
}

function buildIncidentEmail(alert, reporter) {
  const subject = `[Aegis SOC] ${riskLabel(alert.risk)} incident on ${alert.endpoint} - risk ${alert.risk}`;

  const text = [
    `A security incident has been reported from the Aegis SOC Console.`,
    ``,
    `Event ID:        ${alert.id}`,
    `Endpoint:        ${alert.endpoint}`,
    `Attack type:     ${alert.attackLabel}`,
    `Risk score:      ${alert.risk} / 100 (${riskLabel(alert.risk)})`,
    `Current status:  ${alert.status}`,
    `Assigned to:     ${alert.assigned}`,
    ``,
    `Reported by:     ${reporter?.name || "Unknown analyst"} <${reporter?.email || "n/a"}>`,
    `Reported at:     ${new Date().toLocaleString()}`,
    ``,
    `Indicators:`,
    ...(alert.indicators || []).map((i) => `  - ${i}`),
    ``,
    `This is an automated message from the Aegis SOC Console demo.`,
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif; max-width:560px; margin:0 auto;">
      <h2 style="margin-bottom:4px;">Security incident reported</h2>
      <p style="color:#555; margin-top:0;">Aegis SOC Console</p>
      <table style="border-collapse:collapse; width:100%; font-size:14px;">
        ${[
          ["Event ID", alert.id],
          ["Endpoint", alert.endpoint],
          ["Attack type", alert.attackLabel],
          ["Risk score", `${alert.risk} / 100 (${riskLabel(alert.risk)})`],
          ["Current status", alert.status],
          ["Assigned to", alert.assigned],
          ["Reported by", `${reporter?.name || "Unknown analyst"} (${reporter?.email || "n/a"})`],
          ["Reported at", new Date().toLocaleString()],
        ]
          .map(
            ([k, v]) =>
              `<tr><td style="padding:6px 10px; color:#777; border-bottom:1px solid #eee;">${k}</td><td style="padding:6px 10px; font-weight:600; border-bottom:1px solid #eee;">${v}</td></tr>`
          )
          .join("")}
      </table>
      ${
        alert.indicators?.length
          ? `<h3 style="margin-bottom:4px;">Indicators</h3><ul>${alert.indicators
              .map((i) => `<li>${i}</li>`)
              .join("")}</ul>`
          : ""
      }
      <p style="color:#999; font-size:12px; margin-top:24px;">This is an automated message from the Aegis SOC Console demo.</p>
    </div>
  `;

  return { subject, text, html };
}

export async function sendIncidentEmail(alert, reporter) {
  const { subject, text, html } = buildIncidentEmail(alert, reporter);
  const transporter = getTransporter();

  if (!transporter) {
    // No SMTP credentials configured - simulate so the demo still works.
    console.log("=== [SIMULATED EMAIL - set SMTP_* in .env.local to send for real] ===");
    console.log("To:", process.env.ALERT_EMAIL_TO || "(ALERT_EMAIL_TO not set)");
    console.log("Subject:", subject);
    console.log(text);
    console.log("=======================================================================");
    return { simulated: true, subject };
  }

  const info = await transporter.sendMail({
    from: process.env.ALERT_EMAIL_FROM || process.env.SMTP_USER,
    to: process.env.ALERT_EMAIL_TO || process.env.SMTP_USER,
    subject,
    text,
    html,
  });

  return { simulated: false, subject, messageId: info.messageId };
}
