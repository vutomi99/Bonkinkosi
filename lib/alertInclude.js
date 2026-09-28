// lib/alertInclude.js
//
// One shared `include` shape for Alert queries, used by every route that
// returns an alert to the client, so the response shape never quietly
// drifts between endpoints (e.g. one route forgetting to include
// `incident` and the client silently losing that data on that one path).
export const ALERT_INCLUDE = {
  endpoint: true,
  assignedAnalyst: true,
  timeline: { orderBy: { createdAt: "asc" } },
  incident: { include: { _count: { select: { alerts: true } } } },
};
