import { expect, it } from 'vitest'
import {
  validateJoinApplicationPayload,
  validateStoredJoinForm,
} from '@server/src/domains/join/applications/form-validation'

const earlierTransferForm = {
  applicationType: 'experienced',
  birthDate: '2000-01-01',
  applicantCategory: '100',
  department: 'leo',
  freeTime: '周末',
  discoveryChannels: ['friends'],
  answers: {
    previousServer: '旧服务器',
    leaveReason: '迁入',
    previousDepartment: '巡逻',
    lawEnforcementExperience: '有经验',
    highestRank: '警员',
    punishmentHistory: '无',
    deescalationEssay: '字'.repeat(150),
    discretionEssay: '字'.repeat(150),
    transferReason: '继续参与',
  },
  commitments: { informationAccurate: true },
} as const

it('reads earlier transfer forms and validates the added acknowledgement when present', () => {
  const now = Date.UTC(2026, 8, 29)
  expect(validateStoredJoinForm(earlierTransferForm, now)).toEqual(earlierTransferForm)
  const currentForm = {
    ...earlierTransferForm,
    commitments: { ...earlierTransferForm.commitments, obeyCommunityRules: true },
  }
  expect(validateStoredJoinForm(currentForm, now)).toEqual(currentForm)
  expect(() =>
    validateJoinApplicationPayload(
      {
        email: 'player@example.com',
        nickname: '玩家',
        qq: '0012345',
        form: {
          ...currentForm,
          commitments: { ...currentForm.commitments, obeyCommunityRules: false },
        },
      },
      now,
    ),
  ).toThrow()
})
