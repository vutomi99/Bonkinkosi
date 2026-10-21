// lib/aiScoring.js
//
// AI features via OpenRouter (OpenAI-compatible chat completions):
//   - aiAssessEvent:     0-100 risk score + rationale for one event
//   - aiIncidentSummary: short analyst-style write-up of one alert/incident
//   - aiShiftSummary:    executive summary for a shift report
// All degrade gracefully: if OPENROUTER_API_KEY is missing or a call fails,
// each returns a sensible rule-based / templated fallback and never throws.
import { clamp } from "@/lib/simulation";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

export const AI_MODEL = MODEL;
export const aiEnabled = () => Boolean(process.env.OPENROUTER_API_KEY);

const ATTACK_LABELS = {
  brute_force: "SSH/login brute-force",
  malware_cpu_spike: "malware CPU spike",
  port_scan: "port scan",
  data_exfiltration: "data exfiltration",
};

/** Low-level OpenRouter call. Returns the assistant message string, or throws. */
async function callOpenRouter(messages, { maxTokens = 200, json = false } = {}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "AI-Driven Integrated SOC",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      max_tokens: maxTokens,
      ...(json ? { response_format: { type: "json_object" } } : {}),
      messages,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenRouter HTTP ${res.status} ${body.slice(0, 160)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty completion");
  return content;
}

function describeEvent(event) {
  const lines = [
    `Endpoint: ${event.endpointCode || "unknown"}`,
    `Suspected activity: ${ATTACK_LABELS[event.attackType] || event.attackType || "unclassified"}`,
  ];
  if (event.sourceIp) lines.push(`Source IP: ${event.sourceIp}`);
  if (Number.isFinite(event.failedLogins))
    lines.push(`Failed logins in window: ${event.failedLogins}` + (event.windowSeconds ? ` (last ${event.windowSeconds}s)` : ""));
  if (Number.isFinite(event.connectionsPerMin)) lines.push(`Connections/min: ${event.connectionsPerMin}`);
  if (Number.isFinite(event.cpuUsage)) lines.push(`CPU usage: ${event.cpuUsage}%`);
  if (Number.isFinite(event.networkBytes)) lines.push(`Outbound bytes: ${event.networkBytes}`);
  return lines.join("\n");
}

const SCORING_SYSTEM =
  "You are the risk-scoring engine of a Security Operations Center. You receive " +
  "telemetry for a single event on a monitored endpoint and judge how dangerous " +
  'it is. Reply with STRICT JSON only: {"riskScore": <number 0-100>, "rationale": ' +
  '"<one short sentence>"}. Scale: 0-39 benign, 40-69 suspicious, 70-89 high, ' +
  "90-100 critical. Weigh attack type, volume/rate, and deviation from normal.";

/** Risk score (0-100) + rationale for one event; falls back to `fallbackScore`. */
export async function aiAssessEvent(event, fallbackScore) {
  const fallback = (why) => ({
    riskScore: clamp(+Number(fallbackScore || 0).toFixed(1), 0, 100),
    rationale: why || "Rule-based score (AI scoring unavailable).",
    scoredBy: "rule-based",
  });
  if (!aiEnabled()) return fallback("Rule-based score (OPENROUTER_API_KEY not set).");
  try {
    const content = await callOpenRouter(
      [
        { role: "system", content: SCORING_SYSTEM },
        { role: "user", content: describeEvent(event) },
      ],
      { maxTokens: 200, json: true }
    );
    const parsed = JSON.parse(content);
    const score = Number(parsed.riskScore);
    if (!Number.isFinite(score)) throw new Error("No numeric riskScore in reply");
    return {
      riskScore: clamp(+score.toFixed(1), 0, 100),
      rationale: (String(parsed.rationale || "").trim() || "AI risk assessment.").slice(0, 300),
      scoredBy: "ai",
      model: MODEL,
    };
  } catch (err) {
    console.error("AI scoring failed, using rule-based fallback:", err?.message || err);
    return fallback();
  }
}

/** Short analyst-style summary of one alert. `alert` is a DB alert with
 * relations (endpoint, timeline). Returns a plain-text string. */
export async function aiIncidentSummary(alert) {
  const label = ATTACK_LABELS[alert.attackType] || alert.attackType || "security event";
  const fallback = `${label} on ${alert.endpoint?.code || "an endpoint"} scored ${alert.riskScore}/100${
    alert.sourceIp ? ` from ${alert.sourceIp}` : ""
  }.`;
  if (!aiEnabled()) return fallback;
  try {
    const facts = [
      `Attack type: ${label}`,
      `Endpoint: ${alert.endpoint?.code || "unknown"}`,
      `Risk score: ${alert.riskScore}/100`,
      `Status: ${alert.status}`,
      alert.sourceIp ? `Source IP: ${alert.sourceIp}` : null,
      Number.isFinite(alert.failedLogins) ? `Failed logins: ${alert.failedLogins}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    const content = await callOpenRouter(
      [
        {
          role: "system",
          content:
            "You are a SOC analyst. Write a concise 2-3 sentence incident summary for the " +
            "given alert: what happened, why it matters, and the recommended next action. " +
            "Plain text, no markdown, no preamble.",
        },
        { role: "user", content: facts },
      ],
      { maxTokens: 220 }
    );
    return content.trim().slice(0, 600) || fallback;
  } catch (err) {
    console.error("AI incident summary failed:", err?.message || err);
    return fallback;
  }
}

/** Executive summary for a shift report from the status counts. Plain text. */
export async function aiShiftSummary(counts) {
  const { open, investigating, contained, resolved } = counts;
  const total = open + investigating + contained + resolved;
  const fallback = `${total} alert(s) this shift: ${open} new, ${investigating} investigating, ${contained} contained, ${resolved} resolved.`;
  if (!aiEnabled()) return fallback;
  try {
    const content = await callOpenRouter(
      [
        {
          role: "system",
          content:
            "You are a SOC shift lead writing the summary line of a handover report. " +
            "Given the alert counts by status, write 2-3 plain-text sentences summarising " +
            "the shift's security posture and what the next shift should watch. No markdown.",
        },
        {
          role: "user",
          content: `New: ${open}\nInvestigating: ${investigating}\nContained: ${contained}\nResolved: ${resolved}`,
        },
      ],
      { maxTokens: 220 }
    );
    return content.trim().slice(0, 600) || fallback;
  } catch (err) {
    console.error("AI shift summary failed:", err?.message || err);
    return fallback;
  }
}
