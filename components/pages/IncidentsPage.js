"use client";
import { useState } from "react";
import { ATTACK_META, riskColor, timeAgo } from "@/lib/simulation";

export default function IncidentsPage({ incidents, onSelectAlert }) {
  const [openId, setOpenId] = useState(null);

  const open = incidents.filter((i) => i.status === "Open").length;
  const totalEvents = incidents.reduce((s, i) => s + i.eventCount, 0);
  const avgEvents = incidents.length ? (totalEvents / incidents.length).toFixed(1) : "0.0";
  const critical = incidents.filter((i) => i.severity >= 90).length;

  return (
    <>
      <div className="stat-row">
        <div className="stat-card">
          <div className="label">Total incidents</div>
          <div className="value">{incidents.length}</div>
        </div>
        <div className="stat-card">
          <div className="label">Open</div>
          <div className="value critical">{open}</div>
        </div>
        <div className="stat-card">
          <div className="label">Critical (severity ≥ 90)</div>
          <div className="value warn">{critical}</div>
        </div>
        <div className="stat-card">
          <div className="label">Avg. events per incident</div>
          <div className="value">{avgEvents}</div>
        </div>
      </div>

      <div className="panel" style={{ background: "transparent", border: "none" }}>
        {!incidents.length ? (
          <div className="panel">
            <div className="empty-state">
              No correlated incidents yet. An incident forms automatically when 2+ real alerts land on the
              same endpoint within a 10-minute window — keep the live feed running, or try a real multi-stage
              attack from the Kali VM (e.g. a port scan followed by a brute-force attempt on the same host).
            </div>
          </div>
        ) : (
          incidents.map((inc) => {
            const isOpen = openId === inc.id;
            return (
              <div className="incident-card" key={inc.id}>
                <div className="incident-card-head" onClick={() => setOpenId(isOpen ? null : inc.id)}>
                  <div className="incident-card-title">
                    <span className={`incident-chevron${isOpen ? " open" : ""}`}>▶</span>
                    <div>
                      <div>
                        <span className="id">{inc.endpoint.code}</span>
                        <span className="incident-badge">{inc.eventCount} correlated events</span>
                      </div>
                      <div className="incident-card-meta">
                        Started {timeAgo(inc.createdAt)} · last activity {timeAgo(inc.updatedAt)}
                      </div>
                    </div>
                  </div>
                  <div className="incident-card-right">
                    <span className="risk-badge">
                      <span className="risk-dot" style={{ background: riskColor(inc.severity) }}></span>
                      {inc.severity.toFixed(1)}
                    </span>
                    <span className={`status-badge status-${inc.status === "Open" ? "New" : "Resolved"}`}>
                      {inc.status}
                    </span>
                  </div>
                </div>
                {isOpen && (
                  <div className="incident-card-body">
                    <table>
                      <thead>
                        <tr>
                          <th>Event</th>
                          <th>Attack type</th>
                          <th>Risk score</th>
                          <th>Status</th>
                          <th>Detected</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inc.alerts.map((a) => (
                          <tr key={a.id} className="clickable-row" onClick={() => onSelectAlert(a.id)}>
                            <td className="mono" style={{ fontWeight: 600 }}>
                              {a.eventId}
                            </td>
                            <td>{ATTACK_META[a.attackType].label}</td>
                            <td>
                              <span className="risk-badge">
                                <span className="risk-dot" style={{ background: riskColor(a.riskScore) }}></span>
                                {a.riskScore.toFixed(1)}
                              </span>
                            </td>
                            <td>
                              <span className={`status-badge status-${a.status}`}>{a.status}</span>
                            </td>
                            <td style={{ color: "var(--text-dim)" }}>{timeAgo(a.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
