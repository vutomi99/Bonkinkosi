import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAnalyst, unauthorized } from "@/lib/auth";

export async function GET() {
  if (!(await getCurrentAnalyst())) return unauthorized();
  const endpoints = await prisma.endpoint.findMany({
    orderBy: { code: "asc" },
    include: {
      alerts: {
        select: { status: true, riskScore: true, attackType: true, createdAt: true },
      },
    },
  });

  const result = endpoints.map((ep) => {
    const openAlerts = ep.alerts.filter((a) => a.status !== "Resolved");
    const maxRisk = ep.alerts.reduce((m, a) => Math.max(m, a.riskScore), 0);
    const last = ep.alerts.reduce(
      (latest, a) => (!latest || a.createdAt > latest.createdAt ? a : latest),
      null
    );
    return {
      code: ep.code,
      openAlerts: openAlerts.length,
      maxRisk,
      lastAttackType: last?.attackType || null,
      hasActivity: ep.alerts.length > 0,
    };
  });

  return NextResponse.json({ endpoints: result });
}
