import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { expect, it } from 'vitest'
import { openDatabase, type AppDatabase } from '@server/src/db/client'
import { runMigrations } from '@server/src/db/migration-runner'
import { content, normalizePrepare, sha256 } from '@server/src/domains/support/validation'
import { frozenTaskInput } from '@server/src/domains/support/metadata'
import { finalMarkdown } from '@server/src/domains/support/markdown'

it('runs the current maintenance CLI source with safe inspect output and explicit cleanup confirmation in an isolated public database', async () => {
  const images = JSON.parse(
    readFileSync(new URL('../../infra/runtime/images.lock.json', import.meta.url), 'utf8'),
  ) as { postgres: string }
  const cwd = fileURLToPath(new URL('../../apps/server/', import.meta.url))
  const entry = fileURLToPath(
    new URL('../../apps/server/src/cli/support-feedback.ts', import.meta.url),
  )
  const requireServer = createRequire(new URL('../../apps/server/package.json', import.meta.url))
  const tsx = pathToFileURL(requireServer.resolve('tsx')).href
  const temporary = mkdtempSync(join(tmpdir(), 'support-cli-source-'))
  const sourceConfig = join(temporary, 'tsconfig.json')
  const userId = randomUUID()
  const expiredId = randomUUID()
  const liveId = randomUUID()
  const attachmentId = randomUUID()
  const privateText = 'PRIVATE_CLI_BODY_should_never_be_printed'
  const privateNickname = 'PRIVATE_CLI_NICKNAME'
  const privateBytes = Buffer.from('PRIVATE_CLI_ATTACHMENT_BYTES')
  const cutoff = Date.now() - 1_000
  const expiredCreated = cutoff - 86_400_001
  const liveCreated = cutoff
  let container: StartedPostgreSqlContainer | undefined
  let db: AppDatabase | undefined
  try {
    // tsx executes the current CLI/dependencies directly; Common exports its
    // current source, so only the Server source alias needs a test mapping.
    writeFileSync(
      sourceConfig,
      JSON.stringify({
        extends: fileURLToPath(new URL('../../apps/server/tsconfig.json', import.meta.url)),
        compilerOptions: {
          paths: {
            '@server/*': [fileURLToPath(new URL('../../apps/server/*', import.meta.url))],
          },
        },
      }),
    )
    // Fresh container/public is necessary: the real CLI deliberately owns public,
    // so a test-only search_path override cannot stand in for its database boundary.
    container = await new PostgreSqlContainer(images.postgres).withDatabase('exre').start()
    const url = new URL(container.getConnectionUri())
    if (url.hostname === 'localhost') url.hostname = '127.0.0.1'
    const connectionString = url.href
    await runMigrations({ connectionString })
    db = await openDatabase({ connectionString })
    await db.query(
      'INSERT INTO auth_users(id,email,nickname,password_hash,created_at) VALUES ($1,$2,$3,$4,$5)',
      [
        userId,
        'private-cli-account@test.invalid',
        privateNickname,
        'test-only-password-hash',
        expiredCreated,
      ],
    )

    for (const [id, createdAt, attachments] of [
      [
        expiredId,
        expiredCreated,
        [
          {
            id: attachmentId,
            originalName: 'private-file.txt',
            contentType: 'text/plain',
            byteLength: privateBytes.byteLength,
            sha256: sha256(privateBytes),
          },
        ],
      ],
      [liveId, liveCreated, []],
    ] as const) {
      const input = normalizePrepare({
        submissionKey: randomUUID(),
        form: {
          kind: 'request',
          title: 'PRIVATE_CLI_TITLE',
          typeOptionId: null,
          largeFileInfo: null,
          contentText: privateText,
        },
        attachments: [...attachments],
      })
      const markdown = content(input.form)
      const taskPayload = JSON.stringify(
        frozenTaskInput(input.form, finalMarkdown(markdown, id), privateNickname, userId),
      )
      await db.query(
        `INSERT INTO support_feedback_submissions
        (id,user_id,submission_key,nickname_snapshot,form_kind,form_version,content_rule_version,form_json,user_markdown,final_markdown,payload_sha256,task_payload_json,task_payload_sha256,revision,status,attachment_count,total_attachment_bytes,created_at,receive_expires_at,updated_at,target_list_id)
        VALUES ($1,$2,$3,$4,'request',2,1,$5,$6,$7,$8,$9,$10,0,'receiving',$11,$12,$13,$14,$13,'901810170816')`,
        [
          id,
          userId,
          input.submissionKey,
          privateNickname,
          JSON.stringify(input.form),
          markdown,
          finalMarkdown(markdown, id),
          sha256(JSON.stringify(input)),
          taskPayload,
          sha256(taskPayload),
          input.attachments.length,
          input.attachments.reduce((sum, file) => sum + file.byteLength, 0),
          createdAt,
          createdAt + 86_400_000,
        ],
      )
    }
    await db.query(
      `INSERT INTO support_feedback_attachments
      (submission_id,id,ordinal,original_name,content_type,byte_length,sha256,bytes,status,created_at,updated_at)
      VALUES ($1,$2,0,'private-file.txt','text/plain',$3,$4,$5,'received',$6,$6)`,
      [
        expiredId,
        attachmentId,
        privateBytes.byteLength,
        sha256(privateBytes),
        privateBytes,
        expiredCreated,
      ],
    )

    // The child receives only OS essentials plus this explicit isolated DSN.
    // Inherited DATABASE_URL, CLICKUP_TOKEN, NODE_OPTIONS, and root .env are absent.
    const childEnv: NodeJS.ProcessEnv = {
      DATABASE_URL: connectionString,
      CLICKUP_TOKEN: '',
      NODE_ENV: 'test',
      TSX_TSCONFIG_PATH: sourceConfig,
    }
    for (const key of ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP', 'USERPROFILE']) {
      if (process.env[key] !== undefined) childEnv[key] = process.env[key]
    }
    const run = (...args: string[]) => {
      const child = spawnSync(process.execPath, ['--import', tsx, entry, ...args], {
        cwd,
        env: childEnv,
        encoding: 'utf8',
        timeout: 15_000,
        maxBuffer: 64 * 1024,
      })
      expect(child.error).toBeUndefined()
      expect(child.signal).toBeNull()
      for (const sensitive of [
        connectionString,
        privateText,
        privateNickname,
        privateBytes.toString(),
        'PRIVATE_CLI_TITLE',
        'private-cli-account@test.invalid',
        'test-only-password-hash',
        'CLICKUP_TOKEN',
      ]) {
        expect(child.stdout + child.stderr).not.toContain(sensitive)
      }
      return child
    }
    const before = (await db.query('SELECT * FROM support_feedback_submissions ORDER BY id')).rows
    const beforeAttachments = (
      await db.query('SELECT * FROM support_feedback_attachments ORDER BY id')
    ).rows
    const inspected = run('inspect', '--submission-id', expiredId)
    expect(inspected.status).toBe(0)
    expect(inspected.stderr).toBe('')
    expect(JSON.parse(inspected.stdout)).toEqual({
      id: expiredId,
      revision: 0,
      status: 'receiving',
      createdAt: expiredCreated,
      receiveExpiresAt: expiredCreated + 86_400_000,
      taskId: null,
      attempt: null,
      failure: null,
      attachments: [
        {
          id: attachmentId,
          ordinal: 0,
          byteLength: privateBytes.byteLength,
          sha256: sha256(privateBytes),
          status: 'received',
          remoteAttachmentId: null,
        },
      ],
      remote: null,
    })
    const dryRun = run('cleanup-expired', '--before', String(cutoff))
    expect(dryRun.status).toBe(0)
    expect(JSON.parse(dryRun.stdout)).toEqual({ applied: false, submissionIds: [expiredId] })
    expect((await db.query('SELECT * FROM support_feedback_submissions ORDER BY id')).rows).toEqual(
      before,
    )
    expect((await db.query('SELECT * FROM support_feedback_attachments ORDER BY id')).rows).toEqual(
      beforeAttachments,
    )

    const unconfirmed = run('cleanup-expired', '--before', String(cutoff), '--apply')
    expect(unconfirmed.status).toBe(1)
    expect(unconfirmed.stdout).toBe('')
    expect(unconfirmed.stderr).toContain('[support-feedback]')
    expect((await db.query('SELECT * FROM support_feedback_submissions ORDER BY id')).rows).toEqual(
      before,
    )
    expect((await db.query('SELECT * FROM support_feedback_attachments ORDER BY id')).rows).toEqual(
      beforeAttachments,
    )

    const confirmed = run('cleanup-expired', '--before', String(cutoff), '--apply', '--confirm')
    expect(confirmed.status).toBe(0)
    expect(JSON.parse(confirmed.stdout)).toEqual({ applied: true, submissionIds: [expiredId] })
    expect((await db.query('SELECT * FROM support_feedback_submissions ORDER BY id')).rows).toEqual(
      before.filter((row) => row.id === liveId),
    )
    expect((await db.query('SELECT * FROM support_feedback_attachments')).rows).toEqual([])
    expect((await db.query('SELECT id FROM auth_users WHERE id=$1', [userId])).rows).toEqual([
      { id: userId },
    ])
  } finally {
    try {
      await db?.close()
    } finally {
      try {
        await container?.stop()
      } finally {
        if (
          resolve(temporary, '..') !== resolve(tmpdir()) ||
          !basename(temporary).startsWith('support-cli-source-')
        )
          throw new Error('Invalid test cleanup target')
        rmSync(temporary, { recursive: true, force: true })
      }
    }
  }
}, 90_000)
