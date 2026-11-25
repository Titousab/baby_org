CREATE TABLE "naps" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"created_by" integer NOT NULL,
	"updated_by" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nap_end_after_start" CHECK ("naps"."end_time" > "naps"."start_time")
);
--> statement-breakpoint
ALTER TABLE "naps" ADD CONSTRAINT "naps_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "naps" ADD CONSTRAINT "naps_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Carry over naps saved in the old single-slot format.
INSERT INTO "naps" ("date", "start_time", "end_time", "created_by", "updated_by", "updated_at") SELECT "date", "time", "end_time", "updated_by", "updated_by", "updated_at" FROM "log_slots" WHERE "slot" = 'nap' AND "end_time" IS NOT NULL AND "end_time" > "time";--> statement-breakpoint
DELETE FROM "log_slots" WHERE "slot" = 'nap';--> statement-breakpoint
ALTER TABLE "log_slots" DROP COLUMN "end_time";