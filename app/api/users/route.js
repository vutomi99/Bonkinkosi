import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAnalyst, unauthorized, forbidden, canAdminister, ROLES } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

/** Admin: list all accounts with their roles. */
export async function GET() {
  const me = await getCurrentAnalyst();
  if (!me) return unauthorized();
  if (!canAdminister(me.role)) return forbidden("Only System Administrators can manage users.");

  const users = await prisma.analyst.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
  return NextResponse.json({ users });
}

/** Admin: create a new account. */
export async function POST(request) {
  const me = await getCurrentAnalyst();
  if (!me) return unauthorized();
  if (!canAdminister(me.role)) return forbidden("Only System Administrators can create users.");

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const email = String(body?.email || "").trim().toLowerCase();
  const name = String(body?.name || "").trim() || email.split("@")[0];
  const password = String(body?.password || "");
  const role = ROLES.includes(body?.role) ? body.role : "analyst";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }
  if (await prisma.analyst.findUnique({ where: { email } })) {
    return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
  }

  const user = await prisma.analyst.create({
    data: { email, name, role, passwordHash: hashPassword(password) },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
  return NextResponse.json({ user });
}
