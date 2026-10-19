import { expect, it } from 'vitest'
import { isolatedPostgres } from '@tests/helpers/postgres'

it('creates nullable profile fields and keeps avatar references unique', async () => {
  const fixture = await isolatedPostgres()
  try {
    const { db } = fixture
    await db.query(
      'INSERT INTO auth_users (id,email,nickname,password_hash,created_at) VALUES ($1,$2,$3,$4,$5)',
      ['user-1', 'first@example.com', 'First', 'hash', 100],
    )
    await db.query(
      'INSERT INTO auth_users (id,email,nickname,password_hash,created_at,qq,fivem_id,avatar_key) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      ['user-2', 'second@example.com', 'Second', 'hash', 101, '0001', 'fivem:42', 'avatar-ref'],
    )
    expect(
      (await db.query('SELECT qq,fivem_id,avatar_key FROM auth_users WHERE id = $1', ['user-1']))
        .rows,
    ).toEqual([{ qq: null, fivem_id: null, avatar_key: null }])
    expect(
      (await db.query('SELECT qq,fivem_id,avatar_key FROM auth_users WHERE id = $1', ['user-2']))
        .rows,
    ).toEqual([{ qq: '0001', fivem_id: 'fivem:42', avatar_key: 'avatar-ref' }])
    await expect(
      db.query('UPDATE auth_users SET avatar_key = $1 WHERE id = $2', ['avatar-ref', 'user-1']),
    ).rejects.toMatchObject({ code: '23505' })
    expect(
      (
        await db.query<{ avatar_key: string | null }>(
          'SELECT avatar_key FROM auth_users WHERE id = $1',
          ['user-1'],
        )
      ).rows,
    ).toEqual([{ avatar_key: null }])
  } finally {
    await fixture.close()
  }
})

it('rejects PostgreSQL bigint timestamps outside JavaScript safe integer range on read', async () => {
  const fixture = await isolatedPostgres()
  try {
    await fixture.db.query(
      'INSERT INTO auth_users (id,email,nickname,password_hash,created_at) VALUES ($1,$2,$3,$4,$5)',
      ['user-1', 'large-time@example.com', 'Member', 'hash', '9007199254740992'],
    )
    await expect(
      fixture.db.query('SELECT created_at FROM auth_users WHERE id = $1', ['user-1']),
    ).rejects.toThrow()
  } finally {
    await fixture.close()
  }
})
