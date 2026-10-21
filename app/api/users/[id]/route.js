import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAnalyst, unauthorized, forbidden, canAdminister, ROLES } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

/** Admin: change a user's role, name, or password. */
export async function PATCH(request, { params }) {
  const me = await getCurrentAnalyst();
  if (!me) return unauthorized();
  if (!canAdminister(me.role)) return forbidden("Only System Administrators can manage users.");

  const { id } = await params;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const target = await prisma.analyst.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const data = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (ROLES.includes(body.role)) {
    // Don't let an admin remove the last admin (including demoting themselves).
    if (target.role === "admin" && body.role !== "admin") {
      const admins = await prisma.analyst.count({ where: { role: "admin" } });
      if (admins <= 1) {
        return NextResponse.json({ error: "At least one System Administrator must remain." }, { status: 400 });
      }
    }
    data.role = body.role;
  }
  if (typeof body.password === "string" && body.password) {
    if (body.password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }
    data.passwordHash = hashPassword(body.password);
  }
  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const user = await prisma.analyst.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
  // A password/role change signs the user out of existing sessions.
  if (data.passwordHash || data.role) {
    await prisma.session.deleteMany({ where: { analystId: id } });
  }
  return NextResponse.json({ user });
}
