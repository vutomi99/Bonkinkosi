import { NextResponse } from "next/server";
import { getCurrentAnalyst, publicAnalyst, unauthorized } from "@/lib/auth";

export async function GET() {
  const me = await getCurrentAnalyst();
  if (!me) return unauthorized();
  return NextResponse.json({ analyst: publicAnalyst(me) });
}
