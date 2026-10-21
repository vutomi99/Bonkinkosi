"use client";
import { useEffect, useState } from "react";

const ROLE_LABELS = { analyst: "Security Analyst", admin: "System Administrator", manager: "Security Manager" };
const ROLE_OPTIONS = ["analyst", "admin", "manager"];

async function jsonFetch(url, opts) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request to ${url} failed`);
  return data;
}

export default function AdminPage({ endpoints, pushToast, onEndpointsChanged }) {
  const [users, setUsers] = useState([]);
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "analyst" });
  const [creating, setCreating] = useState(false);

  async function loadUsers() {
    try {
      const { users } = await jsonFetch("/api/users");
      setUsers(users);
    } catch (err) {
      pushToast({ title: "✕ Could not load users", body: String(err.message || err) });
    }
  }

  useEffect(() => {
    loadUsers();
    jsonFetch("/api/admin/config")
      .then((d) => setConfig(d.config))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createUser(e) {
    e.preventDefault();
    setCreating(true);
    try {
      await jsonFetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      pushToast({ title: "✓ User created", body: `${form.email} (${ROLE_LABELS[form.role]})` });
      setForm({ name: "", email: "", password: "", role: "analyst" });
      loadUsers();
    } catch (err) {
      pushToast({ title: "✕ Could not create user", body: String(err.message || err) });
    } finally {
      setCreating(false);
    }
  }

  async function changeRole(user, role) {
    try {
      await jsonFetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      pushToast({ title: "✓ Role updated", body: `${user.email} → ${ROLE_LABELS[role]}` });
      loadUsers();
    } catch (err) {
      pushToast({ title: "✕ Could not update role", body: String(err.message || err) });
    }
  }

  async function deleteEndpoint(code) {
    if (!confirm(`Delete endpoint ${code}? Only endpoints with no alerts can be removed.`)) return;
    try {
      await jsonFetch(`/api/endpoints/${encodeURIComponent(code)}`, { method: "DELETE" });
      pushToast({ title: "✓ Endpoint removed", body: code });
      onEndpointsChanged?.();
    } catch (err) {
      pushToast({ title: "✕ Could not delete endpoint", body: String(err.message || err) });
    }
  }

  const cfgRow = (label, ok, detail) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: ok ? "var(--success)" : "var(--text-dim)" }}>
        {detail ?? (ok ? "Enabled" : "Not configured")}
      </span>
    </div>
  );

  return (
    <>
      {/* ---- Users ---- */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <h2>User accounts ({users.length})</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td style={{ fontWeight: 600 }}>{u.name}</td>
                <td className="mono">{u.email}</td>
                <td>
                  <select value={u.role} onChange={(e) => changeRole(u, e.target.value)} style={{ padding: "4px 8px" }}>
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </td>
                <td style={{ color: "var(--text-dim)" }}>{new Date(u.createdAt).toLocaleDateString("en-GB")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---- Create user ---- */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <h2>Create user</h2>
        </div>
        <form onSubmit={createUser} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxWidth: 620 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Display name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Doe" />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@company.com" />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Password (min 6)</label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Role</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" type="submit" disabled={creating} style={{ gridColumn: "1 / -1", width: "auto", justifySelf: "start", padding: "8px 16px" }}>
            {creating ? "Creating…" : "Create user"}
          </button>
        </form>
      </div>

      {/* ---- Endpoints ---- */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <h2>Monitored endpoints ({endpoints.length})</h2>
        </div>
        {endpoints.length === 0 ? (
          <div className="empty-state">No endpoints registered yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Endpoint</th>
                <th>Open alerts</th>
                <th>Highest risk</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map((e) => (
                <tr key={e.code}>
                  <td className="mono" style={{ fontWeight: 600 }}>{e.code}</td>
                  <td>{e.openAlerts}</td>
                  <td>{e.maxRisk ? e.maxRisk.toFixed(1) : "—"}</td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      className="btn"
                      style={{ width: "auto", marginTop: 0, padding: "4px 10px", fontSize: 12, background: "transparent", color: e.hasActivity ? "var(--text-dim)" : "var(--critical)", border: "1px solid var(--border)", cursor: e.hasActivity ? "not-allowed" : "pointer" }}
                      disabled={e.hasActivity}
                      title={e.hasActivity ? "Has recorded activity — cannot delete" : "Delete endpoint"}
                      onClick={() => deleteEndpoint(e.code)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ---- System configuration ---- */}
      <div className="panel">
        <div className="panel-head">
          <h2>System configuration</h2>
        </div>
        {config ? (
          <div style={{ maxWidth: 520 }}>
            {cfgRow("Database", true, config.databaseProvider)}
            {cfgRow("AI risk engine", config.aiEnabled, config.aiEnabled ? config.aiModel : "Rule-based fallback")}
            {cfgRow("Live simulator", config.simulationEnabled)}
            {cfgRow("Email (SMTP)", config.smtpConfigured, config.smtpConfigured ? "Enabled" : "Simulated (logged to console)")}
            {cfgRow("Agent ingestion key", config.ingestConfigured)}
          </div>
        ) : (
          <div className="empty-state">Loading configuration…</div>
        )}
        <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginTop: 10 }}>
          Configuration is set in the server&apos;s <span className="mono">.env.local</span> file and shown here read-only.
        </div>
      </div>
    </>
  );
}
