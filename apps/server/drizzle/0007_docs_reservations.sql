CREATE TABLE "docs_attachments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"document_id" uuid NOT NULL,
	"medium" text NOT NULL,
	"storage_key" text NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"sha256" text NOT NULL,
	"created_at" bigint NOT NULL,
	"created_by_user_id" text NOT NULL,
	CONSTRAINT "docs_attachments_medium_check" CHECK ("docs_attachments"."medium" in ('file', 'cos')),
	CONSTRAINT "docs_attachments_file_name_check" CHECK (char_length("docs_attachments"."file_name") between 1 and 255),
	CONSTRAINT "docs_attachments_byte_size_check" CHECK ("docs_attachments"."byte_size" >= 1 and "docs_attachments"."byte_size" <= 9007199254740991),
	CONSTRAINT "docs_attachments_sha256_check" CHECK ("docs_attachments"."sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "docs_comments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"document_id" uuid NOT NULL,
	"body" text NOT NULL,
	"version" bigint NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"created_by_user_id" text NOT NULL,
	"updated_by_user_id" text NOT NULL,
	CONSTRAINT "docs_comments_body_check" CHECK (char_length("docs_comments"."body") between 1 and 10000),
	CONSTRAINT "docs_comments_version_check" CHECK ("docs_comments"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "docs_templates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"space_id" uuid NOT NULL,
	"name" text NOT NULL,
	"content_schema_version" integer NOT NULL,
	"content" jsonb NOT NULL,
	"version" bigint NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"created_by_user_id" text NOT NULL,
	"updated_by_user_id" text NOT NULL,
	CONSTRAINT "docs_templates_name_check" CHECK (char_length("docs_templates"."name") between 1 and 100),
	CONSTRAINT "docs_templates_content_schema_version_check" CHECK ("docs_templates"."content_schema_version" = 1),
	CONSTRAINT "docs_templates_content_check" CHECK (jsonb_typeof("docs_templates"."content") = 'object' and "docs_templates"."content" ->> 'type' = 'doc'),
	CONSTRAINT "docs_templates_version_check" CHECK ("docs_templates"."version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "docs_attachments" ADD CONSTRAINT "docs_attachments_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "docs_documents"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "docs_attachments" ADD CONSTRAINT "docs_attachments_created_by_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "auth_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docs_comments" ADD CONSTRAINT "docs_comments_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "docs_documents"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "docs_comments" ADD CONSTRAINT "docs_comments_created_by_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "auth_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docs_comments" ADD CONSTRAINT "docs_comments_updated_by_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "auth_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docs_templates" ADD CONSTRAINT "docs_templates_space_id_fk" FOREIGN KEY ("space_id") REFERENCES "docs_spaces"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "docs_templates" ADD CONSTRAINT "docs_templates_created_by_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "auth_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docs_templates" ADD CONSTRAINT "docs_templates_updated_by_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "auth_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "docs_attachments_medium_storage_key_unique" ON "docs_attachments" USING btree ("medium","storage_key");--> statement-breakpoint
CREATE INDEX "docs_attachments_document_id_created_at_idx" ON "docs_attachments" USING btree ("document_id","created_at","id");--> statement-breakpoint
CREATE INDEX "docs_comments_document_id_created_at_idx" ON "docs_comments" USING btree ("document_id","created_at","id");--> statement-breakpoint
CREATE INDEX "docs_templates_space_id_created_at_idx" ON "docs_templates" USING btree ("space_id","created_at","id");