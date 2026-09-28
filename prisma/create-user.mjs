// prisma/create-user.mjs
//
// Creates an analyst account, or resets the name/password of an existing
// one. There is no self-registration in the app - this is how accounts are
// made.
//
//   npm run user:create -- <email> <password> "<Display Name>"

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { hashPassword } from "../lib/password.js";

const [emailArg, password, ...nameParts] = process.argv.slice(2);
const email = (emailArg || "").trim().toLowerCase();
const name = nameParts.join(" ").trim() || email.split("@")[0];

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) {
  console.error('Usage: npm run user:create -- <email> <password> "<Display Name>"');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL }),
});

try {
  const passwordHash = hashPassword(password);
  const existing = await prisma.analyst.findUnique({ where: { email } });
  const analyst = await prisma.analyst.upsert({
    where: { email },
    update: { name, passwordHash },
    create: { email, name, passwordHash },
  });
  if (existing) {
    // Password changed: sign out every browser using the old one.
    await prisma.session.deleteMany({ where: { analystId: analyst.id } });
  }
  console.log(`${existing ? "Updated" : "Created"} account ${analyst.email} (${analyst.name}).`);
} finally {
  await prisma.$disconnect();
}
