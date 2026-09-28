// lib/simulation.js
//
// Pure data + helper functions shared between the server (API routes,
// which own the real simulation) and the client (which only uses the
// display helpers - riskColor, timeAgo - plus ATTACK_META for labels).
// No alert objects are constructed here anymore: that happens in
// app/api/simulate/tick/route.js, backed by Prisma.

export const ALL_ENDPOINT_CODES = Array.from(
  { length: 20 },
  (_, i) => `EP-${String(i + 1).padStart(3, "0")}`
);

export const STATUSES = ["New", "Investigating", "Contained", "Resolved"];

export const ATTACK_TYPES = [
  "brute_force",
  "malware_cpu_spike",
  "port_scan",
  "data_exfiltration",
];

export const ATTACK_META = {
  brute_force: {
    label: "Brute-force login",
    indicators: (e) => [
      `${e.failedLogins} failed login attempts in under 2 minutes on ${e.endpointCode}`,
      `Repeated authentication requests against a single account`,
    ],
  },
  malware_cpu_spike: {
    label: "Malware-like CPU spike",
    indicators: (e) => [
      `CPU usage ${e.cpuUsage}% - sustained abnormal load`,
      `Network usage ${(e.networkBytes / 1000).toFixed(0)} KB elevated alongside the CPU spike`,
    ],
  },
  port_scan: {
    label: "Port scan",
    indicators: (e) => [
      `${e.connectionsPerMin} connections/min - far above endpoint baseline`,
      `Sequential ports, multiple destinations`,
    ],
  },
  data_exfiltration: {
    label: "Data exfiltration",
    indicators: (e) => [
      `${(e.networkBytes / 1000000).toFixed(2)} MB outbound in a single transfer, off-hours`,
      `Destination is external and previously unseen`,
    ],
  },
};

export const ALERT_THRESHOLD = 70;
export const AUTO_RESPONSE_THRESHOLD = 95; // auto-contained, no analyst needed
export const SEVERE_EMAIL_THRESHOLD = 90; // triggers an automatic incident-report email

export function randn(mean, std) {
  let u = 0,
    v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function riskColor(risk) {
  if (risk >= ALERT_THRESHOLD) return "var(--critical)";
  if (risk >= 40) return "var(--warn)";
  return "var(--info)";
}

/** Scores a REAL observed SSH brute-force burst (failed logins counted by
 * the live agent in its rolling window) onto the same 0-100 scale the
 * synthetic simulation uses, so real and simulated alerts sit on one
 * consistent risk scale and the same ALERT_THRESHOLD / AUTO_RESPONSE_THRESHOLD
 * / SEVERE_EMAIL_THRESHOLD logic applies to both. */
export function scoreRealBruteForce(failedLoginCount) {
  return clamp(+(50 + failedLoginCount * 1.6).toFixed(1), 10, 100);
}

/** Accepts a Date, ISO string, or millis timestamp. */
export function timeAgo(when) {
  const then = when instanceof Date ? when.getTime() : new Date(when).getTime();
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m ago`;
}

export function isFresh(createdAt) {
  const then = createdAt instanceof Date ? createdAt.getTime() : new Date(createdAt).getTime();
  return Date.now() - then < 15000;
}

/** One synthetic incoming event's raw metrics. This is a lightweight
 * heuristic standing in for the Python Isolation Forest model documented
 * in the companion simulation report - the live demo scores each event
 * the same way (see the "AI risk score" panel). Runs server-side, inside
 * the /api/simulate/tick route. */
export function generateLiveEvent(endpointCode) {
  const isThreat = Math.random() < 0.16;
  let cpuUsage, networkBytes, failedLogins, connectionsPerMin, attackType, riskScore;

  if (!isThreat) {
    cpuUsage = clamp(randn(30, 8), 1, 100);
    networkBytes = clamp(randn(50000, 15000), 500, 1e9);
    failedLogins = Math.random() < 0.88 ? 0 : 1;
    connectionsPerMin = clamp(randn(8, 3), 1, 40);
    attackType = null;
    riskScore = clamp(randn(14, 11), 1, 48);
  } else {
    attackType = pick(ATTACK_TYPES);
    cpuUsage = clamp(randn(30, 8), 1, 100);
    networkBytes = clamp(randn(50000, 15000), 500, 1e9);
    failedLogins = 0;
    connectionsPerMin = clamp(randn(8, 3), 1, 40);
    if (attackType === "brute_force") {
      failedLogins = Math.round(clamp(randn(35, 12), 12, 70));
      riskScore = clamp(randn(87, 7), 65, 100);
    } else if (attackType === "malware_cpu_spike") {
      cpuUsage = clamp(randn(95, 4), 80, 100);
      networkBytes = clamp(randn(200000, 40000), 100000, 400000);
      riskScore = clamp(randn(84, 7), 65, 100);
    } else if (attackType === "port_scan") {
      connectionsPerMin = Math.round(clamp(randn(130, 35), 70, 220));
      riskScore = clamp(randn(80, 9), 60, 100);
    } else {
      networkBytes = clamp(randn(3000000, 500000), 1500000, 5000000);
      riskScore = clamp(randn(89, 6), 70, 100);
    }
  }

  return {
    eventId: `EVT-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    endpointCode,
    cpuUsage: +cpuUsage.toFixed(1),
    networkBytes: Math.round(networkBytes),
    failedLogins,
    connectionsPerMin: +connectionsPerMin.toFixed(1),
    attackType,
    riskScore: +riskScore.toFixed(1),
  };
}
