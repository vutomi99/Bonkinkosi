import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAnalyst, unauthorized, forbidden, canAdminister } from "@/lib/auth";

/** Admin: remove a monitored endpoint that has no recorded activity. */
export async function DELETE(request, { params }) {
  const me = await getCurrentAnalyst();
  if (!me) return unauthorized();
  if (!canAdminister(me.role)) return forbidden("Only System Administrators can manage endpoints.");

  const { code } = await params;
  const endpoint = await prisma.endpoint.findUnique({
    where: { code },
    include: { _count: { select: { alerts: true, incidents: true } } },
  });
  if (!endpoint) return NextResponse.json({ error: "Endpoint not found" }, { status: 404 });
  if (endpoint._count.alerts > 0 || endpoint._count.incidents > 0) {
    return NextResponse.json(
      { error: "This endpoint has recorded alerts/incidents and cannot be deleted." },
      { status: 409 }
    );
  }

  await prisma.endpoint.delete({ where: { code } });
  return NextResponse.json({ ok: true });
}
