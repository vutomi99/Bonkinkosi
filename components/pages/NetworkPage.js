"use client";
import { ATTACK_META, riskColor } from "@/lib/simulation";

export default function NetworkPage({ alerts, endpointCount, liveEventCount, onSelect }) {
  const netAlerts = alerts
    .filter((a) => a.attackType === "port_scan" || a.attackType === "data_exfiltration")
    .sort((a, b) => b.riskScore - a.riskScore);
  const totalWatched = liveEventCount; // real count of server-side simulation ticks this session
  const exfil = alerts.filter((a) => a.attackType === "data_exfiltration").length;
  const scans = alerts.filter((a) => a.attackType === "port_scan").length;

  return (
    <>
      <div className="stat-row">
        <div className="stat-card">
          <div className="label">Network events analyzed (this session)</div>
          <div className="value">{totalWatched.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="label">Port scans flagged</div>
          <div className="value warn">{scans}</div>
        </div>
        <div className="stat-card">
          <div className="label">Data exfiltration flagged</div>
          <div className="value critical">{exfil}</div>
        </div>
        <div className="stat-card">
          <div className="label">Active endpoints</div>
          <div className="value">{endpointCount}</div>
        </div>
      </div>
      <div className="panel">
        <div className="panel-head">
          <h2>Network-flagged events</h2>
        </div>
        {netAlerts.length ? (
          <table>
            <thead>
              <tr>
                <th>Event</th>
                <th>Endpoint</th>
                <th>Type</th>
                <th>Connections/min</th>
                <th>Data volume</th>
                <th>Risk score</th>
              </tr>
            </thead>
            <tbody>
              {netAlerts.map((a) => (
                <tr key={a.id} className="clickable-row" onClick={() => onSelect(a.id)}>
                  <td className="mono" style={{ fontWeight: 600 }}>
                    {a.eventId}
                  </td>
                  <td className="mono">{a.endpoint.code}</td>
                  <td>{ATTACK_META[a.attackType].label}</td>
                  <td className="mono">{a.connectionsPerMin}</td>
                  <td className="mono">{(a.networkBytes / 1000).toFixed(0)} KB</td>
                  <td>
                    <span className="risk-badge">
                      <span className="risk-dot" style={{ background: riskColor(a.riskScore) }}></span>
                      {a.riskScore.toFixed(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">No network-related alerts yet — keep monitoring live to generate some.</div>
        )}
      </div>
    </>
  );
}
