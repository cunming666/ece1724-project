ALTER TABLE "CheckinLog" ADD COLUMN "successfulKey" TEXT;

CREATE UNIQUE INDEX "CheckinLog_successfulKey_key" ON "CheckinLog"("successfulKey");
CREATE UNIQUE INDEX "Registration_eventId_waitlistPosition_key" ON "Registration"("eventId", "waitlistPosition");
