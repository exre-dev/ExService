CREATE TABLE "docs_documents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"space_id" uuid NOT NULL,
	"parent_id" uuid,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"content_schema_version" integer NOT NULL,
	"content" jsonb NOT NULL,
	"text_content" text NOT NULL,
	"version" bigint NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"created_by_user_id" text NOT NULL,
	"updated_by_user_id" text NOT NULL,
	"deleted_at" bigint,
	"deleted_by_user_id" text,
	"deletion_batch_id" uuid,
	"deletion_root_id" uuid,
	CONSTRAINT "docs_documents_not_self_parent_check" CHECK ("docs_documents"."id" <> "docs_documents"."parent_id"),
	CONSTRAINT "docs_documents_title_check" CHECK (char_length("docs_documents"."title") between 1 and 200),
	CONSTRAINT "docs_documents_position_check" CHECK ("docs_documents"."position" >= 0),
	CONSTRAINT "docs_documents_content_schema_version_check" CHECK ("docs_documents"."content_schema_version" = 1),
	CONSTRAINT "docs_documents_content_check" CHECK (jsonb_typeof("docs_documents"."content") = 'object' and "docs_documents"."content" ->> 'type' = 'doc'),
	CONSTRAINT "docs_documents_text_content_check" CHECK (octet_length("docs_documents"."text_content") <= 8388608),
	CONSTRAINT "docs_documents_version_check" CHECK ("docs_documents"."version" >= 1),
	CONSTRAINT "docs_documents_deletion_tuple_check" CHECK (("docs_documents"."deleted_at" is null and "docs_documents"."deleted_by_user_id" is null and "docs_documents"."deletion_batch_id" is null and "docs_documents"."deletion_root_id" is null)
    or ("docs_documents"."deleted_at" is not null and "docs_documents"."deleted_by_user_id" is not null and "docs_documents"."deletion_batch_id" is not null and "docs_documents"."deletion_root_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "docs_spaces" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"version" bigint NOT NULL,
	"tree_version" bigint NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"created_by_user_id" text NOT NULL,
	"updated_by_user_id" text NOT NULL,
	CONSTRAINT "docs_spaces_name_check" CHECK (char_length("docs_spaces"."name") between 1 and 100),
	CONSTRAINT "docs_spaces_description_check" CHECK (char_length("docs_spaces"."description") <= 2000),
	CONSTRAINT "docs_spaces_version_check" CHECK ("docs_spaces"."version" >= 1),
	CONSTRAINT "docs_spaces_tree_version_check" CHECK ("docs_spaces"."tree_version" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "docs_documents_space_id_id_unique" ON "docs_documents" USING btree ("space_id","id");--> statement-breakpoint
ALTER TABLE "docs_documents" ADD CONSTRAINT "docs_documents_space_id_fk" FOREIGN KEY ("space_id") REFERENCES "docs_spaces"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "docs_documents" ADD CONSTRAINT "docs_documents_parent_space_fk" FOREIGN KEY ("parent_id","space_id") REFERENCES "docs_documents"("id","space_id") ON DELETE no action ON UPDATE no action DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint
ALTER TABLE "docs_documents" ADD CONSTRAINT "docs_documents_deletion_root_id_fk" FOREIGN KEY ("deletion_root_id") REFERENCES "docs_documents"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "docs_documents" ADD CONSTRAINT "docs_documents_created_by_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "auth_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docs_documents" ADD CONSTRAINT "docs_documents_updated_by_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "auth_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docs_documents" ADD CONSTRAINT "docs_documents_deleted_by_user_id_fk" FOREIGN KEY ("deleted_by_user_id") REFERENCES "auth_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docs_spaces" ADD CONSTRAINT "docs_spaces_created_by_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "auth_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docs_spaces" ADD CONSTRAINT "docs_spaces_updated_by_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "auth_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "docs_documents_active_sibling_idx" ON "docs_documents" USING btree ("space_id","parent_id","position","id") WHERE "docs_documents"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "docs_documents_physical_idx" ON "docs_documents" USING btree ("space_id","parent_id","id");--> statement-breakpoint
CREATE INDEX "docs_documents_deletion_batch_idx" ON "docs_documents" USING btree ("space_id","deletion_batch_id","id");--> statement-breakpoint
CREATE INDEX "docs_documents_trash_root_idx" ON "docs_documents" USING btree ("space_id","deleted_at","id");--> statement-breakpoint
CREATE INDEX "docs_spaces_created_at_idx" ON "docs_spaces" USING btree ("created_at","id");