CREATE TABLE "seed_classes_applied" (
	"key" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
ALTER TABLE "host_fetches" ADD COLUMN "robots_txt" text;--> statement-breakpoint
ALTER TABLE "host_fetches" ADD COLUMN "robots_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "host_fetches" ADD COLUMN "blocked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "ever_had_entries" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- "Full" used to be copied to every session of a program; it now marks only the session it was read from.
UPDATE "program_info" SET "status_text" = NULL WHERE "status_text" = 'Full';--> statement-breakpoint
UPDATE "class_sessions" SET "status_text" = NULL WHERE "status_text" = 'Full';
