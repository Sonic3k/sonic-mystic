-- Readings weighed section by section, and readings of the person as a whole (no profile).
-- Every reading now names its person; the existing ones take their profile's.
ALTER TABLE "readings" ADD COLUMN "subject_id" uuid;--> statement-breakpoint
UPDATE "readings" SET "subject_id" = "profiles"."subject_id" FROM "profiles" WHERE "profiles"."id" = "readings"."profile_id";--> statement-breakpoint
ALTER TABLE "readings" ALTER COLUMN "subject_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "readings" ADD CONSTRAINT "readings_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readings" ALTER COLUMN "profile_id" DROP NOT NULL;--> statement-breakpoint
DROP INDEX "readings_profile_scope_year";--> statement-breakpoint
CREATE UNIQUE INDEX "readings_profile_scope_year" ON "readings" USING btree ("profile_id","scope","view_year") WHERE "readings"."profile_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "readings_subject_scope_year" ON "readings" USING btree ("subject_id","scope","view_year") WHERE "readings"."profile_id" is null;--> statement-breakpoint
CREATE INDEX "readings_subject" ON "readings" USING btree ("subject_id");--> statement-breakpoint
ALTER TABLE "reading_sections" ADD COLUMN "weight" text;--> statement-breakpoint
ALTER TABLE "reading_sections" ADD COLUMN "basis" text[];
