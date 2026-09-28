import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAnalyst, unauthorized } from "@/lib/auth";

export async function GET() {
  if (!(await getCurrentAnalyst())) return unauthorized();
  const reports = await prisma.report.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ reports });
}

export async function POST() {
  const me = await getCurrentAnalyst();
  if (!me) return unauthorized();
  const generatedBy = me.name;

  const [open, investigating, contained, resolved] = await Promise.all([
    prisma.alert.count({ where: { status: "New" } }),
    prisma.alert.count({ where: { status: "Investigating" } }),
    prisma.alert.count({ where: { status: "Contained" } }),
    prisma.alert.count({ where: { status: "Resolved" } }),
  ]);

  const report = await prisma.report.create({
    data: {
      title: `Shift report \u2014 ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
      generatedBy,
      openCount: open,
      investigating,
      contained,
      resolved,
    },
  });

  return NextResponse.json({ report });
}
