import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAnalyst, unauthorized } from "@/lib/auth";

export async function GET() {
  if (!(await getCurrentAnalyst())) return unauthorized();
  const incidents = await prisma.incident.findMany({
    include: {
      endpoint: true,
      alerts: {
        include: { endpoint: true, assignedAnalyst: true },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Status and severity are derived from the member alerts on every read,
  // never stored, so they can't drift out of sync with the alerts
  // themselves as analysts work each case.
  const result = incidents.map((inc) => {
    const maxRisk = inc.alerts.reduce((m, a) => Math.max(m, a.riskScore), 0);
    const allResolved = inc.alerts.every((a) => a.status === "Resolved");
    return {
      id: inc.id,
      endpoint: inc.endpoint,
      createdAt: inc.createdAt,
      updatedAt: inc.updatedAt,
      status: allResolved ? "Resolved" : "Open",
      severity: maxRisk,
      eventCount: inc.alerts.length,
      alerts: inc.alerts,
    };
  });

  return NextResponse.json({ incidents: result });
}
