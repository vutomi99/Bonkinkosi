// prisma.config.ts
//
// Prisma 7 no longer reads the datasource URL from schema.prisma or loads
// .env automatically - both are configured here for the Prisma CLI
// (generate / migrate / studio).
import dotenv from "dotenv";
import { defineConfig, env } from "prisma/config";

// Same precedence as Next.js: .env.local (secrets, DATABASE_URL) over .env.
dotenv.config({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
