import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ALERT_INCLUDE } from "@/lib/alertInclude";
import { getCurrentAnalyst, unauthorized } from "@/lib/auth";

export async function GET() {
  if (!(await getCurrentAnalyst())) return unauthorized();
  const alerts = await prisma.alert.findMany({
    include: ALERT_INCLUDE,
    orderBy: { riskScore: "desc" },
  });
  return NextResponse.json({ alerts });
}
