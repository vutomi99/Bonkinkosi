import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { publicAnalyst, startSession } from "@/lib/auth";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const analyst = await prisma.analyst.findUnique({ where: { email } });
  // Same message for unknown email and wrong password, so the form can't be
  // used to discover which emails have accounts.
  if (!analyst || !verifyPassword(password, analyst.passwordHash)) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const response = NextResponse.json({ analyst: publicAnalyst(analyst) });
  await startSession(response, request, analyst.id);
  return response;
}
