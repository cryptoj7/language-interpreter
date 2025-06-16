-- CreateTable
CREATE TABLE "Action" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "parameters" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'detected',
    "webhookUrl" TEXT,
    "webhookStatus" INTEGER,
    "webhookResponse" TEXT,
    "errorMessage" TEXT,
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executedAt" DATETIME,
    "completedAt" DATETIME,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Action_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_utterances" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "originalLang" TEXT NOT NULL,
    "translatedText" TEXT,
    "timestamp" DATETIME NOT NULL,
    "audioUrl" TEXT,
    CONSTRAINT "utterances_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_utterances" ("audioUrl", "conversationId", "id", "originalLang", "role", "text", "timestamp", "translatedText") SELECT "audioUrl", "conversationId", "id", "originalLang", "role", "text", "timestamp", "translatedText" FROM "utterances";
DROP TABLE "utterances";
ALTER TABLE "new_utterances" RENAME TO "utterances";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Action_conversationId_idx" ON "Action"("conversationId");

-- CreateIndex
CREATE INDEX "Action_status_idx" ON "Action"("status");

-- CreateIndex
CREATE INDEX "Action_actionType_idx" ON "Action"("actionType");
