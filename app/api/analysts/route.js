import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAnalyst, unauthorized } from "@/lib/auth";

/** Analyst roster for the assignment dropdown. Accounts are created with
 * `npm run user:create`, not through the API. */
export async function GET() {
  if (!(await getCurrentAnalyst())) return unauthorized();
  const analysts = await prisma.analyst.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });
  return NextResponse.json({ analysts });
}
