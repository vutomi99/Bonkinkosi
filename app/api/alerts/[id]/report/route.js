import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reportIncidentEmail } from "@/lib/reportIncident";
import { getCurrentAnalyst, unauthorized, forbidden, canRespond } from "@/lib/auth";

export async function POST(request, { params }) {
  const me = await getCurrentAnalyst();
  if (!me) return unauthorized();
  if (!canRespond(me.role)) return forbidden("Security Managers have read-only access.");
  const reporterName = me.name;
  const { id } = await params;

  const alert = await prisma.alert.findUnique({
    where: { id },
    include: { endpoint: true, assignedAnalyst: true },
  });
  if (!alert) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

  const updated = await reportIncidentEmail(alert, { reporterName, auto: false });
  return NextResponse.json({ ok: updated.emailStatus !== "failed", alert: updated });
}
