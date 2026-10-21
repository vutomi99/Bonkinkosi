"use client";
import { useState } from "react";
import { ATTACK_META, riskColor, timeAgo } from "@/lib/simulation";

// Containment actions tailored to each attack type. The rest of the
// playbook (triage, eradicate/recover, close) is the same for every case.
const CONTAINMENT = {
  brute_force: [
    "Block the source IP at the firewall",
    "Disable or force a reset on the targeted account",
    "Enable account lockout / rate limiting on SSH",
  ],
  port_scan: [
    "Block the scanning source IP",
    "Review which services/ports were probed",
    "Close or firewall unnecessary exposed ports",
  ],
  data_exfiltration: [
    "Isolate the endpoint from the network",
    "Revoke credentials and tokens used by the endpoint",
    "Identify what data left and its destination",
  ],
  malware_cpu_spike: [
    "Isolate the endpoint from the network",
    "Terminate the malicious process",
    "Run a full anti-malware scan",
  ],
};

function playbook(alert) {
  const contain = CONTAINMENT[alert.attackType] || [
    "Isolate the affected endpoint from the network",
    "Block the malicious source",
  ];
  return [
    {
      key: "triage",
      title: "Triage & investigate",
      advanceTo: "Investigating",
      items: [
        "Review the alert details and AI summary",
        `Confirm the activity on ${alert.endpoint.code}${alert.sourceIp ? ` from ${alert.sourceIp}` : ""}`,
        "Confirm this is a true positive (not benign traffic)",
      ],
    },
    { key: "contain", title: "Contain", advanceTo: "Contained", items: contain },
    {
      key: "eradicate",
      title: "Eradicate & recover",
      advanceTo: null, // no distinct status; logged as a note
      items: [
        "Verify there is no persistence or follow-on activity",
        "Restore the endpoint to normal service",
        "Confirm monitoring shows the activity has stopped",
      ],
    },
    {
      key: "close",
      title: "Resolve & document",
      advanceTo: "Resolved",
      items: ["Record the root cause", "Note the remediation actions taken", "Mark the case resolved"],
    },
  ];
}

const STATUS_RANK = { New: 0, Investigating: 1, Contained: 2, Resolved: 3 };

export default function MyCasesPage({ alerts, user, onAction, onOpen }) {
  const [checked, setChecked] = useState({}); // `${id}:${stepKey}:${i}` -> true
  const [eradicated, setEradicated] = useState({}); // id -> true (local only)
  const [busy, setBusy] = useState(null); // id currently submitting
  const [showResolved, setShowResolved] = useState(false);

  const mine = alerts.filter((a) => a.assignedAnalystId === user.analystId);
  const open = mine.filter((a) => a.status !== "Resolved");
  const resolved = mine.filter((a) => a.status === "Resolved");
  const visible = showResolved ? mine : open;

  // Which playbook step is active for an alert, from its persisted status
  // (plus the local "eradicated" flag, which has no status of its own).
  function currentStep(alert) {
    const rank = STATUS_RANK[alert.status];
    if (rank === 0) return 0; // New -> triage
    if (rank === 1) return 1; // Investigating -> contain
    if (rank === 2) return eradicated[alert.id] ? 3 : 2; // Contained -> eradicate, then resolve
    return 4; // Resolved -> all done
  }

  const key = (id, stepKey, i) => `${id}:${stepKey}:${i}`;
  const toggle = (id, stepKey, i) =>
    setChecked((prev) => ({ ...prev, [key(id, stepKey, i)]: !prev[key(id, stepKey, i)] }));

  async function completeStep(alert, step) {
    setBusy(alert.id);
    try {
      const summary = `${step.title} completed by ${user.name}: ${step.items.join("; ")}.`;
      if (step.advanceTo) {
        await onAction(alert.id, { status: step.advanceTo, note: summary });
      } else {
        await onAction(alert.id, { note: summary });
        setEradicated((prev) => ({ ...prev, [alert.id]: true }));
      }
    } catch {
      // onAction surfaces its own error toast; keep the checklist as-is.
    } finally {
      setBusy(null);
    }
  }

  if (mine.length === 0) {
    return (
      <div className="panel">
        <div className="empty-state">
          No incidents are assigned to you. Open a case in the Alert queue and assign it to yourself to start a
          remediation playbook here.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="stat-row">
        <div className="stat-card">
          <div className="label">Assigned to me</div>
          <div className="value">{mine.length}</div>
        </div>
        <div className="stat-card">
          <div className="label">Open</div>
          <div className="value critical">{open.length}</div>
        </div>
        <div className="stat-card">
          <div className="label">Resolved</div>
          <div className="value success">{resolved.length}</div>
        </div>
        <div className="stat-card clickable-row" onClick={() => setShowResolved((v) => !v)}>
          <div className="label">View</div>
          <div className="value" style={{ fontSize: 16 }}>{showResolved ? "All cases" : "Open only"}</div>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="panel">
          <div className="empty-state">No open cases — nice work. Toggle the view card to see resolved cases.</div>
        </div>
      ) : (
        visible.map((alert) => {
          const steps = playbook(alert);
          const stepIdx = currentStep(alert);
          const resolvedCase = alert.status === "Resolved";
          return (
            <div className="panel" key={alert.id} style={{ marginBottom: 16 }}>
              <div className="panel-head" style={{ alignItems: "flex-start" }}>
                <div>
                  <h2 style={{ marginBottom: 4 }}>
                    {ATTACK_META[alert.attackType].label} on {alert.endpoint.code}
                  </h2>
                  <div className="mono" style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {alert.eventId}
                    {alert.sourceIp ? ` · ${alert.sourceIp}` : ""} · detected {timeAgo(alert.createdAt)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span className="risk-badge">
                    <span className="risk-dot" style={{ background: riskColor(alert.riskScore) }}></span>
                    {alert.riskScore.toFixed(1)}
                  </span>
                  <button
                    className="btn"
                    style={{ width: "auto", marginTop: 0, padding: "6px 12px", fontSize: 12, background: "var(--surface-alt)", color: "var(--text)", border: "1px solid var(--border)" }}
                    onClick={() => onOpen(alert.id)}
                  >
                    Open full case
                  </button>
                </div>
              </div>

              {resolvedCase ? (
                <div className="email-status sent" style={{ margin: "4px 0 8px" }}>
                  ✓ This case is resolved. Full history is in the case timeline.
                </div>
              ) : (
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 14 }}>
                  Current phase: <b style={{ color: "var(--text)" }}>{steps[stepIdx]?.title || "Done"}</b> · status{" "}
                  <b style={{ color: "var(--text)" }}>{alert.status}</b>
                </div>
              )}

              {steps.map((step, i) => {
                const state = i < stepIdx ? "done" : i === stepIdx && !resolvedCase ? "active" : "locked";
                const allChecked = step.items.every((_, idx) => checked[key(alert.id, step.key, idx)]);
                return (
                  <div
                    key={step.key}
                    style={{
                      borderLeft: `3px solid ${state === "done" ? "var(--success)" : state === "active" ? "var(--info)" : "var(--border)"}`,
                      padding: "8px 0 8px 14px",
                      marginBottom: 10,
                      opacity: state === "locked" ? 0.5 : 1,
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 6 }}>
                      {state === "done" ? "✓ " : `${i + 1}. `}
                      {step.title}
                      {state === "active" && <span style={{ color: "var(--info)", fontWeight: 500 }}> — in progress</span>}
                    </div>

                    {state === "active" && (
                      <>
                        {step.items.map((item, idx) => (
                          <label
                            key={idx}
                            style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, margin: "4px 0", cursor: "pointer" }}
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(checked[key(alert.id, step.key, idx)])}
                              onChange={() => toggle(alert.id, step.key, idx)}
                              style={{ marginTop: 2 }}
                            />
                            <span>{item}</span>
                          </label>
                        ))}
                        <button
                          className="btn btn-primary"
                          style={{ width: "auto", marginTop: 8, padding: "7px 14px", fontSize: 12.5 }}
                          disabled={!allChecked || busy === alert.id}
                          onClick={() => completeStep(alert, step)}
                        >
                          {busy === alert.id
                            ? "Saving…"
                            : step.advanceTo
                            ? `Complete step → ${step.advanceTo}`
                            : "Complete step"}
                        </button>
                        {!allChecked && (
                          <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginTop: 6 }}>
                            Tick every action above to complete this step.
                          </div>
                        )}
                      </>
                    )}

                    {state === "done" && (
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {step.items.map((item, idx) => (
                          <div key={idx}>✓ {item}</div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })
      )}
    </>
  );
}
