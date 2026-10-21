"use client";

const PAGE_META = {
  alerts: { title: "Alert queue", sub: "Events flagged by the AI risk-scoring engine, ranked by severity" },
  mycases: { title: "My cases", sub: "Incidents assigned to you — work the remediation playbook to resolve each one" },
  incidents: { title: "Incidents", sub: "Related alerts on the same endpoint, correlated into a single case" },
  endpoints: { title: "Endpoints", sub: "All monitored hosts and their current alert status" },
  network: { title: "Network traffic", sub: "Firewall and connection-level events flagged by the AI engine" },
  risk: { title: "Risk analytics", sub: "Attack breakdown, score distribution and model performance" },
  reports: { title: "Reports", sub: "Generate and review shift and incident summaries" },
  admin: { title: "Administration", sub: "Manage users, endpoints and system configuration" },
};

const ROLE_LABELS = { analyst: "Security Analyst", admin: "System Administrator", manager: "Security Manager" };

function initials(name) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "AN";
}

export default function Topbar({ activePage, user, onSignOut }) {
  const meta = PAGE_META[activePage];
  return (
    <div className="topbar">
      <div>
        <h1>{meta.title}</h1>
        <div className="topbar-sub">{meta.sub}</div>
      </div>
      <div
        className="profile-pill"
        style={{ cursor: "pointer" }}
        title="Click to sign out"
        onClick={onSignOut}
      >
        <div className="avatar">{initials(user.name)}</div>
        <div className="who">
          <b>{user.name}</b>
          <span>{ROLE_LABELS[user.role] || "Security Analyst"}</span>
        </div>
        <span style={{ fontSize: 10, color: "var(--text-dim)", marginLeft: 2 }}>▾</span>
      </div>
    </div>
  );
}
