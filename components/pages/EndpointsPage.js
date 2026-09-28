"use client";
import { ATTACK_META, riskColor } from "@/lib/simulation";

export default function EndpointsPage({ alerts, endpoints, onDrill }) {
  // Registered endpoints from the DB, plus any code seen on an alert that
  // arrived since the last endpoints refresh.
  const codes = [...new Set([...endpoints.map((e) => e.code), ...alerts.map((a) => a.endpoint.code)])].sort();
  const byEndpoint = {};
  alerts.forEach((a) => {
    const code = a.endpoint.code;
    const e = byEndpoint[code] || { open: 0, maxRisk: 0, last: null };
    if (a.status !== "Resolved") e.open += 1;
    e.maxRisk = Math.max(e.maxRisk, a.riskScore);
    e.last = e.last === null || new Date(a.createdAt) > new Date(e.last.createdAt) ? a : e.last;
    byEndpoint[code] = e;
  });
  const openTotal = alerts.filter((a) => a.status !== "Resolved").length;
  const withActivity = Object.keys(byEndpoint).length;

  return (
    <>
      <div className="stat-row">
        <div className="stat-card">
          <div className="label">Endpoints monitored</div>
          <div className="value">{codes.length}</div>
        </div>
        <div className="stat-card">
          <div className="label">With active alerts</div>
          <div className="value warn">{withActivity}</div>
        </div>
        <div className="stat-card">
          <div className="label">Total open alerts</div>
          <div className="value critical">{openTotal}</div>
        </div>
        <div className="stat-card">
          <div className="label">Clean endpoints</div>
          <div className="value success">{codes.length - withActivity}</div>
        </div>
      </div>
      <div className="panel">
        <div className="panel-head">
          <h2>Monitored endpoints</h2>
        </div>
        {codes.length === 0 ? (
          <div className="empty-state">
            No endpoints yet — a host appears here the first time its agent reports to
            /api/ingest/ssh-bruteforce.
          </div>
        ) : (
        <table>
          <thead>
            <tr>
              <th>Endpoint</th>
              <th>Status</th>
              <th>Open alerts</th>
              <th>Highest risk seen</th>
              <th>Last activity</th>
            </tr>
          </thead>
          <tbody>
            {codes.map((ep) => {
              const e = byEndpoint[ep];
              let statusClass = "",
                statusLabel = "Online";
              if (e && e.open > 0) {
                if (e.maxRisk >= 90) {
                  statusClass = "critical";
                  statusLabel = "Isolated";
                } else {
                  statusClass = "warn";
                  statusLabel = "Investigating";
                }
              }
              return (
                <tr key={ep} className="clickable-row" onClick={() => onDrill(ep)}>
                  <td className="mono" style={{ fontWeight: 600 }}>
                    {ep}
                  </td>
                  <td>
                    <span className={`ep-status ${statusClass}`}>
                      <i></i> {statusLabel}
                    </span>
                  </td>
                  <td>{e ? e.open : 0}</td>
                  <td>
                    {e ? (
                      <span className="risk-badge">
                        <span className="risk-dot" style={{ background: riskColor(e.maxRisk) }}></span>
                        {e.maxRisk.toFixed(1)}
                      </span>
                    ) : (
                      <span style={{ color: "var(--text-dim)" }}>—</span>
                    )}
                  </td>
                  <td style={{ color: "var(--text-dim)" }}>
                    {e ? ATTACK_META[e.last.attackType].label : "No flagged activity"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        )}
      </div>
    </>
  );
}
