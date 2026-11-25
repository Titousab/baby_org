CREATE TABLE "age_overrides" (
	"place_id" integer NOT NULL,
	"title_key" text NOT NULL,
	"age_min" integer,
	"age_max" integer,
	"updated_by" integer,
	CONSTRAINT "age_overrides_place_id_title_key_pk" PRIMARY KEY("place_id","title_key")
);
--> statement-breakpoint
CREATE TABLE "class_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"place_id" integer NOT NULL,
	"source_id" integer NOT NULL,
	"external_id" text NOT NULL,
	"title" text NOT NULL,
	"date" date NOT NULL,
	"start_time" text NOT NULL,
	"duration_min" integer,
	"age_min" integer,
	"age_max" integer,
	"price_text" text,
	"status_text" text,
	"booking_url" text,
	CONSTRAINT "class_sessions_source_external" UNIQUE("source_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "host_fetches" (
	"host" text PRIMARY KEY NOT NULL,
	"last_fetch_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manual_classes" (
	"id" serial PRIMARY KEY NOT NULL,
	"place_id" integer NOT NULL,
	"title" text NOT NULL,
	"first_date" date NOT NULL,
	"start_time" text NOT NULL,
	"duration_min" integer NOT NULL,
	"age_min" integer,
	"age_max" integer,
	"price_text" text,
	"note" text,
	"booking_url" text,
	"repeats_weekly" boolean DEFAULT true NOT NULL,
	"until_date" date
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"kind" text NOT NULL,
	"website_url" text,
	"booking_url" text,
	"watch_url" text,
	"watch_hash" text,
	"watch_checked_at" timestamp with time zone,
	"watch_changed_at" timestamp with time zone,
	CONSTRAINT "places_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "program_info" (
	"source_id" integer NOT NULL,
	"title" text NOT NULL,
	"detail_url" text,
	"age_text" text,
	"age_min" integer,
	"age_max" integer,
	"duration_min" integer,
	"status_text" text,
	"fetched_at" timestamp with time zone,
	CONSTRAINT "program_info_source_id_title_pk" PRIMARY KEY("source_id","title")
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"place_id" integer NOT NULL,
	"adapter" text NOT NULL,
	"url" text NOT NULL,
	"last_success_at" timestamp with time zone,
	"last_attempt_at" timestamp with time zone,
	"last_error" text
);
--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "places_seeded" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "sync_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "age_overrides" ADD CONSTRAINT "age_overrides_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "age_overrides" ADD CONSTRAINT "age_overrides_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_classes" ADD CONSTRAINT "manual_classes_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_info" ADD CONSTRAINT "program_info_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;