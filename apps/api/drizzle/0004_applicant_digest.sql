ALTER TABLE "employer_profiles" ADD COLUMN "applicant_digest_at" timestamp with time zone;--> statement-breakpoint
-- Existing employers start from now, so the first summary after deploy covers only new applicants.
UPDATE "employer_profiles" SET "applicant_digest_at" = now();
