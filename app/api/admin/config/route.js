import { NextResponse } from "next/server";
import { getCurrentAnalyst, unauthorized, forbidden, canAdminister } from "@/lib/auth";
import { aiEnabled, AI_MODEL } from "@/lib/aiScoring";

/** Admin: read-only view of system configuration (no secrets returned). */
export async function GET() {
  const me = await getCurrentAnalyst();
  if (!me) return unauthorized();
  if (!canAdminister(me.role)) return forbidden("Only System Administrators can view system configuration.");

  return NextResponse.json({
    config: {
      simulationEnabled: process.env.NEXT_PUBLIC_ENABLE_SIMULATION === "true",
      aiEnabled: aiEnabled(),
      aiModel: aiEnabled() ? AI_MODEL : null,
      smtpConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
      ingestConfigured: Boolean(process.env.INGEST_API_KEY),
      databaseProvider: "PostgreSQL",
    },
  });
}
