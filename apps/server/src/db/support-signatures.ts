// Canonical PostgreSQL signatures from the feedback migration.
export const SUPPORT_CONSTRAINT_DEFINITIONS = new Map<string, string>([
  [
    'support_feedback_attachments.support_attachment_bytes_check',
    "CHECK (status = 'expected'::text AND bytes IS NULL AND remote_attachment_id IS NULL OR (status = ANY (ARRAY['received'::text, 'uploading'::text, 'failed'::text, 'verification_required'::text])) AND bytes IS NOT NULL AND octet_length(bytes) = byte_length AND remote_attachment_id IS NULL OR status = 'uploaded'::text AND remote_attachment_id IS NOT NULL AND bytes IS NULL)",
  ],
  [
    'support_feedback_attachments.support_attachment_length_check',
    'CHECK (byte_length >= 1 AND byte_length <= 20971520)',
  ],
  [
    'support_feedback_attachments.support_attachment_metadata_check',
    'CHECK (char_length(original_name) >= 1 AND char_length(original_name) <= 255 AND char_length(content_type) >= 1 AND char_length(content_type) <= 127 AND (remote_attachment_id IS NULL OR char_length(remote_attachment_id) >= 1 AND char_length(remote_attachment_id) <= 256))',
  ],
  [
    'support_feedback_attachments.support_attachment_ordinal_check',
    'CHECK (ordinal >= 0 AND ordinal <= 4)',
  ],
  [
    'support_feedback_attachments.support_attachment_sha_check',
    "CHECK (sha256 ~ '^[0-9a-f]{64}$'::text)",
  ],
  [
    'support_feedback_attachments.support_attachment_time_check',
    "CHECK (created_at >= 0 AND created_at <= '9007199254740991'::bigint AND updated_at >= created_at AND updated_at <= '9007199254740991'::bigint)",
  ],
  [
    'support_feedback_attachments.support_feedback_attachments_byte_length_not_null',
    'NOT NULL byte_length',
  ],
  [
    'support_feedback_attachments.support_feedback_attachments_content_type_not_null',
    'NOT NULL content_type',
  ],
  [
    'support_feedback_attachments.support_feedback_attachments_created_at_not_null',
    'NOT NULL created_at',
  ],
  ['support_feedback_attachments.support_feedback_attachments_id_not_null', 'NOT NULL id'],
  [
    'support_feedback_attachments.support_feedback_attachments_ordinal_not_null',
    'NOT NULL ordinal',
  ],
  [
    'support_feedback_attachments.support_feedback_attachments_original_name_not_null',
    'NOT NULL original_name',
  ],
  ['support_feedback_attachments.support_feedback_attachments_sha256_not_null', 'NOT NULL sha256'],
  ['support_feedback_attachments.support_feedback_attachments_status_not_null', 'NOT NULL status'],
  [
    'support_feedback_attachments.support_feedback_attachments_submission_id_id_pk',
    'PRIMARY KEY (submission_id, id)',
  ],
  [
    'support_feedback_attachments.support_feedback_attachments_submission_id_not_null',
    'NOT NULL submission_id',
  ],
  [
    'support_feedback_attachments.support_feedback_attachments_submission_id_support_feedback_sub',
    'FOREIGN KEY (submission_id) REFERENCES support_feedback_submissions(id) ON DELETE RESTRICT',
  ],
  [
    'support_feedback_attachments.support_feedback_attachments_updated_at_not_null',
    'NOT NULL updated_at',
  ],
  [
    'support_feedback_submissions.support_feedback_attempt_check',
    "CHECK (attempt_id IS NULL AND attempt_kind IS NULL AND attempt_attachment_id IS NULL AND attempt_started_at IS NULL AND attempt_expires_at IS NULL AND attempt_owner_boot_id IS NULL OR attempt_id IS NOT NULL AND attempt_kind IS NOT NULL AND attempt_owner_boot_id IS NOT NULL AND attempt_started_at IS NOT NULL AND attempt_expires_at IS NOT NULL AND attempt_started_at >= 0 AND attempt_started_at <= '9007199254740991'::bigint AND attempt_expires_at >= attempt_started_at AND attempt_expires_at <= '9007199254740991'::bigint AND (attempt_kind = 'create_task'::text AND attempt_attachment_id IS NULL OR attempt_kind = 'upload_attachment'::text AND attempt_attachment_id IS NOT NULL AND clickup_task_id IS NOT NULL))",
  ],
  [
    'support_feedback_submissions.support_feedback_completed_check',
    "CHECK (status <> 'completed'::text OR clickup_task_id IS NOT NULL AND attempt_id IS NULL AND failure_code IS NULL)",
  ],
  [
    'support_feedback_submissions.support_feedback_content_check',
    'CHECK (octet_length(user_markdown) >= 1 AND octet_length(user_markdown) <= 65536 AND octet_length(final_markdown) >= 1 AND octet_length(final_markdown) <= 66560)',
  ],
  [
    'support_feedback_submissions.support_feedback_count_check',
    'CHECK (attachment_count >= 0 AND attachment_count <= 5 AND total_attachment_bytes >= 0 AND total_attachment_bytes <= 104857600)',
  ],
  [
    'support_feedback_submissions.support_feedback_digest_check',
    "CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'::text)",
  ],
  [
    'support_feedback_submissions.support_feedback_task_payload_digest_check',
    "CHECK (task_payload_sha256 ~ '^[0-9a-f]{64}$'::text)",
  ],
  [
    'support_feedback_submissions.support_feedback_submissions_task_payload_json_not_null',
    'NOT NULL task_payload_json',
  ],
  [
    'support_feedback_submissions.support_feedback_submissions_task_payload_sha256_not_null',
    'NOT NULL task_payload_sha256',
  ],
  [
    'support_feedback_submissions.support_feedback_failure_check',
    "CHECK (failure_code IS NULL AND failure_phase IS NULL AND failure_attachment_id IS NULL AND retry_not_before IS NULL OR failure_code IS NOT NULL AND failure_phase IS NOT NULL AND (failure_code = ANY (ARRAY['UPSTREAM_REJECTED'::text, 'UPSTREAM_RATE_LIMITED'::text, 'UPSTREAM_CONFIGURATION'::text, 'UPSTREAM_UNKNOWN'::text])) AND (failure_phase = 'create_task'::text AND failure_attachment_id IS NULL OR failure_phase = 'upload_attachment'::text AND failure_attachment_id IS NOT NULL AND clickup_task_id IS NOT NULL))",
  ],
  [
    'support_feedback_submissions.support_feedback_form_check',
    "CHECK (((form_kind = ANY (ARRAY['bug'::text, 'feature'::text, 'asset'::text, 'request'::text, 'content'::text, 'campaign'::text])) AND form_version = 2 OR (form_kind = ANY (ARRAY['suggestion'::text, 'complaint'::text])) AND form_version = 3) AND content_rule_version = 1)",
  ],
  [
    'support_feedback_submissions.support_feedback_revision_check',
    "CHECK (revision >= 0 AND revision <= '9007199254740991'::bigint)",
  ],
  [
    'support_feedback_submissions.support_feedback_status_check',
    "CHECK (status = ANY (ARRAY['receiving'::text, 'ready'::text, 'creating'::text, 'uploading'::text, 'failed'::text, 'verification_required'::text, 'completed'::text]))",
  ],
  [
    'support_feedback_submissions.support_feedback_submissions_attachment_count_not_null',
    'NOT NULL attachment_count',
  ],
  [
    'support_feedback_submissions.support_feedback_submissions_content_rule_version_not_null',
    'NOT NULL content_rule_version',
  ],
  [
    'support_feedback_submissions.support_feedback_submissions_created_at_not_null',
    'NOT NULL created_at',
  ],
  [
    'support_feedback_submissions.support_feedback_submissions_final_markdown_not_null',
    'NOT NULL final_markdown',
  ],
  [
    'support_feedback_submissions.support_feedback_submissions_form_json_not_null',
    'NOT NULL form_json',
  ],
  [
    'support_feedback_submissions.support_feedback_submissions_form_kind_not_null',
    'NOT NULL form_kind',
  ],
  [
    'support_feedback_submissions.support_feedback_submissions_form_version_not_null',
    'NOT NULL form_version',
  ],
  ['support_feedback_submissions.support_feedback_submissions_id_not_null', 'NOT NULL id'],
  [
    'support_feedback_submissions.support_feedback_submissions_nickname_snapshot_not_null',
    'NOT NULL nickname_snapshot',
  ],
  [
    'support_feedback_submissions.support_feedback_submissions_payload_sha256_not_null',
    'NOT NULL payload_sha256',
  ],
  ['support_feedback_submissions.support_feedback_submissions_pkey', 'PRIMARY KEY (id)'],
  [
    'support_feedback_submissions.support_feedback_submissions_receive_expires_at_not_null',
    'NOT NULL receive_expires_at',
  ],
  [
    'support_feedback_submissions.support_feedback_submissions_revision_not_null',
    'NOT NULL revision',
  ],
  ['support_feedback_submissions.support_feedback_submissions_status_not_null', 'NOT NULL status'],
  [
    'support_feedback_submissions.support_feedback_submissions_submission_key_not_null',
    'NOT NULL submission_key',
  ],
  [
    'support_feedback_submissions.support_feedback_submissions_target_list_id_not_null',
    'NOT NULL target_list_id',
  ],
  [
    'support_feedback_submissions.support_feedback_submissions_total_attachment_bytes_not_null',
    'NOT NULL total_attachment_bytes',
  ],
  [
    'support_feedback_submissions.support_feedback_submissions_updated_at_not_null',
    'NOT NULL updated_at',
  ],
  [
    'support_feedback_submissions.support_feedback_submissions_user_id_auth_users_id_fk',
    'FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE RESTRICT',
  ],
  [
    'support_feedback_submissions.support_feedback_submissions_user_id_not_null',
    'NOT NULL user_id',
  ],
  [
    'support_feedback_submissions.support_feedback_submissions_user_markdown_not_null',
    'NOT NULL user_markdown',
  ],
  [
    'support_feedback_submissions.support_feedback_task_check',
    "CHECK (clickup_task_id IS NULL OR clickup_task_id ~ '^[A-Za-z0-9_-]{1,128}$'::text)",
  ],
  [
    'support_feedback_submissions.support_feedback_time_check',
    "CHECK (created_at >= 0 AND created_at <= '9007199168340991'::bigint AND receive_expires_at = (created_at + 86400000) AND updated_at >= created_at AND updated_at <= '9007199254740991'::bigint AND (retry_not_before IS NULL OR retry_not_before >= 0 AND retry_not_before <= '9007199254740991'::bigint))",
  ],
])
export const SUPPORT_INDEX_SIGNATURES = new Map<string, string>([
  [
    'support_feedback_attachments.support_attachment_ordinal_unique',
    'UNIQUE btree (submission_id, ordinal)',
  ],
  [
    'support_feedback_attachments.support_attachment_remote_unique',
    'UNIQUE btree (submission_id, remote_attachment_id)',
  ],
  [
    'support_feedback_attachments.support_feedback_attachments_submission_id_id_pk',
    'UNIQUE btree (submission_id, id)',
  ],
  [
    'support_feedback_submissions.support_feedback_key_unique',
    'UNIQUE btree (user_id, submission_key)',
  ],
  ['support_feedback_submissions.support_feedback_submissions_pkey', 'UNIQUE btree (id)'],
  ['support_feedback_submissions.support_feedback_task_unique', 'UNIQUE btree (clickup_task_id)'],
  ['support_feedback_submissions.support_feedback_user_created_idx', 'btree (user_id, created_at)'],
])
