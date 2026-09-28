// lib/correlate.js
//
// Implements FR-09: "correlate related security events from different
// monitoring sources... group the related events into a potential
// incident." Called right after every real Alert is created (from both
// the simulator's tick route and the live agent's ingestion route) - not
// a scheduled job, not applied retroactively to old data, and never
// touches seeded/sample data because there isn't any.
//
// Correlation rule: alerts on the SAME endpoint within CORRELATION_WINDOW_MINUTES
// of each other are "related" - a burst of different attack types against
// one host in a short window is exactly the multi-stage pattern (recon ->
// access attempt -> exfiltration) a real SOC correlation rule looks for.
// A lone alert with nothing else nearby stays standalone - no Incident
// row is created for it.

import { prisma } from "@/lib/prisma";
import { ALERT_INCLUDE } from "@/lib/alertInclude";

export const CORRELATION_WINDOW_MINUTES = 10;

/**
 * `newAlert` must already include its `endpoint` relation (needs
 * endpoint.code for the timeline message) and its own `id`/`endpointId`/
 * `createdAt`. Returns the alert re-fetched with the full include set
 * above, whether or not it ended up correlated, so callers can always use
 * the return value as the final response payload.
 */
export async function correlateAlert(newAlert) {
  const windowStart = new Date(newAlert.createdAt.getTime() - CORRELATION_WINDOW_MINUTES * 60000);

  const related = await prisma.alert.findMany({
    where: {
      endpointId: newAlert.endpointId,
      id: { not: newAlert.id },
      createdAt: { gte: windowStart },
    },
    orderBy: { createdAt: "asc" },
  });

  if (!related.length) {
    // Nothing nearby - stays a standalone alert, no Incident created.
    return prisma.alert.findUnique({ where: { id: newAlert.id }, include: ALERT_INCLUDE });
  }

  const alreadyGrouped = related.find((a) => a.incidentId);
  let incidentId;

  if (alreadyGrouped) {
    incidentId = alreadyGrouped.incidentId;
    await prisma.incident.update({ where: { id: incidentId }, data: { updatedAt: new Date() } });
  } else {
    const incident = await prisma.incident.create({ data: { endpointId: newAlert.endpointId } });
    incidentId = incident.id;
    // Bring the previously-standalone related alerts into the new incident too.
    await prisma.alert.updateMany({
      where: { id: { in: related.map((a) => a.id) } },
      data: { incidentId },
    });
    for (const a of related) {
      await prisma.timelineEntry.create({
        data: {
          alertId: a.id,
          text: `Correlated with a related event on ${newAlert.endpoint.code} into a new incident (${
            related.length + 1
          } events within ${CORRELATION_WINDOW_MINUTES} minutes).`,
        },
      });
    }
  }

  return prisma.alert.update({
    where: { id: newAlert.id },
    data: {
      incidentId,
      timeline: {
        create: {
          text: `Correlated with ${related.length} related event(s) on ${newAlert.endpoint.code} within the last ${CORRELATION_WINDOW_MINUTES} minutes.`,
        },
      },
    },
    include: ALERT_INCLUDE,
  });
}
