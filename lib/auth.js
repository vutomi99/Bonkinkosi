// lib/auth.js
//
// Cookie-based sessions for API routes. The browser holds a random token in
// an httpOnly cookie; the database stores only its SHA-256 hash (Session.id).
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE = "aegis_session";
const SESSION_DAYS = 7;

const hashToken = (token) => createHash("sha256").update(token).digest("hex");

export function publicAnalyst(analyst) {
  return { id: analyst.id, name: analyst.name, email: analyst.email };
}

/** Creates a session row and sets the cookie on `response`. */
export async function startSession(response, request, analystId) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { id: hashToken(token), analystId, expiresAt } });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // Only mark Secure when actually served over HTTPS, so sign-in still
    // works over plain http on the LAN (http://192.168.x.x:3001).
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession(response) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { id: hashToken(token) } });
  response.cookies.delete(SESSION_COOKIE);
}

/** The signed-in analyst for this request, or null. */
export async function getCurrentAnalyst() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { id: hashToken(token) },
    include: { analyst: true },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return session.analyst;
}

export function unauthorized() {
  return NextResponse.json({ error: "Not signed in" }, { status: 401 });
}
