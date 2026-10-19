import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { AuthService, type AuthServiceDependencies } from '@server/src/modules/auth/service'
import type { PasswordHasher } from '@server/src/modules/auth/crypto'
import { ProfileService } from '@server/src/modules/profile/service'
import {
  InvitationService,
  type InvitationServiceDependencies,
} from '@server/src/domains/join/invitations/service'
import type { InvitationMail } from '@server/src/domains/join/invitations/mail'
import { JoinService } from '@server/src/domains/join/applications/service'
import { createStorageModule } from '@server/src/modules/storage/factory'
import { parseStorageConfig } from '@server/src/modules/storage/config'
import { createNotificationModule } from '@server/src/modules/notifications/factory'
import { isolatedPostgres } from './postgres'
import { unavailableSupport } from './support'

export const testPasswordHasher: PasswordHasher = {
  async hash(password) {
    return `test-password:${password}`
  },
  async verify(password, encodedHash) {
    return encodedHash === `test-password:${password}`
  },
}

export function newJoinApplication(
  email = 'member@example.com',
  nickname = 'Applicant',
  qq = '001234',
) {
  return {
    email,
    nickname,
    qq,
    form: {
      applicationType: 'new' as const,
      birthDate: '2000-02-29',
      applicantCategory: '100' as const,
      department: 'leo' as const,
      freeTime: '每晚都有空',
      discoveryChannels: ['friends' as const],
      answers: {
        fiveMExperience: '没有接触过',
        emergencyRoleplayKnowledge: '了解',
        emergencyProceduresKnowledge: '学习中',
        rpUnderstanding: '扮演真实角色',
        frpUnderstanding: '遵循角色与场景',
      },
      commitments: {
        informationAccurate: true as const,
        obeyCommunityRules: true as const,
        acceptAcademyAttendanceConsequences: true as const,
      },
    },
  }
}

export function experiencedJoinApplication(email = 'experienced@example.com') {
  const common = newJoinApplication(email)
  return {
    ...common,
    form: {
      ...common.form,
      applicationType: 'experienced' as const,
      answers: {
        previousServer: 'Previous server',
        leaveReason: '寻找新社区',
        previousDepartment: '巡逻',
        lawEnforcementExperience: '有相关经历',
        highestRank: 'Officer',
        punishmentHistory: '无',
        deescalationEssay: '😀'.repeat(150),
        discretionEssay: '自'.repeat(150),
        transferReason: '继续学习',
      },
      commitments: { informationAccurate: true as const, obeyCommunityRules: true as const },
    },
  }
}

export async function createTestAuth(
  overrides: Partial<AuthServiceDependencies & InvitationServiceDependencies> = {},
) {
  const isolated = await isolatedPostgres()
  const { db } = isolated
  let randomCounter = 0,
    idCounter = 0,
    codeCounter = 123456,
    userCounter = 0
  const deliveries: InvitationMail[] = []
  let currentTime = 1_800_000_000_000
  const now = overrides.now ?? (() => currentTime)
  const createId = () => `20000000-0000-4000-8000-${String(++idCounter).padStart(12, '0')}`
  const createUserId =
    overrides.createUserId ??
    (() => `10000000-0000-4000-8000-${String(++userCounter).padStart(12, '0')}`)
  const passwordHasher = overrides.passwordHasher ?? testPasswordHasher
  const shared = {
    now,
    passwordHasher,
    randomBytes: (length: number) => {
      const bytes = Buffer.alloc(length)
      bytes.writeUInt32BE(++randomCounter, Math.max(0, length - 4))
      return bytes
    },
    ...overrides,
    db,
  }
  const authServices = new AuthService(shared)
  const invitationServices = new InvitationService({
    ...shared,
    codeHmacKey: overrides.codeHmacKey ?? Buffer.alloc(32, 7),
    createId,
    createUserId,
    randomInteger: () => codeCounter++ % 1_000_000,
    ...overrides,
    db,
    deliverInvitation: (mail) => {
      deliveries.push(mail)
      return overrides.deliverInvitation?.(mail)
    },
  })
  const joinServices = new JoinService(invitationServices, createId)
  const avatarDirectory = mkdtempSync(resolve(tmpdir(), 'exwebsite-avatars-'))
  const profileServices = new ProfileService(
    db,
    avatarDirectory,
    'http://127.0.0.1:8080/api/avatars',
  )
  // 存储模块默认只启用本地介质，并写入临时目录，不触碰开发 data。
  const storageDirectory = mkdtempSync(resolve(tmpdir(), 'exwebsite-storage-'))
  const storageServices = createStorageModule({
    config: parseStorageConfig({}, { dataRoot: storageDirectory }),
  })
  // 通知模块使用同一隔离 schema 与注入的时钟/ID，不启动后台 worker，
  // 测试需要投影时显式调用一次 runRound。
  const notifications = createNotificationModule({ db, tokenKey: Buffer.alloc(32, 3), now })
  return {
    db,
    connectionString: isolated.connectionString,
    schema: isolated.schema,
    authServices,
    invitationServices,
    joinServices,
    profileServices,
    storageServices,
    notifications,
    ...unavailableSupport(db, profileServices),
    avatarDirectory,
    deliveries,
    now,
    async seedUser(input: { email: string; nickname: string; password: string }) {
      const id = createUserId(),
        hash = await passwordHasher.hash(input.password)
      await db.query(
        'INSERT INTO auth_users (id, email, nickname, password_hash, created_at) VALUES ($1, $2, $3, $4, $5)',
        [id, input.email.trim().toLowerCase(), input.nickname.trim(), hash, now()],
      )
      return id
    },
    advance(milliseconds: number) {
      currentTime += milliseconds
    },
    async close() {
      await isolated.close()
      rmSync(avatarDirectory, { recursive: true, force: true })
      rmSync(storageDirectory, { recursive: true, force: true })
    },
  }
}

export type TestAuth = Awaited<ReturnType<typeof createTestAuth>>

export async function approvedInvitation(fixture: TestAuth, email = 'member@example.com') {
  await fixture.joinServices.submit(newJoinApplication(email))
  const { rows } = await fixture.db.query<{ id: string }>(
    'SELECT id FROM join_applications WHERE email = $1 AND status = $2',
    [email, 'pending'],
  )
  const id = rows[0]!.id
  await fixture.joinServices.approve(id)
  return { id, email, code: fixture.deliveries.at(-1)!.code }
}

export async function registerInvited(fixture: TestAuth, email = 'member@example.com') {
  const approved = await approvedInvitation(fixture, email)
  const grant = await fixture.invitationServices.verifyCode(email, approved.code)
  return fixture.invitationServices.complete({
    completionToken: grant.completionToken,
    nickname: 'Member',
    password: 'valid password',
  })
}

export async function joinSnapshot(fixture: TestAuth) {
  const result: Record<string, unknown[]> = {}
  for (const table of [
    'join_applications',
    'join_application_email_registry',
    'join_application_forms',
    'join_application_attachments',
    'join_invitations',
    'join_email_controls',
    'join_delivery_attempts',
    'auth_users',
    'auth_sessions',
    'auth_sso_requests',
    'community_groups',
    'community_group_memberships',
  ]) {
    const { rows } = await fixture.db.query(`SELECT * FROM ${table} ORDER BY 1`)
    result[table] = rows
  }
  return result
}
