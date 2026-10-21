import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAnalyst, unauthorized } from "@/lib/auth";
import { ALERT_INCLUDE } from "@/lib/alertInclude";
import { aiShiftSummary } from "@/lib/aiScoring";
import { buildReportHtml } from "@/lib/reportHtml";

/** Full security report built from live findings. Returns a standalone HTML
 * page (viewable + printable to PDF). ?download=1 forces a file download. */
export async function GET(request) {
  const me = await getCurrentAnalyst();
  if (!me) return unauthorized();

  const [alerts, incidentsRaw] = await Promise.all([
    prisma.alert.findMany({ include: ALERT_INCLUDE, orderBy: { riskScore: "desc" } }),
    prisma.incident.findMany({
      include: {
        endpoint: true,
        alerts: { include: { endpoint: true, assignedAnalyst: true }, orderBy: { createdAt: "asc" } },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const counts = {
    open: alerts.filter((a) => a.status === "New").length,
    investigating: alerts.filter((a) => a.status === "Investigating").length,
    contained: alerts.filter((a) => a.status === "Contained").length,
    resolved: alerts.filter((a) => a.status === "Resolved").length,
  };

  const incidents = incidentsRaw.map((inc) => ({
    id: inc.id,
    endpoint: inc.endpoint.code,
    createdAt: inc.createdAt,
    severity: inc.alerts.reduce((m, a) => Math.max(m, a.riskScore), 0),
    status: inc.alerts.every((a) => a.status === "Resolved") ? "Resolved" : "Open",
    count: inc.alerts.length,
    alerts: inc.alerts,
  }));

  const summary = await aiShiftSummary(counts);
  const generatedAt = new Date();
  const html = buildReportHtml({ generatedBy: me.name, generatedAt, summary, alerts, incidents, counts });

  const headers = { "Content-Type": "text/html; charset=utf-8" };
  if (new URL(request.url).searchParams.get("download")) {
    headers["Content-Disposition"] = `attachment; filename="soc-report-${generatedAt.toISOString().slice(0, 10)}.html"`;
  }
  return new NextResponse(html, { headers });
}
