ALTER TABLE "passages" ADD COLUMN "voice" text;--> statement-breakpoint
ALTER TABLE "passages" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "passages" ADD COLUMN "source_text" text;--> statement-breakpoint
ALTER TABLE "passages" ADD COLUMN "items" jsonb;--> statement-breakpoint
ALTER TABLE "sources" DROP COLUMN "access";