// prisma.config.ts
//
// Prisma 7 no longer reads the datasource URL from schema.prisma or loads
// .env automatically - both are configured here for the Prisma CLI
// (generate / migrate / studio).
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
