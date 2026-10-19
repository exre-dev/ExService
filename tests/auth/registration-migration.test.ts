import { expect, it } from 'vitest'
import { isolatedPostgres } from '@tests/helpers/postgres'

it('starts from the current auth model without retaining legacy registration secrets', async () => {
  const fixture = await isolatedPostgres()
  try {
    const { db, schema } = fixture
    const { rows: legacy } = await db.query<{ table_name: string }>(
      'SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name = ANY($2::text[])',
      [schema, ['auth_registrations', 'auth_email_delivery']],
    )
    expect(legacy).toEqual([])
    const userId = '10000000-0000-4000-8000-000000000001'
    await db.query(
      'INSERT INTO auth_users (id,email,nickname,password_hash,created_at,qq) VALUES ($1,$2,$3,$4,$5,$6)',
      [userId, 'member@example.com', 'Member', 'password-hash', 100, '00123'],
    )
    await db.query(
      'INSERT INTO auth_sessions (token_hash,user_id,created_at,expires_at) VALUES ($1,$2,$3,$4)',
      ['session-hash', userId, 100, 1000],
    )
    await db.query(
      'INSERT INTO auth_sso_requests (id_hash,created_at,expires_at,status,user_id,completed_at) VALUES ($1,$2,$3,$4,$5,$6)',
      ['sso-hash', 100, 1000, 'completed', userId, 101],
    )
    expect(
      (await db.query<{ qq: string }>('SELECT qq FROM auth_users WHERE id = $1', [userId])).rows,
    ).toEqual([{ qq: '00123' }])
    expect((await db.query<{ user_id: string }>('SELECT user_id FROM auth_sessions')).rows).toEqual(
      [{ user_id: userId }],
    )
    expect(
      (await db.query<{ user_id: string }>('SELECT user_id FROM auth_sso_requests')).rows,
    ).toEqual([{ user_id: userId }])
    await expect(
      db.query(
        'INSERT INTO auth_users (id,email,nickname,password_hash,created_at) VALUES ($1,$2,$3,$4,$5)',
        ['10000000-0000-4000-8000-000000000002', 'member@example.com', 'Other', 'hash', 200],
      ),
    ).rejects.toMatchObject({ code: '23505' })
  } finally {
    await fixture.close()
  }
})
