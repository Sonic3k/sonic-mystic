CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disciplines" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"ready" boolean DEFAULT false NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"source_id" integer NOT NULL,
	"parent_id" integer,
	"code" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"source_ref" integer,
	"ordinal" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entry_symbols" (
	"entry_id" integer NOT NULL,
	"symbol_id" integer NOT NULL,
	"ordinal" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "entry_symbols_entry_id_symbol_id_pk" PRIMARY KEY("entry_id","symbol_id")
);
--> statement-breakpoint
CREATE TABLE "entry_table_rows" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "entry_table_rows_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"table_id" integer NOT NULL,
	"ordinal" integer NOT NULL,
	"cells" text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entry_tables" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "entry_tables_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"entry_id" integer NOT NULL,
	"key" text NOT NULL,
	"ordinal" smallint DEFAULT 0 NOT NULL,
	"title" text,
	"columns" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "imports" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "imports_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"discipline_code" text NOT NULL,
	"bundle_version" text NOT NULL,
	"written" integer DEFAULT 0 NOT NULL,
	"kept_edited" integer DEFAULT 0 NOT NULL,
	"removed" integer DEFAULT 0 NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "outbox_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"topic" text NOT NULL,
	"system" text NOT NULL,
	"external_id" text NOT NULL,
	"discipline_code" text NOT NULL,
	"subject_id" uuid,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "passages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"entry_id" integer NOT NULL,
	"key" text NOT NULL,
	"ordinal" integer NOT NULL,
	"kind" text NOT NULL,
	"section" text,
	"source_ref" integer,
	"original_text" text NOT NULL,
	"text" text NOT NULL,
	"search_text" text NOT NULL,
	"edited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_id" uuid NOT NULL,
	"discipline_code" text NOT NULL,
	"label" text,
	"view_year" smallint,
	"gender" text NOT NULL,
	"birth_calendar" text DEFAULT 'solar' NOT NULL,
	"birth_year" smallint,
	"birth_month" smallint,
	"birth_day" smallint,
	"birth_leap_month" boolean DEFAULT false NOT NULL,
	"birth_time" text,
	"birth_hour_branch" smallint,
	"birth_time_approx" boolean DEFAULT false NOT NULL,
	"birth_time_zone" text,
	"birth_utc_offset_minutes" smallint,
	"birth_place" text,
	"birth_latitude" double precision,
	"birth_longitude" double precision,
	"engine_version" text NOT NULL,
	"knowledge_version" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reading_item_refs" (
	"item_id" integer NOT NULL,
	"rule_code" text NOT NULL,
	"rule_id" integer,
	"quoted_text" text NOT NULL,
	CONSTRAINT "reading_item_refs_item_id_rule_code_pk" PRIMARY KEY("item_id","rule_code")
);
--> statement-breakpoint
CREATE TABLE "reading_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reading_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"section_id" integer NOT NULL,
	"ordinal" smallint NOT NULL,
	"layer" text NOT NULL,
	"text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reading_sections" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reading_sections_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"reading_id" uuid NOT NULL,
	"ordinal" smallint NOT NULL,
	"title" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "readings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"scope" text NOT NULL,
	"view_year" smallint NOT NULL,
	"author" text DEFAULT 'ai' NOT NULL,
	"model" text,
	"input_hash" text,
	"caution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rule_symbols" (
	"rule_id" integer NOT NULL,
	"symbol_id" integer NOT NULL,
	CONSTRAINT "rule_symbols_rule_id_symbol_id_pk" PRIMARY KEY("rule_id","symbol_id")
);
--> statement-breakpoint
CREATE TABLE "rule_targets" (
	"rule_id" integer NOT NULL,
	"target" text NOT NULL,
	"ordinal" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "rule_targets_rule_id_target_pk" PRIMARY KEY("rule_id","target")
);
--> statement-breakpoint
CREATE TABLE "rules" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rules_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"discipline_code" text NOT NULL,
	"code" text NOT NULL,
	"source_id" integer NOT NULL,
	"entry_id" integer NOT NULL,
	"passage_id" integer,
	"symbol_id" integer,
	"ordinal" integer NOT NULL,
	"original_text" text NOT NULL,
	"text" text NOT NULL,
	"context" text,
	"condition" text,
	"tone" text NOT NULL,
	"review_note" text,
	"active" boolean DEFAULT true NOT NULL,
	"edited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rules_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sources_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"discipline_code" text NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"author" text,
	"kind" text NOT NULL,
	"description" text,
	"source_file" text,
	"note" text,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sources_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "subject_links" (
	"system" text NOT NULL,
	"external_id" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"owns_identity" boolean DEFAULT true NOT NULL,
	"synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subject_links_system_external_id_pk" PRIMARY KEY("system","external_id")
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"gender" text,
	"birth_calendar" text DEFAULT 'solar' NOT NULL,
	"birth_year" smallint,
	"birth_month" smallint,
	"birth_day" smallint,
	"birth_leap_month" boolean DEFAULT false NOT NULL,
	"birth_time" text,
	"birth_hour_branch" smallint,
	"birth_time_approx" boolean DEFAULT false NOT NULL,
	"birth_time_zone" text,
	"birth_utc_offset_minutes" smallint,
	"birth_place" text,
	"birth_latitude" double precision,
	"birth_longitude" double precision,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "symbol_aliases" (
	"symbol_id" integer NOT NULL,
	"alias" text NOT NULL,
	CONSTRAINT "symbol_aliases_symbol_id_alias_pk" PRIMARY KEY("symbol_id","alias")
);
--> statement-breakpoint
CREATE TABLE "symbol_dignities" (
	"symbol_id" integer NOT NULL,
	"position" text NOT NULL,
	"level" text NOT NULL,
	"source_id" integer,
	CONSTRAINT "symbol_dignities_symbol_id_position_pk" PRIMARY KEY("symbol_id","position")
);
--> statement-breakpoint
CREATE TABLE "symbol_group_aliases" (
	"group_id" integer NOT NULL,
	"alias" text NOT NULL,
	CONSTRAINT "symbol_group_aliases_group_id_alias_pk" PRIMARY KEY("group_id","alias")
);
--> statement-breakpoint
CREATE TABLE "symbol_group_members" (
	"group_id" integer NOT NULL,
	"symbol_id" integer NOT NULL,
	"ordinal" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "symbol_group_members_group_id_symbol_id_pk" PRIMARY KEY("group_id","symbol_id")
);
--> statement-breakpoint
CREATE TABLE "symbol_groups" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "symbol_groups_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"discipline_code" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"mode" text NOT NULL,
	"min_count" smallint,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "symbols" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "symbols_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"discipline_code" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"tone" text,
	"ring" text,
	"source_id" integer,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tuvi_profile_settings" (
	"profile_id" uuid PRIMARY KEY NOT NULL,
	"variant" text DEFAULT 'ba' NOT NULL,
	"leap_month" text DEFAULT 'same' NOT NULL,
	"ty_next_day" boolean DEFAULT true NOT NULL,
	"lunar_calendar" text DEFAULT 'auto' NOT NULL,
	"hour_basis" text DEFAULT 'clock' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "variants" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "variants_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"discipline_code" text NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"primary_text" text NOT NULL,
	"alternative_text" text NOT NULL,
	"primary_source_id" integer,
	"ordinal" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_parent_id_entries_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_symbols" ADD CONSTRAINT "entry_symbols_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_symbols" ADD CONSTRAINT "entry_symbols_symbol_id_symbols_id_fk" FOREIGN KEY ("symbol_id") REFERENCES "public"."symbols"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_table_rows" ADD CONSTRAINT "entry_table_rows_table_id_entry_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."entry_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_tables" ADD CONSTRAINT "entry_tables_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passages" ADD CONSTRAINT "passages_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_discipline_code_disciplines_code_fk" FOREIGN KEY ("discipline_code") REFERENCES "public"."disciplines"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_item_refs" ADD CONSTRAINT "reading_item_refs_item_id_reading_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."reading_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_item_refs" ADD CONSTRAINT "reading_item_refs_rule_id_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_items" ADD CONSTRAINT "reading_items_section_id_reading_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."reading_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_sections" ADD CONSTRAINT "reading_sections_reading_id_readings_id_fk" FOREIGN KEY ("reading_id") REFERENCES "public"."readings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readings" ADD CONSTRAINT "readings_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_symbols" ADD CONSTRAINT "rule_symbols_rule_id_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_symbols" ADD CONSTRAINT "rule_symbols_symbol_id_symbols_id_fk" FOREIGN KEY ("symbol_id") REFERENCES "public"."symbols"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_targets" ADD CONSTRAINT "rule_targets_rule_id_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rules" ADD CONSTRAINT "rules_discipline_code_disciplines_code_fk" FOREIGN KEY ("discipline_code") REFERENCES "public"."disciplines"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rules" ADD CONSTRAINT "rules_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rules" ADD CONSTRAINT "rules_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rules" ADD CONSTRAINT "rules_passage_id_passages_id_fk" FOREIGN KEY ("passage_id") REFERENCES "public"."passages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rules" ADD CONSTRAINT "rules_symbol_id_symbols_id_fk" FOREIGN KEY ("symbol_id") REFERENCES "public"."symbols"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_discipline_code_disciplines_code_fk" FOREIGN KEY ("discipline_code") REFERENCES "public"."disciplines"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subject_links" ADD CONSTRAINT "subject_links_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "symbol_aliases" ADD CONSTRAINT "symbol_aliases_symbol_id_symbols_id_fk" FOREIGN KEY ("symbol_id") REFERENCES "public"."symbols"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "symbol_dignities" ADD CONSTRAINT "symbol_dignities_symbol_id_symbols_id_fk" FOREIGN KEY ("symbol_id") REFERENCES "public"."symbols"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "symbol_dignities" ADD CONSTRAINT "symbol_dignities_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "symbol_group_aliases" ADD CONSTRAINT "symbol_group_aliases_group_id_symbol_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."symbol_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "symbol_group_members" ADD CONSTRAINT "symbol_group_members_group_id_symbol_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."symbol_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "symbol_group_members" ADD CONSTRAINT "symbol_group_members_symbol_id_symbols_id_fk" FOREIGN KEY ("symbol_id") REFERENCES "public"."symbols"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "symbol_groups" ADD CONSTRAINT "symbol_groups_discipline_code_disciplines_code_fk" FOREIGN KEY ("discipline_code") REFERENCES "public"."disciplines"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "symbols" ADD CONSTRAINT "symbols_discipline_code_disciplines_code_fk" FOREIGN KEY ("discipline_code") REFERENCES "public"."disciplines"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "symbols" ADD CONSTRAINT "symbols_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tuvi_profile_settings" ADD CONSTRAINT "tuvi_profile_settings_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_discipline_code_disciplines_code_fk" FOREIGN KEY ("discipline_code") REFERENCES "public"."disciplines"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_primary_source_id_sources_id_fk" FOREIGN KEY ("primary_source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "entries_source_code" ON "entries" USING btree ("source_id","code");--> statement-breakpoint
CREATE INDEX "entries_source_ordinal" ON "entries" USING btree ("source_id","ordinal");--> statement-breakpoint
CREATE INDEX "entry_symbols_symbol" ON "entry_symbols" USING btree ("symbol_id");--> statement-breakpoint
CREATE UNIQUE INDEX "entry_table_rows_table_ordinal" ON "entry_table_rows" USING btree ("table_id","ordinal");--> statement-breakpoint
CREATE UNIQUE INDEX "entry_tables_entry_key" ON "entry_tables" USING btree ("entry_id","key");--> statement-breakpoint
CREATE INDEX "outbox_due" ON "outbox" USING btree ("sent_at","next_attempt_at");--> statement-breakpoint
CREATE UNIQUE INDEX "passages_entry_key" ON "passages" USING btree ("entry_id","key");--> statement-breakpoint
CREATE INDEX "passages_entry_ordinal" ON "passages" USING btree ("entry_id","ordinal");--> statement-breakpoint
CREATE INDEX "profiles_subject" ON "profiles" USING btree ("subject_id","discipline_code","created_at");--> statement-breakpoint
CREATE INDEX "reading_items_section" ON "reading_items" USING btree ("section_id","ordinal");--> statement-breakpoint
CREATE INDEX "reading_sections_reading" ON "reading_sections" USING btree ("reading_id","ordinal");--> statement-breakpoint
CREATE UNIQUE INDEX "readings_profile_scope_year" ON "readings" USING btree ("profile_id","scope","view_year");--> statement-breakpoint
CREATE INDEX "rule_symbols_symbol" ON "rule_symbols" USING btree ("symbol_id");--> statement-breakpoint
CREATE INDEX "rules_source" ON "rules" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "rules_entry" ON "rules" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "rules_passage" ON "rules" USING btree ("passage_id");--> statement-breakpoint
CREATE INDEX "subject_links_subject" ON "subject_links" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "subjects_account" ON "subjects" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "symbol_groups_discipline_code" ON "symbol_groups" USING btree ("discipline_code","code");--> statement-breakpoint
CREATE UNIQUE INDEX "symbols_discipline_code" ON "symbols" USING btree ("discipline_code","code");--> statement-breakpoint
CREATE UNIQUE INDEX "variants_discipline_code" ON "variants" USING btree ("discipline_code","code");