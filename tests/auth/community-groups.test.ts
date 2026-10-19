import { afterEach, describe, expect, it } from 'vitest'
import { assertCommunitySchemaAvailable } from '@server/src/domains/community/schema-check'
import { createTestAuth, approvedInvitation, type TestAuth } from '@tests/helpers/auth'

const fixtures: TestAuth[] = []
afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.close()))
})
async function setup() {
  const fixture = await createTestAuth()
  fixtures.push(fixture)
  return fixture
}

describe('explicit community membership', () => {
  it('creates only the admin group in the fresh PostgreSQL baseline and detects a missing seed', async () => {
    const fixture = await setup()
    await expect(assertCommunitySchemaAvailable(fixture.db)).resolves.toBeUndefined()
    expect(
      (await fixture.db.query('SELECT code, display_name FROM community_groups')).rows,
    ).toEqual([{ code: 'admin', display_name: '管理员' }])
    expect((await fixture.db.query('SELECT * FROM community_group_memberships')).rows).toEqual([])
    await fixture.db.query("DELETE FROM community_groups WHERE code = 'admin'")
    await expect(assertCommunitySchemaAvailable(fixture.db)).rejects.toThrow('pnpm db:migrate')
  })

  it('rejects an obsolete general group rather than treating it as an ordinary membership', async () => {
    const fixture = await setup()
    await fixture.db.query(
      "INSERT INTO community_groups (code, display_name) VALUES ('general', '旧普通身份')",
    )
    await expect(assertCommunitySchemaAvailable(fixture.db)).rejects.toThrow('pnpm db:migrate')
  })

  it('leaves a newly registered user ordinary until an admin grant is explicitly inserted', async () => {
    const fixture = await setup()
    const challenge = await approvedInvitation(fixture, 'new@example.com')
    expect(
      (
        await fixture.db.query<{ count: string }>(
          'SELECT count(*) AS count FROM community_group_memberships',
        )
      ).rows[0],
    ).toEqual({ count: '0' })
    await expect(
      fixture.invitationServices.verifyCode(challenge.email, '000000'),
    ).rejects.toMatchObject({ code: 'INVITATION_CODE_INVALID' })
    expect(
      (await fixture.db.query<{ count: string }>('SELECT count(*) AS count FROM auth_users'))
        .rows[0],
    ).toEqual({ count: '0' })
    const grant = await fixture.invitationServices.verifyCode(challenge.email, challenge.code)
    const input = {
      completionToken: grant.completionToken,
      nickname: 'New',
      password: 'valid password',
    }
    expect(await fixture.invitationServices.complete(input)).toEqual({
      status: 'registered',
      email: 'new@example.com',
    })
    expect(await fixture.invitationServices.complete(input)).toEqual({
      status: 'registered',
      email: 'new@example.com',
    })
    expect(
      (await fixture.db.query('SELECT group_code FROM community_group_memberships')).rows,
    ).toEqual([])
    const user = (await fixture.db.query<{ id: string }>('SELECT id FROM auth_users')).rows[0]!
    await fixture.db.query(
      'INSERT INTO community_group_memberships (user_id, group_code) VALUES ($1, $2)',
      [user.id, 'admin'],
    )
    expect(
      (await fixture.db.query('SELECT group_code FROM community_group_memberships')).rows,
    ).toEqual([{ group_code: 'admin' }])
    await expect(
      fixture.db.query(
        'INSERT INTO community_group_memberships (user_id, group_code) VALUES ($1, $2)',
        [user.id, 'admin'],
      ),
    ).rejects.toMatchObject({ code: '23505' })
    await expect(
      fixture.db.query(
        'INSERT INTO community_group_memberships (user_id, group_code) VALUES ($1, $2)',
        [user.id, 'missing'],
      ),
    ).rejects.toMatchObject({ code: '23503' })
    await expect(
      fixture.db.query("DELETE FROM community_groups WHERE code = 'admin'"),
    ).rejects.toMatchObject({ code: '23503' })
  })

  it('does not insert memberships during registration', async () => {
    const fixture = await setup()
    const challenge = await approvedInvitation(fixture, 'new@example.com')
    await fixture.db.query(`CREATE FUNCTION fail_membership() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'membership failure'; END $$`)
    await fixture.db
      .query(`CREATE TRIGGER fail_membership BEFORE INSERT ON community_group_memberships
      FOR EACH ROW EXECUTE FUNCTION fail_membership()`)
    const grant = await fixture.invitationServices.verifyCode(challenge.email, challenge.code)
    expect(
      await fixture.invitationServices.complete({
        completionToken: grant.completionToken,
        nickname: 'New',
        password: 'valid password',
      }),
    ).toEqual({ status: 'registered', email: 'new@example.com' })
    expect(
      (await fixture.db.query<{ count: string }>('SELECT count(*) AS count FROM auth_users'))
        .rows[0],
    ).toEqual({ count: '1' })
    expect(
      (
        await fixture.db.query<{ count: string }>(
          'SELECT count(*) AS count FROM community_group_memberships',
        )
      ).rows[0],
    ).toEqual({ count: '0' })
    expect((await fixture.db.query('SELECT status FROM join_invitations')).rows[0]).toEqual({
      status: 'completed',
    })
  })
})
