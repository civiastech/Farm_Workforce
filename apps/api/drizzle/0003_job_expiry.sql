ALTER TABLE "jobs" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "jobs_status_expires_idx" ON "jobs" USING btree ("status","expires_at");--> statement-breakpoint
-- Jobs already open get a full listing period from today, rather than all closing at once on deploy.
UPDATE "jobs" SET "expires_at" = now() + interval '30 days' WHERE "status" = 'open';
