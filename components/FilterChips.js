"use client";

export default function FilterChips({ filters, onClear }) {
  const chips = [];
  if (filters.endpoint) chips.push({ key: "endpoint", label: `Endpoint: ${filters.endpoint}` });
  if (filters.attackLabel) chips.push({ key: "attack", label: `Attack type: ${filters.attackLabel}` });
  if (filters.minRisk != null) chips.push({ key: "minRisk", label: `Risk \u2265 ${filters.minRisk}` });

  if (!chips.length) return null;

  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
      {chips.map((c) => (
        <span className="filter-chip" key={c.key}>
          {c.label}
          <span className="x" onClick={() => onClear(c.key)}>
            &times;
          </span>
        </span>
      ))}
    </div>
  );
}
