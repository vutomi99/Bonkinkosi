-- CreateTable
CREATE TABLE "Endpoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Analyst" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "attackType" TEXT NOT NULL,
    "riskScore" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'New',
    "assignedAnalystId" TEXT,
    "cpuUsage" REAL NOT NULL,
    "networkBytes" INTEGER NOT NULL,
    "failedLogins" INTEGER NOT NULL,
    "connectionsPerMin" REAL NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'simulated',
    "sourceIp" TEXT,
    "incidentId" TEXT,
    "emailStatus" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Alert_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "Endpoint" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Alert_assignedAnalystId_fkey" FOREIGN KEY ("assignedAnalystId") REFERENCES "Analyst" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Alert_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "endpointId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Incident_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "Endpoint" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TimelineEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "alertId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TimelineEntry_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "openCount" INTEGER NOT NULL,
    "investigating" INTEGER NOT NULL,
    "contained" INTEGER NOT NULL,
    "resolved" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Endpoint_code_key" ON "Endpoint"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Analyst_email_key" ON "Analyst"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Alert_eventId_key" ON "Alert"("eventId");

-- CreateIndex
CREATE INDEX "Alert_status_idx" ON "Alert"("status");

-- CreateIndex
CREATE INDEX "Alert_riskScore_idx" ON "Alert"("riskScore");

-- CreateIndex
CREATE INDEX "Alert_endpointId_idx" ON "Alert"("endpointId");

-- CreateIndex
CREATE INDEX "Alert_incidentId_idx" ON "Alert"("incidentId");

-- CreateIndex
CREATE INDEX "Incident_endpointId_idx" ON "Incident"("endpointId");

-- CreateIndex
CREATE INDEX "TimelineEntry_alertId_idx" ON "TimelineEntry"("alertId");
