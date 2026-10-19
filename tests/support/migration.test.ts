import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { isolatedPostgres } from '../helpers/postgres'
import { assertDatabaseReady } from '@server/src/db/schema-check'

it('migrates the feedback model with attempt and byte lifecycle constraints', async () => {
  const isolated = await isolatedPostgres()
  try {
    await assertDatabaseReady(isolated.db, isolated.schema, isolated.schema)
    const tables = await isolated.db.query<{ tablename: string }>(
      'SELECT tablename FROM pg_tables WHERE schemaname=$1 AND tablename LIKE $2',
      [isolated.schema, 'support_feedback_%'],
    )
    expect(tables.rows.map((row) => row.tablename).sort()).toEqual([
      'support_feedback_attachments',
      'support_feedback_submissions',
    ])
    const id = '11111111-1111-4111-8111-111111111111'
    await isolated.db.query(
      "INSERT INTO auth_users(id,email,nickname,password_hash,created_at) VALUES ($1,'support@test.invalid','测试','hash',1)",
      [id],
    )
    const values = [id, id, id, '{}', '0'.repeat(64), '{}', '1'.repeat(64)]
    await isolated.db.query(
      `INSERT INTO support_feedback_submissions(id,user_id,submission_key,nickname_snapshot,form_kind,form_version,content_rule_version,form_json,user_markdown,final_markdown,payload_sha256,task_payload_json,task_payload_sha256,revision,status,attachment_count,total_attachment_bytes,created_at,receive_expires_at,updated_at,target_list_id) VALUES ($1,$2,$3,'测试','request',2,1,$4,'文字','文字',$5,$6,$7,0,'receiving',1,1,1,86400001,1,'901810170816')`,
      values,
    )
    await expect(
      isolated.db.query(
        `INSERT INTO support_feedback_attachments(submission_id,id,ordinal,original_name,content_type,byte_length,sha256,status,created_at,updated_at) VALUES($1,$2,0,'a','text/plain',0,$3,'expected',1,1)`,
        [id, id, '0'.repeat(64)],
      ),
    ).rejects.toThrow()
    await isolated.db.query(
      `INSERT INTO support_feedback_attachments(submission_id,id,ordinal,original_name,content_type,byte_length,sha256,status,created_at,updated_at) VALUES($1,$2,0,'a','text/plain',1,$3,'expected',1,1)`,
      [id, id, '0'.repeat(64)],
    )
    await expect(
      isolated.db.query(
        "UPDATE support_feedback_attachments SET status='uploaded' WHERE submission_id=$1",
        [id],
      ),
    ).rejects.toThrow()
    await expect(
      isolated.db.query("UPDATE support_feedback_submissions SET status='completed' WHERE id=$1", [
        id,
      ]),
    ).rejects.toThrow()
    await expect(
      isolated.db.query('UPDATE support_feedback_submissions SET attempt_id=$1 WHERE id=$1', [id]),
    ).rejects.toThrow()
  } finally {
    await isolated.close()
  }
}, 90000)

it('removes only legacy feedback rows when applying the v2 migration', async () => {
  const isolated = await isolatedPostgres({ migrate: false })
  try {
    const sql = (name: string) =>
      readFileSync(new URL(`../../apps/server/drizzle/${name}.sql`, import.meta.url), 'utf8')
        .split('--> statement-breakpoint')
        .map((statement) => statement.trim())
        .filter(Boolean)
    for (const name of [
      '0000_charming_ted_forrester',
      '0001_safe_firebird',
      '0002_persistent_notifications',
      '0003_support_feedback',
    ])
      for (const statement of sql(name)) await isolated.db.query(statement)
    const id = '11111111-1111-4111-8111-111111111111'
    await isolated.db.query(
      "INSERT INTO auth_users(id,email,nickname,password_hash,created_at) VALUES ($1,'preserved@test.invalid','保留','hash',1)",
      [id],
    )
    await isolated.db.query(
      `INSERT INTO support_feedback_submissions(id,user_id,submission_key,nickname_snapshot,form_kind,form_version,content_rule_version,form_json,user_markdown,final_markdown,payload_sha256,revision,status,attachment_count,total_attachment_bytes,created_at,receive_expires_at,updated_at,target_list_id) VALUES ($1,$1,$1,'旧记录','request',1,1,'{}','文字','文字',$2,0,'receiving',1,1,1,86400001,1,'901810170816')`,
      [id, '0'.repeat(64)],
    )
    await isolated.db.query(
      `INSERT INTO support_feedback_attachments(submission_id,id,ordinal,original_name,content_type,byte_length,sha256,status,created_at,updated_at) VALUES($1,$1,0,'a','text/plain',1,$2,'expected',1,1)`,
      [id, '0'.repeat(64)],
    )
    for (const statement of sql('0004_living_rachel_grey')) await isolated.db.query(statement)
    expect(
      (await isolated.db.query('SELECT id FROM auth_users WHERE id=$1', [id])).rows,
    ).toHaveLength(1)
    expect(
      (await isolated.db.query('SELECT id FROM support_feedback_submissions')).rows,
    ).toHaveLength(0)
    expect(
      (await isolated.db.query('SELECT id FROM support_feedback_attachments')).rows,
    ).toHaveLength(0)
  } finally {
    await isolated.close()
  }
}, 90000)

it('keeps v2 submissions and attachments while enabling only v3 community kinds', async () => {
  const isolated = await isolatedPostgres({ migrate: false })
  try {
    const sql = (name: string) =>
      readFileSync(new URL(`../../apps/server/drizzle/${name}.sql`, import.meta.url), 'utf8')
        .split('--> statement-breakpoint')
        .map((statement) => statement.trim())
        .filter(Boolean)
    for (const name of [
      '0000_charming_ted_forrester',
      '0001_safe_firebird',
      '0002_persistent_notifications',
      '0003_support_feedback',
      '0004_living_rachel_grey',
    ])
      for (const statement of sql(name)) await isolated.db.query(statement)
    const userId = '11111111-1111-4111-8111-111111111111'
    const oldId = '22222222-2222-4222-8222-222222222222'
    const newId = '33333333-3333-4333-8333-333333333333'
    await isolated.db.query(
      "INSERT INTO auth_users(id,email,nickname,password_hash,created_at) VALUES ($1,'migration@test.invalid','保留','hash',1)",
      [userId],
    )
    const insert = (id: string, kind: string, version: number, attachments = 0) =>
      isolated.db.query(
        `INSERT INTO support_feedback_submissions(id,user_id,submission_key,nickname_snapshot,form_kind,form_version,content_rule_version,form_json,user_markdown,final_markdown,payload_sha256,task_payload_json,task_payload_sha256,revision,status,attachment_count,total_attachment_bytes,created_at,receive_expires_at,updated_at,target_list_id) VALUES($1,$2,$1,'保留',$3,$4,1,'{}','文字','文字',$5,'{}',$6,0,'receiving',$7,$8,1,86400001,1,'901810170816')`,
        [id, userId, kind, version, '0'.repeat(64), '1'.repeat(64), attachments, attachments],
      )
    await insert(oldId, 'request', 2, 1)
    await isolated.db.query(
      `INSERT INTO support_feedback_attachments(submission_id,id,ordinal,original_name,content_type,byte_length,sha256,status,created_at,updated_at) VALUES($1,$1,0,'a','text/plain',1,$2,'expected',1,1)`,
      [oldId, '0'.repeat(64)],
    )
    for (const statement of sql('0005_exotic_synch')) await isolated.db.query(statement)
    expect(
      (
        await isolated.db.query(
          'SELECT id,form_kind,form_version FROM support_feedback_submissions WHERE id=$1',
          [oldId],
        )
      ).rows,
    ).toMatchObject([{ id: oldId, form_kind: 'request', form_version: 2 }])
    expect(
      (
        await isolated.db.query(
          'SELECT id FROM support_feedback_attachments WHERE submission_id=$1',
          [oldId],
        )
      ).rows,
    ).toMatchObject([{ id: oldId }])
    await insert(newId, 'complaint', 3)
    await expect(insert('44444444-4444-4444-8444-444444444444', 'complaint', 2)).rejects.toThrow()
    await expect(insert('55555555-5555-4555-8555-555555555555', 'request', 3)).rejects.toThrow()
  } finally {
    await isolated.close()
  }
}, 90000)
