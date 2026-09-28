import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { STATUSES } from "@/lib/simulation";
import { ALERT_INCLUDE } from "@/lib/alertInclude";
import { getCurrentAnalyst, unauthorized } from "@/lib/auth";

export async function PATCH(request, { params }) {
  const me = await getCurrentAnalyst();
  if (!me) return unauthorized();
  const actorName = me.name;
  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { status, assignedAnalystId, assignedAnalystName, note } = body || {};

  const existing = await prisma.alert.findUnique({
    where: { id },
    include: { assignedAnalyst: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

  const data = {};
  const timelineEntries = [];

  if (status && STATUSES.includes(status) && status !== existing.status) {
    data.status = status;
    timelineEntries.push({ text: `Status changed to ${status} by ${actorName}.` });
  }

  if (assignedAnalystId !== undefined && assignedAnalystId !== existing.assignedAnalystId) {
    data.assignedAnalystId = assignedAnalystId || null;
    const prevName = existing.assignedAnalyst?.name || "Unassigned";
    const nextName = assignedAnalystId ? assignedAnalystName || "someone" : "Unassigned";
    timelineEntries.push({ text: `Reassigned from ${prevName} to ${nextName} by ${actorName}.` });
  }

  if (note && note.trim()) {
    timelineEntries.push({ text: `${actorName}: "${note.trim()}"` });
  }

  if (!Object.keys(data).length && !timelineEntries.length) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const alert = await prisma.alert.update({
    where: { id },
    data: {
      ...data,
      timeline: timelineEntries.length ? { create: timelineEntries } : undefined,
    },
    include: ALERT_INCLUDE,
  });

  return NextResponse.json({ alert });
}
