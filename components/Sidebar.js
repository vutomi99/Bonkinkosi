"use client";
import BrandLogo from "@/components/BrandLogo";

// `roles` omitted = visible to everyone. Managers are read-only, so they
// don't get "My cases"; only admins get "Administration".
const NAV_ITEMS = [
  { key: "alerts", label: "Alert queue" },
  { key: "mycases", label: "My cases", roles: ["analyst", "admin"] },
  { key: "incidents", label: "Incidents" },
  { key: "endpoints", label: "Endpoints" },
  { key: "network", label: "Network traffic" },
  { key: "risk", label: "Risk analytics" },
  { key: "reports", label: "Reports" },
  { key: "admin", label: "Administration", roles: ["admin"] },
];

export default function Sidebar({ activePage, onNavigate, role }) {
  const items = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));
  return (
    <div className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark"><BrandLogo /></div>
        <div className="login-brand-text">
          <b>AI-Driven Integrated SOC</b>
          <span>v0.9 &middot; Next.js</span>
        </div>
      </div>
      {items.map((item) => (
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
