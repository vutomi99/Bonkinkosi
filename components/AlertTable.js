"use client";
import { ATTACK_META, riskColor, timeAgo, isFresh } from "@/lib/simulation";

export default function AlertTable({ rows, onSelect, emptyMessage }) {
  if (!rows.length) {
    return <div className="empty-state">{emptyMessage || "No alerts in this view."}</div>;
  }
  return (
    <table>
      <thead>
        <tr>
          <th>Event</th>
          <th>Endpoint</th>
          <th>Attack type</th>
          <th>Risk score</th>
          <th>Status</th>
          <th>Assigned to</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((a) => (
          <tr key={a.id} className="clickable-row" onClick={() => onSelect(a.id)}>
            <td>
              <div className="mono" style={{ fontWeight: 600 }}>
                {isFresh(a.createdAt) && <span className="fresh-dot"></span>}
                {a.eventId}
                {a.source === "live-agent" && <span className="source-badge live">Live</span>}
                {a.incidentId && <span className="incident-badge">Incident</span>}
              </div>
              <div style={{ color: "var(--text-dim)", fontSize: 11, marginTop: 2 }}>
                {timeAgo(a.createdAt)}
              </div>
            </td>
            <td className="mono">{a.endpoint.code}</td>
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
            <td>
              {a.assignedAnalyst ? (
                a.assignedAnalyst.name
              ) : (
                <span style={{ color: "var(--text-dim)" }}>Unassigned</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
