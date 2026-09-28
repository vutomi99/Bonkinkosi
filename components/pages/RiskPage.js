"use client";
import { ATTACK_META, ATTACK_TYPES } from "@/lib/simulation";

const ATTACK_COLORS = {
  brute_force: "var(--warn)",
  malware_cpu_spike: "var(--critical)",
  port_scan: "var(--info)",
  data_exfiltration: "var(--critical)",
};

const RISK_BUCKETS = [
  { label: "0\u201339 (low)", test: (r) => r < 40, color: "var(--info)" },
  { label: "40\u201369 (medium)", test: (r) => r >= 40 && r < 70, color: "var(--warn)" },
  { label: "70\u201389 (high)", test: (r) => r >= 70 && r < 90, color: "var(--critical)" },
  { label: "90\u2013100 (critical)", test: (r) => r >= 90, color: "var(--critical)" },
];

export default function RiskPage({ alerts, onFilterAttack }) {
  const open = alerts.filter((a) => a.status !== "Resolved").length;
  const critical = alerts.filter((a) => a.riskScore >= 90).length;
  const avgRisk = alerts.length
    ? (alerts.reduce((s, a) => s + a.riskScore, 0) / alerts.length).toFixed(1)
    : "0.0";

  const counts = {};
  ATTACK_TYPES.forEach((k) => (counts[k] = 0));
  alerts.forEach((a) => {
    if (a.attackType) counts[a.attackType] = (counts[a.attackType] || 0) + 1;
  });
  const maxCount = Math.max(1, ...Object.values(counts));

  const bucketCounts = RISK_BUCKETS.map((b) => alerts.filter((a) => b.test(a.riskScore)).length);
  const maxB = Math.max(1, ...bucketCounts);

  return (
    <>
      <div className="stat-row">
        <div className="stat-card">
          <div className="label">Total alerts (all time)</div>
          <div className="value">{alerts.length}</div>
        </div>
        <div className="stat-card">
          <div className="label">Currently open</div>
          <div className="value critical">{open}</div>
        </div>
        <div className="stat-card">
          <div className="label">Average risk score</div>
          <div className="value">{avgRisk}</div>
        </div>
        <div className="stat-card">
          <div className="label">Critical (≥ 90)</div>
          <div className="value warn">{critical}</div>
        </div>
      </div>

      <div className="live-row">
        <div className="panel">
          <div className="panel-head">
            <h2>Alerts by attack type</h2>
          </div>
          <div style={{ padding: "16px 18px" }}>
            {ATTACK_TYPES.map((k) => (
              <div
                className="bar-row clickable-row"
                key={k}
                style={{ borderRadius: 6, paddingLeft: 6, paddingRight: 6 }}
                onClick={() => onFilterAttack(k)}
              >
                <div className="bar-label">{ATTACK_META[k].label}</div>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${(counts[k] / maxCount) * 100}%`, background: ATTACK_COLORS[k] }}
                  ></div>
                </div>
                <div className="bar-count">{counts[k]}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <div className="panel-head">
            <h2>Risk score distribution</h2>
          </div>
          <div style={{ padding: "16px 18px" }}>
            {RISK_BUCKETS.map((b, i) => (
              <div className="bar-row" key={b.label}>
                <div className="bar-label">{b.label}</div>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${(bucketCounts[i] / maxB) * 100}%`, background: b.color }}
                  ></div>
                </div>
                <div className="bar-count">{bucketCounts[i]}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>AI model performance (from training run)</h2>
        </div>
        <div className="kv-grid" style={{ padding: "16px 18px", marginBottom: 0 }}>
          <div className="kv">
            <div className="k">Detection accuracy</div>
            <div className="v">99.8%</div>
          </div>
          <div className="kv">
            <div className="k">Precision</div>
            <div className="v">98.0%</div>
          </div>
          <div className="kv">
            <div className="k">Recall</div>
            <div className="v">98.0%</div>
          </div>
          <div className="kv">
            <div className="k">Avg inference latency</div>
            <div className="v">0.0364 ms</div>
          </div>
        </div>
      </div>
    </>
  );
}
