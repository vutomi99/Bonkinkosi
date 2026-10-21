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

function severityColor(risk) {
  if (risk >= 90) return "#c0392b";
  if (risk >= 70) return "#e67e22";
  return "#d4a017";
}

function buildIncidentEmail(alert, reporter) {
  const subject = `[AI-Driven Integrated SOC] ${riskLabel(alert.risk)} incident on ${alert.endpoint} - risk ${alert.risk}`;

  const text = [
    `A security incident has been reported from the AI-Driven Integrated SOC.`,
    ``,
    ...(reporter?.summary ? [`AI summary: ${reporter.summary}`, ``] : []),
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
    `This is an automated message from the AI-Driven Integrated SOC.`,
  ].join("\n");

  const sev = severityColor(alert.risk);
  const reportedAt = new Date().toLocaleString();
  const row = (k, v) =>
    `<tr>
      <td style="padding:9px 0; color:#6b7280; font-size:13px; border-bottom:1px solid #edf0f5; width:150px; vertical-align:top;">${k}</td>
      <td style="padding:9px 0; color:#1a2b4a; font-size:13px; font-weight:600; border-bottom:1px solid #edf0f5;">${v}</td>
    </tr>`;

  const html = `
  <div style="background:#eef1f7; padding:24px 12px; font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" align="center" style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:10px; overflow:hidden; border:1px solid #e2e6ee;">
      <!-- Header -->
      <tr>
        <td style="background:#0B1220; padding:18px 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:44px; vertical-align:middle;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td width="40" height="40" align="center" valign="middle" style="background:#2B5FD9; border-radius:9px; color:#ffffff; font-size:22px; line-height:40px; font-weight:bold;">&#9678;</td>
                  </tr>
                </table>
              </td>
              <td style="padding-left:12px; vertical-align:middle;">
                <div style="color:#ffffff; font-size:16px; font-weight:bold; line-height:1.2;">AI-Driven Integrated SOC</div>
                <div style="color:#8891AC; font-size:12px; line-height:1.2;">Security Operations Center</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <!-- Severity ribbon -->
      <tr>
        <td style="background:${sev}; padding:11px 24px; color:#ffffff; font-size:13px; font-weight:bold; letter-spacing:0.4px;">
          ${riskLabel(alert.risk).toUpperCase()} &nbsp;&middot;&nbsp; RISK ${alert.risk}/100
        </td>
      </tr>
      <!-- Body -->
      <tr>
        <td style="padding:24px;">
          <h2 style="margin:0 0 4px; color:#1a2b4a; font-size:19px;">Security incident reported</h2>
          <p style="margin:0 0 18px; color:#6b7280; font-size:13px;">Endpoint ${alert.endpoint} &middot; ${alert.attackLabel}</p>
          ${
            reporter?.summary
              ? `<div style="background:#f4f7ff; border-left:4px solid #2B5FD9; padding:12px 14px; border-radius:4px; font-size:14px; color:#333; line-height:1.55; margin-bottom:20px;"><strong style="color:#1a2b4a;">AI summary:</strong> ${reporter.summary}</div>`
              : ""
          }
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            ${row("Event ID", alert.id)}
            ${row("Endpoint", alert.endpoint)}
            ${row("Attack type", alert.attackLabel)}
            ${row("Risk score", `${alert.risk} / 100 (${riskLabel(alert.risk)})`)}
            ${row("Current status", alert.status)}
            ${row("Assigned to", alert.assigned)}
            ${row("Reported by", `${reporter?.name || "Unknown analyst"}`)}
            ${row("Reported at", reportedAt)}
          </table>
          ${
            alert.indicators?.length
              ? `<h3 style="margin:22px 0 8px; color:#1a2b4a; font-size:14px;">Indicators</h3>
                 <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${alert.indicators
                   .map(
                     (i) =>
                       `<tr><td style="padding:4px 0 4px 16px; color:#333; font-size:13px; border-left:3px solid ${sev}; margin-bottom:4px;">${i}</td></tr>`
                   )
                   .join("")}</table>`
              : ""
          }
        </td>
      </tr>
      <!-- Footer -->
      <tr>
        <td style="background:#f7f9fc; padding:16px 24px; border-top:1px solid #e2e6ee;">
          <p style="margin:0; color:#9aa3b5; font-size:11.5px; line-height:1.5;">
            This is an automated message from the AI-Driven Integrated SOC console. Risk scores and the summary are
            produced by an AI risk engine. Do not reply to this email.
          </p>
        </td>
      </tr>
    </table>
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
    replyTo: process.env.SMTP_USER,
    subject,
    text,
    html,
    // Small deliverability nudges for inbox placement.
    headers: {
      "List-Unsubscribe": `<mailto:${process.env.SMTP_USER}?subject=unsubscribe>`,
      "X-Entity-Ref-ID": `soc-${Date.now()}`,
    },
  });

  return { simulated: false, subject, messageId: info.messageId };
}

// Shared header + footer so every email looks like one system.
function emailShell(ribbonColor, ribbonText, innerHtml) {
  return `
  <div style="background:#eef1f7; padding:24px 12px; font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" align="center" style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:10px; overflow:hidden; border:1px solid #e2e6ee;">
      <tr>
        <td style="background:#0B1220; padding:18px 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="width:44px; vertical-align:middle;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td width="40" height="40" align="center" valign="middle" style="background:#2B5FD9; border-radius:9px; color:#ffffff; font-size:22px; line-height:40px; font-weight:bold;">&#9678;</td>
              </tr></table>
            </td>
            <td style="padding-left:12px; vertical-align:middle;">
              <div style="color:#ffffff; font-size:16px; font-weight:bold; line-height:1.2;">AI-Driven Integrated SOC</div>
              <div style="color:#8891AC; font-size:12px; line-height:1.2;">Security Operations Center</div>
            </td>
          </tr></table>
        </td>
      </tr>
      <tr><td style="background:${ribbonColor}; padding:11px 24px; color:#ffffff; font-size:13px; font-weight:bold; letter-spacing:0.4px;">${ribbonText}</td></tr>
      <tr><td style="padding:24px;">${innerHtml}</td></tr>
      <tr><td style="background:#f7f9fc; padding:16px 24px; border-top:1px solid #e2e6ee;">
        <p style="margin:0; color:#9aa3b5; font-size:11.5px; line-height:1.5;">This is an automated message from the AI-Driven Integrated SOC console. Do not reply to this email.</p>
      </td></tr>
    </table>
  </div>`;
}

const detailRow = (k, v) =>
  `<tr>
    <td style="padding:9px 0; color:#6b7280; font-size:13px; border-bottom:1px solid #edf0f5; width:150px; vertical-align:top;">${k}</td>
    <td style="padding:9px 0; color:#1a2b4a; font-size:13px; font-weight:600; border-bottom:1px solid #edf0f5;">${v}</td>
  </tr>`;

/** Notifies an analyst by email that a case has been assigned to them.
 * `alert` is the flat shape from alertForEmail(); `analyst` is {name, email}.
 * Never throws; returns {skipped|simulated|sent}. */
export async function sendAssignmentEmail(alert, analyst) {
  if (!analyst?.email) return { skipped: true, reason: "assignee has no email" };

  const subject = `[AI-Driven Integrated SOC] Case assigned to you: ${alert.attackLabel} on ${alert.endpoint}`;
  const text = [
    `Hi ${analyst.name},`,
    ``,
    `A security case has been assigned to you in the AI-Driven Integrated SOC.`,
    ``,
    `Event ID:    ${alert.id}`,
    `Endpoint:    ${alert.endpoint}`,
    `Attack type: ${alert.attackLabel}`,
    `Risk score:  ${alert.risk} / 100 (${riskLabel(alert.risk)})`,
    `Status:      ${alert.status}`,
    ``,
    `Open the console and work the remediation playbook under "My cases".`,
  ].join("\n");

  const sev = severityColor(alert.risk);
  const inner = `
    <h2 style="margin:0 0 4px; color:#1a2b4a; font-size:19px;">A case has been assigned to you</h2>
    <p style="margin:0 0 18px; color:#6b7280; font-size:13px;">Hi ${analyst.name}, please review and action this case.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${detailRow("Event ID", alert.id)}
      ${detailRow("Endpoint", alert.endpoint)}
      ${detailRow("Attack type", alert.attackLabel)}
      ${detailRow("Risk score", `${alert.risk} / 100 (${riskLabel(alert.risk)})`)}
      ${detailRow("Current status", alert.status)}
    </table>
    <p style="margin:20px 0 0; font-size:13px; color:#333;">Open the console and work the remediation playbook under <strong>My cases</strong>.</p>`;
  const html = emailShell("#2B5FD9", `CASE ASSIGNED TO YOU &nbsp;&middot;&nbsp; RISK ${alert.risk}/100`, inner);

  const transporter = getTransporter();
  if (!transporter) {
    console.log("=== [SIMULATED ASSIGNMENT EMAIL - set SMTP_* in .env.local to send] ===");
    console.log("To:", analyst.email, "| Subject:", subject);
    return { simulated: true };
  }
  const info = await transporter.sendMail({
    from: process.env.ALERT_EMAIL_FROM || process.env.SMTP_USER,
    to: analyst.email,
    replyTo: process.env.SMTP_USER,
    subject,
    text,
    html,
    headers: {
      "List-Unsubscribe": `<mailto:${process.env.SMTP_USER}?subject=unsubscribe>`,
      "X-Entity-Ref-ID": `soc-assign-${Date.now()}`,
    },
  });
  return { sent: true, messageId: info.messageId };
}
