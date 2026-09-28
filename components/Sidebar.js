"use client";

const NAV_ITEMS = [
  { key: "alerts", label: "Alert queue" },
  { key: "incidents", label: "Incidents" },
  { key: "endpoints", label: "Endpoints" },
  { key: "network", label: "Network traffic" },
  { key: "risk", label: "Risk analytics" },
  { key: "reports", label: "Reports" },
];

export default function Sidebar({ activePage, onNavigate }) {
  return (
    <div className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">Æ</div>
        <div className="login-brand-text">
          <b>Aegis SOC</b>
          <span>Console v0.9 &middot; Next.js</span>
        </div>
      </div>
      {NAV_ITEMS.map((item) => (
        <div
          key={item.key}
          className={`nav-item${activePage === item.key ? " active" : ""}`}
          onClick={() => onNavigate(item.key)}
        >
          <span className="nav-dot"></span> {item.label}
        </div>
      ))}
      <div className="sidebar-foot">
        AI detection engine
        <br />
        <span className="mono" style={{ color: "var(--success)" }}>
          ● online &middot; 0.04ms avg
        </span>
      </div>
    </div>
  );
}
