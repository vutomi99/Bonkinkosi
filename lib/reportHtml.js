// lib/reportHtml.js
//
// Builds a standalone, print-ready HTML security report from live findings.
// Opened in a browser tab; the "Save as PDF" button calls window.print().
import { ATTACK_META } from "@/lib/simulation";

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
const attackLabel = (t) => ATTACK_META[t]?.label || t || "Unknown";
const fmt = (d) => new Date(d).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
function riskColor(r) {
  if (r >= 90) return "#c0392b";
  if (r >= 70) return "#e67e22";
  if (r >= 40) return "#f1c40f";
  return "#2d8f5a";
}

export function buildReportHtml({ generatedBy, generatedAt, summary, alerts, incidents, counts }) {
  const total = alerts.length;
  const critical = alerts.filter((a) => a.riskScore >= 90).length;
  const avgRisk = total ? (alerts.reduce((s, a) => s + a.riskScore, 0) / total).toFixed(1) : "0.0";
  const dateStr = fmt(generatedAt);
  const fileDate = new Date(generatedAt).toISOString().slice(0, 10);

  const metric = (label, value, color) =>
    `<div class="metric"><div class="m-val" style="color:${color || "#1a2b4a"}">${esc(value)}</div><div class="m-lbl">${esc(label)}</div></div>`;

  const findingsRows = alerts
    .map(
      (a, i) => `
      <tr>
        <td>${i + 1}</td>
        <td class="mono">${esc(a.eventId)}</td>
        <td>${esc(a.endpoint.code)}</td>
        <td>${esc(attackLabel(a.attackType))}</td>
        <td><span class="risk" style="background:${riskColor(a.riskScore)}">${esc(a.riskScore)}</span></td>
        <td>${esc(a.status)}</td>
        <td class="mono">${esc(a.sourceIp || "-")}</td>
        <td>${esc(a.assignedAnalyst?.name || "Unassigned")}</td>
        <td>${esc(fmt(a.createdAt))}</td>
      </tr>`
    )
    .join("");

  const incidentsHtml = incidents.length
    ? incidents
        .map(
          (inc) => `
        <div class="incident">
          <h3>Incident on ${esc(inc.endpoint)} <span class="risk" style="background:${riskColor(inc.severity)}">${esc(
            inc.severity
          )}</span> <span class="badge">${esc(inc.status)}</span></h3>
          <p class="muted">${inc.count} correlated event(s) &middot; opened ${esc(fmt(inc.createdAt))}</p>
          <ul>${inc.alerts
            .map((a) => `<li class="mono">${esc(a.eventId)} — ${esc(attackLabel(a.attackType))}, risk ${esc(a.riskScore)}, ${esc(a.status)}</li>`)
            .join("")}</ul>
        </div>`
        )
        .join("")
    : `<p class="muted">No correlated incidents in this period.</p>`;

  const detailsHtml = alerts
    .map(
      (a) => `
      <div class="detail">
        <h4 class="mono">${esc(a.eventId)} — ${esc(attackLabel(a.attackType))} on ${esc(a.endpoint.code)}
          <span class="risk" style="background:${riskColor(a.riskScore)}">${esc(a.riskScore)}</span></h4>
        <p class="muted">Status ${esc(a.status)} &middot; assigned to ${esc(a.assignedAnalyst?.name || "Unassigned")}${
          a.sourceIp ? ` &middot; source ${esc(a.sourceIp)}` : ""
        } &middot; detected ${esc(fmt(a.createdAt))}</p>
        <ul class="timeline">${(a.timeline || [])
          .map((t) => `<li><span class="t-time">${esc(fmt(t.createdAt))}</span> ${esc(t.text)}</li>`)
          .join("")}</ul>
      </div>`
    )
    .join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Security Operations Report — ${esc(fileDate)}</title>
<style>
  :root{ --ink:#1a2b4a; --muted:#667; --line:#e2e6ee; --accent:#2B5FD9; }
  *{ box-sizing:border-box; }
  body{ font-family:Arial, Helvetica, sans-serif; color:var(--ink); margin:0; background:#f4f6fb; }
  .page{ max-width:900px; margin:0 auto; background:#fff; padding:48px 56px; }
  .toolbar{ position:sticky; top:0; background:#0B1220; color:#fff; padding:12px 56px; display:flex; gap:12px; align-items:center; justify-content:space-between; }
  .toolbar button{ background:var(--accent); color:#fff; border:0; padding:8px 16px; border-radius:6px; font-size:14px; cursor:pointer; }
  .toolbar .sub{ font-size:13px; opacity:.8; }
  h1{ font-size:26px; margin:0 0 4px; }
  h2{ font-size:18px; margin:34px 0 12px; border-bottom:2px solid var(--line); padding-bottom:6px; }
  h3{ font-size:15px; margin:16px 0 4px; }
  h4{ font-size:13.5px; margin:14px 0 2px; }
  .head-meta{ color:var(--muted); font-size:13px; margin-bottom:8px; }
  .summary{ background:#f4f7ff; border-left:4px solid var(--accent); padding:14px 16px; border-radius:6px; font-size:14.5px; line-height:1.55; }
  .metrics{ display:flex; gap:14px; flex-wrap:wrap; margin:18px 0 4px; }
  .metric{ flex:1; min-width:120px; border:1px solid var(--line); border-radius:8px; padding:14px; text-align:center; }
  .m-val{ font-size:24px; font-weight:700; }
  .m-lbl{ font-size:12px; color:var(--muted); margin-top:4px; text-transform:uppercase; letter-spacing:.4px; }
  table{ width:100%; border-collapse:collapse; font-size:12.5px; margin-top:8px; }
  th,td{ text-align:left; padding:7px 8px; border-bottom:1px solid var(--line); }
  th{ background:#f7f9fc; font-size:11px; text-transform:uppercase; letter-spacing:.4px; color:var(--muted); }
  .mono{ font-family:"Courier New", monospace; }
  .risk{ color:#fff; padding:2px 7px; border-radius:10px; font-weight:700; font-size:11.5px; }
  .badge{ background:#e2e6ee; color:#333; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:600; }
  .muted{ color:var(--muted); font-size:12.5px; }
  .incident{ border:1px solid var(--line); border-radius:8px; padding:10px 14px; margin-bottom:12px; }
  .incident ul, .timeline{ margin:6px 0 0; padding-left:18px; }
  .incident li{ font-size:12px; margin:2px 0; }
  .detail{ border-top:1px solid var(--line); padding-top:6px; margin-top:14px; }
  .timeline li{ font-size:12px; margin:3px 0; }
  .t-time{ color:var(--muted); }
  footer{ margin-top:40px; padding-top:16px; border-top:1px solid var(--line); color:var(--muted); font-size:11.5px; }
  @media print{ .toolbar{ display:none; } body{ background:#fff; } .page{ padding:0; max-width:none; } }
</style></head>
<body>
  <div class="toolbar">
    <span class="sub">AI-Driven Integrated SOC — report generated ${esc(dateStr)}</span>
    <button onclick="window.print()">Save as PDF / Print</button>
  </div>
  <div class="page">
    <h1>Security Operations Report</h1>
    <div class="head-meta">AI-Driven Integrated SOC &middot; Generated by ${esc(generatedBy)} &middot; ${esc(dateStr)}</div>

    <h2>Executive summary</h2>
    <div class="summary">${esc(summary)}</div>

    <h2>Key metrics</h2>
    <div class="metrics">
      ${metric("Total alerts", total)}
      ${metric("Critical (≥90)", critical, "#c0392b")}
      ${metric("Average risk", avgRisk)}
      ${metric("Open (New)", counts.open, "#c0392b")}
      ${metric("Resolved", counts.resolved, "#2d8f5a")}
    </div>

    <h2>Findings (${total})</h2>
    ${
      total
        ? `<table><thead><tr><th>#</th><th>Event ID</th><th>Endpoint</th><th>Attack type</th><th>Risk</th><th>Status</th><th>Source IP</th><th>Assigned</th><th>Detected</th></tr></thead><tbody>${findingsRows}</tbody></table>`
        : `<p class="muted">No alerts recorded.</p>`
    }

    <h2>Correlated incidents (${incidents.length})</h2>
    ${incidentsHtml}

    <h2>Alert details &amp; timeline</h2>
    ${total ? detailsHtml : `<p class="muted">No alerts to detail.</p>`}

    <footer>
      This report was generated automatically by the AI-Driven Integrated SOC console. Risk scores and
      the executive summary are produced by an LLM risk engine (with a rule-based fallback). Findings
      reflect the database state at ${esc(dateStr)}.
    </footer>
  </div>
</body></html>`;
}
