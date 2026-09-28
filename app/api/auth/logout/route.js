import { NextResponse } from "next/server";
import { endSession } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  await endSession(response);
  return response;
}
