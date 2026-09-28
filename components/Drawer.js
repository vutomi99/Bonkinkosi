"use client";
import { useState } from "react";
import { STATUSES, ATTACK_META, timeAgo } from "@/lib/simulation";

export default function Drawer({ alert, analysts, onClose, onAdvanceStatus, onAssign, onAddNote, onSendEmail }) {
  const [note, setNote] = useState("");
  const active = Boolean(alert);

  return (
    <>
      <div id="overlay" className={active ? "active" : ""} onClick={onClose}></div>
      <div id="drawer" className={active ? "active" : ""}>
        {alert && (
          <>
            <div className="drawer-head">
              <div className="top-row">
                <div>
                  <div className="drawer-id mono">
                    {alert.eventId}
                    {alert.source === "live-agent" ? (
                      <span className="source-badge live">Live attack</span>
                    ) : (
                      <span className="source-badge sim">Simulated</span>
                    )}
                    {alert.incident && (
                      <span className="incident-badge">
                        Part of incident {"\u00b7"} {alert.incident._count.alerts} events
                      </span>
                    )}
                  </div>
                  <div className="drawer-title">{ATTACK_META[alert.attackType].label}</div>
                </div>
                <div className="drawer-close" onClick={onClose}>
                  &times;
                </div>
              </div>
            </div>
            <div className="drawer-body">
              <div className="kv-grid">
                <div className="kv">
                  <div className="k">Endpoint</div>
                  <div className="v">{alert.endpoint.code}</div>
                </div>
                <div className="kv">
                  <div className="k">Risk score</div>
                  <div className="v">{alert.riskScore.toFixed(1)} / 100</div>
                </div>
                <div className="kv">
                  <div className="k">Detected</div>
                  <div className="v">{timeAgo(alert.createdAt)}</div>
                </div>
                <div className="kv">
                  <div className="k">{alert.sourceIp ? "Source IP" : "Confidence"}</div>
                  <div className="v">
                    {alert.sourceIp || (alert.riskScore >= 90 ? "High" : alert.riskScore >= 75 ? "Medium" : "Low")}
                  </div>
                </div>
              </div>

              <div className="section-label">Case status</div>
              <div className="stepper">
                {STATUSES.map((s, i) => {
                  const stepIdx = STATUSES.indexOf(alert.status);
                  const done = i <= stepIdx;
                  return (
                    <div className="step" key={s} onClick={() => onAdvanceStatus(s)}>
                      {i > 0 && <div className={`line${done ? " done" : ""}`}></div>}
                      <div className={`circle${done ? " done" : ""}`}>{i < stepIdx ? "\u2713" : i + 1}</div>
                      <div className={`lbl${done ? " done" : ""}`}>{s}</div>
                    </div>
                  );
                })}
              </div>

              <div className="section-label">Report this incident</div>
              <button
                className="email-btn"
                disabled={alert.emailStatus === "sending"}
                onClick={onSendEmail}
              >
                {alert.emailStatus === "sending" ? "Sending\u2026" : "\ud83d\udce7 Send incident report email"}
              </button>
              {alert.emailStatus === "sent" && (
                <div className="email-status sent">✓ Email sent to the SOC distribution list.</div>
              )}
              {alert.emailStatus === "simulated" && (
                <div className="email-status sim">
                  ✓ Simulated (no SMTP_* configured in .env.local — logged to server console instead).
                </div>
              )}
              {alert.emailStatus === "failed" && (
                <div className="email-status" style={{ color: "var(--critical)" }}>
                  ✕ Failed to send — check server logs / SMTP settings.
                </div>
              )}

              <div className="section-label">AI-detected indicators</div>
              <div style={{ marginBottom: 22 }}>
                {ATTACK_META[alert.attackType]
                  .indicators({
                    cpuUsage: alert.cpuUsage,
                    networkBytes: alert.networkBytes,
                    failedLogins: alert.failedLogins,
                    connectionsPerMin: alert.connectionsPerMin,
                    endpointCode: alert.endpoint.code,
                  })
                  .map((ind, i) => (
                    <div className="indicator-row" key={i}>
                      <span className="mono">{ind}</span>
                    </div>
                  ))}
              </div>

              <div className="section-label">Assigned analyst</div>
              <select
                style={{ marginBottom: 22 }}
                value={alert.assignedAnalystId || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  const found = analysts.find((a) => a.id === val);
                  onAssign(val || null, found ? found.name : "Unassigned");
                }}
              >
                <option value="">Unassigned</option>
                {analysts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>

              <div className="section-label">Add investigation note</div>
              <textarea
                placeholder="e.g. Confirmed with endpoint owner, isolating host from network..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <button
                className="btn btn-primary"
                style={{ marginTop: 0, marginBottom: 22 }}
                onClick={() => {
                  if (!note.trim()) return;
                  onAddNote(note.trim());
                  setNote("");
                }}
              >
                Add note to timeline
              </button>

              <div className="section-label">Timeline</div>
              <div className="timeline">
                {[...alert.timeline].reverse().map((t) => (
                  <div className="tl-item" key={t.id}>
                    <div className="tl-dot"></div>
                    <div className="tl-line"></div>
                    <div className="tl-content">
                      <div className="tl-text">{t.text}</div>
                      <div className="tl-time">{timeAgo(t.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
