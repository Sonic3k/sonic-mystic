CREATE TABLE "numerology_profile_names" (
	"profile_id" uuid NOT NULL,
	"ordinal" smallint NOT NULL,
	"label" text,
	"text" text NOT NULL,
	"primary" boolean DEFAULT false NOT NULL,
	CONSTRAINT "numerology_profile_names_profile_id_ordinal_pk" PRIMARY KEY("profile_id","ordinal")
);
--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "gender" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "passages" ADD COLUMN "role" text;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "access" text DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "numerology_profile_names" ADD CONSTRAINT "numerology_profile_names_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;