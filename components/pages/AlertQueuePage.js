"use client";
import LiveFeedPanel from "@/components/LiveFeedPanel";
import AlertTable from "@/components/AlertTable";
import { STATUSES } from "@/lib/simulation";

export default function AlertQueuePage({
  alerts,
  consoleLines,
  sparkPoints,
  isLive,
  onToggleLive,
  activeTab,
  onTabClick,
  onStatFilter,
  searchQuery,
  onSearchChange,
  filters,
  onSelect,
}) {
  const open = alerts.filter((a) => a.status === "New").length;
  const critical = alerts.filter((a) => a.riskScore >= 90).length;
  const avgRisk = alerts.length
    ? (alerts.reduce((s, a) => s + a.riskScore, 0) / alerts.length).toFixed(1)
    : "0.0";
  const resolved = alerts.filter((a) => a.status === "Resolved").length;

  const q = searchQuery.trim().toLowerCase();
  const rows = alerts
    .filter((a) => activeTab === "All" || a.status === activeTab)
    .filter((a) => !filters.endpoint || a.endpoint.code === filters.endpoint)
    .filter((a) => !filters.attack || a.attackType === filters.attack)
    .filter((a) => filters.minRisk == null || a.riskScore >= filters.minRisk)
    .filter(
      (a) =>
        !q ||
        a.eventId.toLowerCase().includes(q) ||
        a.endpoint.code.toLowerCase().includes(q) ||
        a.status.toLowerCase().includes(q)
    )
    .sort((a, b) => b.riskScore - a.riskScore);

  return (
    <>
      <LiveFeedPanel
        consoleLines={consoleLines}
        sparkPoints={sparkPoints}
        isLive={isLive}
        onToggle={onToggleLive}
      />

      <div className="stat-row">
        <div className="stat-card clickable-row" onClick={() => onStatFilter({ tab: "New" })}>
          <div className="label">Open alerts (New)</div>
          <div className="value critical">{open}</div>
        </div>
        <div className="stat-card clickable-row" onClick={() => onStatFilter({ minRisk: 90 })}>
          <div className="label">Critical (risk ≥ 90)</div>
          <div className="value warn">{critical}</div>
        </div>
        <div className="stat-card">
          <div className="label">Average risk score</div>
          <div className="value">{avgRisk}</div>
        </div>
        <div className="stat-card clickable-row" onClick={() => onStatFilter({ tab: "Resolved" })}>
          <div className="label">Resolved this shift</div>
          <div className="value success">{resolved}</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Detected security events</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="text"
              placeholder="Search event, endpoint, status..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              style={{
                width: 220,
                background: "var(--surface-alt)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                borderRadius: 6,
                padding: "6px 10px",
                fontSize: 12,
                fontFamily: "inherit",
                outline: "none",
              }}
            />
            <div className="tabs">
              {["All", ...STATUSES].map((t) => (
                <div
                  key={t}
                  className={`tab${activeTab === t ? " active" : ""}`}
                  onClick={() => onTabClick(t)}
                >
                  {t}
                </div>
              ))}
            </div>
          </div>
        </div>
        <AlertTable
          rows={rows}
          onSelect={onSelect}
          emptyMessage={
            alerts.length
              ? "No alerts match your search/filter."
              : "No alerts yet \u2014 the live feed is watching for threats. This can take a few ticks."
          }
        />
      </div>
    </>
  );
}
