ALTER TABLE "naps" DROP CONSTRAINT "nap_end_after_start";--> statement-breakpoint
ALTER TABLE "naps" ALTER COLUMN "end_time" DROP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "naps_one_running_per_day" ON "naps" USING btree ("date") WHERE "naps"."end_time" is null;--> statement-breakpoint
ALTER TABLE "naps" ADD CONSTRAINT "nap_end_after_start" CHECK ("naps"."end_time" is null or "naps"."end_time" > "naps"."start_time");