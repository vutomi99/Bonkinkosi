"use client";
import { useEffect, useState } from "react";
import { ATTACK_META, ALERT_THRESHOLD } from "@/lib/simulation";

import LoginScreen from "@/components/LoginScreen";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import FilterChips from "@/components/FilterChips";
import Drawer from "@/components/Drawer";
import Toasts from "@/components/Toasts";
import AlertQueuePage from "@/components/pages/AlertQueuePage";
import IncidentsPage from "@/components/pages/IncidentsPage";
import EndpointsPage from "@/components/pages/EndpointsPage";
import NetworkPage from "@/components/pages/NetworkPage";
import RiskPage from "@/components/pages/RiskPage";
import ReportsPage from "@/components/pages/ReportsPage";

// Synthetic event generator (/api/simulate/tick). Off by default - only real
// alerts from agents (/api/ingest/*) appear unless this is set in .env.
const SIMULATION_ENABLED = process.env.NEXT_PUBLIC_ENABLE_SIMULATION === "true";

async function jsonFetch(url, opts) {
  const res = await fetch(url, opts);
  const data = await res.json();
  if (res.status === 401) {
    // Session expired or signed out elsewhere - SocConsole listens for this
    // and drops back to the login screen.
    window.dispatchEvent(new Event("aegis:unauthorized"));
  }
  if (!res.ok) throw new Error(data.error || `Request to ${url} failed`);
  return data;
}

export default function SocConsole() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(false);

  const [alerts, setAlerts] = useState([]);
  const [endpoints, setEndpoints] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [analysts, setAnalysts] = useState([]);
  const [reports, setReports] = useState([]);
  const [reportGenerating, setReportGenerating] = useState(false);

  const [activePage, setActivePage] = useState("alerts");
  const [activeTab, setActiveTab] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({ endpoint: null, attack: null, minRisk: null });
  const [selectedId, setSelectedId] = useState(null);

  const [isLive, setIsLive] = useState(SIMULATION_ENABLED);
  const [consoleLines, setConsoleLines] = useState([]);
  const [sparkPoints, setSparkPoints] = useState([]);
  const [liveEventCount, setLiveEventCount] = useState(0);
  const [toasts, setToasts] = useState([]);

  function pushToast({ title, body }) {
    const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev, { key, title, body, out: false }]);
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.key === key ? { ...t, out: true } : t)));
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.key !== key)), 250);
    }, 4200);
  }

  function signedIn(analyst) {
    setUser({ name: analyst.name, email: analyst.email, analystId: analyst.id });
    loadConsole();
  }

  async function loadConsole() {
    setLoading(true);
    try {
      const [alertsRes, analystsRes, reportsRes, incidentsRes, endpointsRes] = await Promise.all([
        jsonFetch("/api/alerts"),
        jsonFetch("/api/analysts"),
        jsonFetch("/api/reports"),
        jsonFetch("/api/incidents"),
        jsonFetch("/api/endpoints"),
      ]);
      setAlerts(alertsRes.alerts);
      setAnalysts(analystsRes.analysts);
      setReports(reportsRes.reports);
      setIncidents(incidentsRes.incidents);
      setEndpoints(endpointsRes.endpoints);
    } catch (err) {
      console.error(err);
      pushToast({ title: "\u2715 Could not load console", body: String(err.message || err) });
    } finally {
      setLoading(false);
    }
  }

  // ---- restore an existing session cookie on page load ----
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.analyst) signedIn(data.analyst);
      })
      .catch((err) => console.error("session check failed:", err))
      .finally(() => setAuthChecked(true));

    const onUnauthorized = () => setUser(null);
    window.addEventListener("aegis:unauthorized", onUnauthorized);
    return () => window.removeEventListener("aegis:unauthorized", onUnauthorized);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- login: verify email + password on the server, which sets the
  // session cookie. Errors are thrown back to LoginScreen to display. ----
  async function handleLogin({ email, password }) {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Sign-in failed.");
    signedIn(data.analyst);
  }

  // ---- live ingestion loop: each tick asks the SERVER to generate + score
  // one real event; the server is the one deciding whether it becomes a
  // real Alert row (and sending the auto-email if severe) ----
  useEffect(() => {
    if (!user || !isLive || !SIMULATION_ENABLED) return;
    let cancelled = false;
    let timer = null;

    async function tick() {
      try {
        const data = await jsonFetch("/api/simulate/tick", { method: "POST" });
        if (cancelled) return;
        const { event, alertCreated, alert } = data;

        const time = new Date().toLocaleTimeString("en-GB", { hour12: false });
        const flagged = event.riskScore >= ALERT_THRESHOLD;
        const summary = `cpu=${event.cpuUsage}% net=${(event.networkBytes / 1000).toFixed(0)}KB logins=${event.failedLogins} conn=${event.connectionsPerMin}/min \u2192 risk ${event.riskScore}`;

        setConsoleLines((prev) => {
          const next = [...prev, { key: event.eventId, time, endpoint: event.endpointCode, summary, flagged }];
          return next.length > 40 ? next.slice(next.length - 40) : next;
        });
        setSparkPoints((prev) => {
          const next = [...prev, event.riskScore];
          return next.length > 30 ? next.slice(next.length - 30) : next;
        });
        setLiveEventCount((c) => c + 1);

        if (alertCreated && alert) {
          setAlerts((prev) => [alert, ...prev]);
          pushToast({
            title: `\u26a0 New alert \u2014 risk ${alert.riskScore}`,
            body: `${ATTACK_META[alert.attackType].label} detected on ${alert.endpoint.code}`,
          });
          if (alert.emailStatus === "sent" || alert.emailStatus === "simulated") {
            pushToast({
              title: alert.emailStatus === "sent" ? "\ud83d\udce7 Incident email sent" : "\ud83d\udce7 Incident email simulated",
              body: `${alert.eventId} \u2014 automatic severe-incident report`,
            });
          }
          if (alert.incidentId) {
            jsonFetch("/api/incidents")
              .then((res) => {
                if (!cancelled) setIncidents(res.incidents);
              })
              .catch((err) => console.error("incident refresh failed:", err));
            pushToast({
              title: "\ud83d\udd17 Correlated into an incident",
              body: `${alert.eventId} grouped with ${alert.incident?._count?.alerts - 1 || "other"} related event(s) on ${alert.endpoint.code}`,
            });
          }
        }
      } catch (err) {
        console.error("live tick failed:", err);
      }
    }

    function loop() {
      const delay = 1600 + Math.random() * 1800;
      timer = setTimeout(() => {
        if (cancelled) return;
        tick().then(loop);
      }, delay);
    }
    loop();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isLive]);

  // ---- background poll: catches REAL alerts created by the victim-VM
  // agent (app/api/ingest/ssh-bruteforce), which arrive independently of
  // this browser's own tick loop. Runs whenever logged in, even if the
  // synthetic feed is paused - a real external detection should still
  // surface. ----
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function poll() {
      try {
        const [alertsRes, incidentsRes, endpointsRes] = await Promise.all([
          jsonFetch("/api/alerts"),
          jsonFetch("/api/incidents"),
          jsonFetch("/api/endpoints"),
        ]);
        if (cancelled) return;
        setEndpoints(endpointsRes.endpoints);

        setAlerts((prev) => {
          const knownIds = new Set(prev.map((a) => a.id));
          const newlyArrived = alertsRes.alerts.filter((a) => !knownIds.has(a.id) && a.source === "live-agent");
          newlyArrived.forEach((a) => {
            pushToast({
              title: `\ud83d\udee1\ufe0f Real attack detected \u2014 risk ${a.riskScore}`,
              body: `${ATTACK_META[a.attackType].label} from ${a.sourceIp} on ${a.endpoint.code} (live agent)`,
            });
          });
          return alertsRes.alerts;
        });
        setIncidents(incidentsRes.incidents);
      } catch (err) {
        console.error("background poll failed:", err);
      }
    }

    const interval = setInterval(poll, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function handleNavigate(page) {
    if (page === "alerts") {
      setFilters({ endpoint: null, attack: null, minRisk: null });
      setSearchQuery("");
      setActiveTab("All");
    }
    setActivePage(page);
  }

  function handleStatFilter(patch) {
    setFilters({ endpoint: null, attack: null, minRisk: patch.minRisk ?? null });
    setSearchQuery("");
    setActiveTab(patch.tab || "All");
  }

  function handleDrillEndpoint(ep) {
    setFilters({ endpoint: ep, attack: null, minRisk: null });
    setSearchQuery("");
    setActiveTab("All");
    setActivePage("alerts");
  }

  function handleFilterAttack(attackKey) {
    setFilters({ endpoint: null, attack: attackKey, minRisk: null });
    setSearchQuery("");
    setActiveTab("All");
    setActivePage("alerts");
  }

  function clearFilter(key) {
    setFilters((prev) => ({ ...prev, [key]: null }));
  }

  async function handleAdvanceStatus(status) {
    if (!selectedId) return;
    try {
      const { alert } = await jsonFetch(`/api/alerts/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setAlerts((prev) => prev.map((a) => (a.id === alert.id ? alert : a)));
    } catch (err) {
      pushToast({ title: "\u2715 Update failed", body: String(err.message || err) });
    }
  }

  async function handleAssign(analystId, analystName) {
    if (!selectedId) return;
    try {
      const { alert } = await jsonFetch(`/api/alerts/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedAnalystId: analystId, assignedAnalystName: analystName }),
      });
      setAlerts((prev) => prev.map((a) => (a.id === alert.id ? alert : a)));
    } catch (err) {
      pushToast({ title: "\u2715 Reassign failed", body: String(err.message || err) });
    }
  }

  async function handleAddNote(text) {
    if (!selectedId) return;
    try {
      const { alert } = await jsonFetch(`/api/alerts/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: text }),
      });
      setAlerts((prev) => prev.map((a) => (a.id === alert.id ? alert : a)));
    } catch (err) {
      pushToast({ title: "\u2715 Note failed", body: String(err.message || err) });
    }
  }

  async function handleSendEmail() {
    if (!selectedId) return;
    try {
      const { alert } = await jsonFetch(`/api/alerts/${selectedId}/report`, { method: "POST" });
      setAlerts((prev) => prev.map((a) => (a.id === alert.id ? alert : a)));
      pushToast({
        title:
          alert.emailStatus === "sent"
            ? "\ud83d\udce7 Incident email sent"
            : alert.emailStatus === "simulated"
            ? "\ud83d\udce7 Incident email simulated"
            : "\u2715 Email failed",
        body: `${alert.eventId} \u2014 ${
          alert.emailStatus === "sent" ? "delivered to SOC distribution list" : alert.emailStatus === "simulated" ? "no SMTP configured, logged on server" : "could not send incident report"
        }`,
      });
    } catch (err) {
      pushToast({ title: "\u2715 Email failed", body: String(err.message || err) });
    }
  }

  async function handleGenerateReport() {
    setReportGenerating(true);
    try {
      const { report } = await jsonFetch("/api/reports", { method: "POST" });
      setReports((prev) => [report, ...prev]);
    } catch (err) {
      pushToast({ title: "\u2715 Report failed", body: String(err.message || err) });
    } finally {
      setReportGenerating(false);
    }
  }

  async function handleSignOut() {
    if (!confirm("Sign out of the Aegis SOC Console?")) return;
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      // Full reload clears all in-memory console state for the next user.
      window.location.reload();
    }
  }

  if (!authChecked) {
    return <div id="login-screen" />;
  }
  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const selectedAlert = alerts.find((a) => a.id === selectedId) || null;

  return (
    <div id="app" className="active">
      <Sidebar activePage={activePage} onNavigate={handleNavigate} />
      <div className="main">
        <Topbar activePage={activePage} user={user} onSignOut={handleSignOut} />

        {activePage === "alerts" && <FilterChips filters={filters} onClear={clearFilter} />}

        {loading ? (
          <div className="empty-state">Loading console from the database…</div>
        ) : (
          <>
            {activePage === "alerts" && (
              <AlertQueuePage
                alerts={alerts}
                consoleLines={consoleLines}
                sparkPoints={sparkPoints}
                isLive={isLive}
                onToggleLive={SIMULATION_ENABLED ? () => setIsLive((v) => !v) : null}
                activeTab={activeTab}
                onTabClick={setActiveTab}
                onStatFilter={handleStatFilter}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                filters={filters}
                onSelect={setSelectedId}
              />
            )}
            {activePage === "incidents" && (
              <IncidentsPage incidents={incidents} onSelectAlert={setSelectedId} />
            )}
            {activePage === "endpoints" && (
              <EndpointsPage alerts={alerts} endpoints={endpoints} onDrill={handleDrillEndpoint} />
            )}
            {activePage === "network" && (
              <NetworkPage
                alerts={alerts}
                endpointCount={endpoints.length}
                liveEventCount={liveEventCount}
                onSelect={setSelectedId}
              />
            )}
            {activePage === "risk" && <RiskPage alerts={alerts} onFilterAttack={handleFilterAttack} />}
            {activePage === "reports" && (
              <ReportsPage reports={reports} onGenerate={handleGenerateReport} generating={reportGenerating} />
            )}
          </>
        )}
      </div>

      <Drawer
        alert={selectedAlert}
        analysts={analysts}
        onClose={() => setSelectedId(null)}
        onAdvanceStatus={handleAdvanceStatus}
        onAssign={handleAssign}
        onAddNote={handleAddNote}
        onSendEmail={handleSendEmail}
      />
      <Toasts toasts={toasts} />
    </div>
  );
}
