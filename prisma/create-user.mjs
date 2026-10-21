// prisma/create-user.mjs
//
// Creates an analyst account, or resets the name/password of an existing
// one. There is no self-registration in the app - this is how accounts are
// made.
//
//   npm run user:create -- <email> <password> "<Display Name>"

import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../lib/password.js";

// Same precedence as Next.js: .env.local (secrets, DATABASE_URL) over .env.
dotenv.config({ path: [".env.local", ".env"], quiet: true });

const VALID_ROLES = ["analyst", "admin", "manager"];
const args = process.argv.slice(2);
// Optional trailing role arg: analyst | admin | manager (default analyst).
let role = "analyst";
if (VALID_ROLES.includes((args[args.length - 1] || "").toLowerCase())) {
  role = args.pop().toLowerCase();
}
const [emailArg, password, ...nameParts] = args;
const email = (emailArg || "").trim().toLowerCase();
const name = nameParts.join(" ").trim() || email.split("@")[0];

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) {
  console.error('Usage: npm run user:create -- <email> <password> "<Display Name>" [analyst|admin|manager]');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

try {
  const passwordHash = hashPassword(password);
  const existing = await prisma.analyst.findUnique({ where: { email } });
  const analyst = await prisma.analyst.upsert({
    where: { email },
    update: { name, passwordHash, role },
    create: { email, name, passwordHash, role },
  });
  if (existing) {
    // Password changed: sign out every browser using the old one.
    await prisma.session.deleteMany({ where: { analystId: analyst.id } });
  }
  console.log(`${existing ? "Updated" : "Created"} account ${analyst.email} (${analyst.name}) [${role}].`);
} finally {
  await prisma.$disconnect();
}
