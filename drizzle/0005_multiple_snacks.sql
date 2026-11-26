CREATE TABLE "snacks" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"time" text NOT NULL,
	"food" text NOT NULL,
	"amount" text,
	"created_by" integer NOT NULL,
	"updated_by" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "snacks" ADD CONSTRAINT "snacks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snacks" ADD CONSTRAINT "snacks_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Carry over snacks saved in the old once-a-day format.
INSERT INTO "snacks" ("date", "time", "food", "amount", "created_by", "updated_by", "created_at", "updated_at") SELECT "date", "time", COALESCE("food", ''), "amount", "updated_by", "updated_by", "updated_at", "updated_at" FROM "log_slots" WHERE "slot" = 'snack';--> statement-breakpoint
DELETE FROM "log_slots" WHERE "slot" = 'snack';
