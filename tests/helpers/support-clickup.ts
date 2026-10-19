import { vi } from 'vitest'
import type {
  ClickUpServices,
  ClickUpTask,
  ClickUpField,
  ClickUpCreateTask,
} from '@server/src/modules/clickup/service'
import { TARGET, COMMUNITY_TARGET } from '@server/src/domains/support/metadata'
import { loadFieldDefinitions } from '@server/src/domains/support/field-config'
import { createSupportServices } from '@server/src/domains/support/service'
import { randomUUID } from 'node:crypto'
import type { TestAuth } from './auth'

export const typeOption = '8ed0b993-3b6d-4d2a-b6e1-676df0541b4b'
export const departmentOption = '20680086-0c92-4c7c-b6c1-7cd58434420c'
export function fakeClickUp() {
  const fields: ClickUpField[] = [
    ...loadFieldDefinitions().map((field) => ({
      id: field.id,
      name: field.name,
      type: field.type,
      type_config: { options: field.type_config.options },
    })),
    { id: TARGET.user, name: '用户', type: 'short_text', type_config: {} },
  ]
  const tasks = new Map<string, ClickUpTask>()
  const createTask = vi.fn(async (list: string, input: ClickUpCreateTask) => {
    const id = `task-${tasks.size + 1}`
    tasks.set(id, {
      id,
      name: input.name,
      list: { id: list },
      status: { status: input.status },
      custom_item_id: input.custom_item_id,
      markdown_description: input.markdown_content,
      custom_fields: input.custom_fields.map((v) => ({
        ...fields.find((f) => f.id === v.id)!,
        value: v.value,
      })),
      attachments: [],
      tags: [...input.tags],
    })
    return { id }
  })
  const service: ClickUpServices = {
    available: true,
    reason: null,
    getList: vi.fn(async (list) => ({
      id: list,
      name: 'feedback',
      space: { id: list === COMMUNITY_TARGET.list ? COMMUNITY_TARGET.space : TARGET.space },
      statuses: [
        { status: list === COMMUNITY_TARGET.list ? COMMUNITY_TARGET.status : TARGET.status },
      ],
    })),
    getFields: vi.fn(async () => fields),
    getTaskTypes: vi.fn(async () => [
      { id: 1005, name: 'Request' },
      { id: 1001, name: 'Bug' },
      { id: 1009, name: 'Asset' },
      { id: 1007, name: 'Content' },
      { id: 1008, name: 'Campaign' },
      { id: 1003, name: 'Feedback' },
    ]),
    getSpaceTags: vi.fn(async (space) =>
      space === COMMUNITY_TARGET.space ? ['反馈', '投诉'] : ['新增', '修改', '删除'],
    ),
    getTask: vi.fn(async (id) => {
      const task = tasks.get(id)
      if (!task) throw new Error('Missing fake task')
      return structuredClone(task)
    }),
    listTasks: vi.fn(async () => ({ tasks: [...tasks.values()], last_page: true })),
    createTask,
    uploadAttachment: vi.fn(async (id, input) => {
      const a = {
        id: `attachment-${tasks.get(id)!.attachments.length + 1}`,
        title: input.filename,
        size: input.bytes instanceof Blob ? input.bytes.size : input.bytes.byteLength,
      }
      tasks.get(id)!.attachments.push(a)
      return a
    }),
  }
  return { service, fields, tasks, createTask }
}
export async function supportFixture(f: TestAuth) {
  const userId = await f.seedUser({
    email: 'support@example.com',
    nickname: '反馈用户',
    password: 'valid password',
  })
  const fake = fakeClickUp(),
    support = createSupportServices({
      db: f.db,
      profile: f.profileServices,
      clickup: fake.service,
      now: f.now,
    })
  return { userId, fake, support }
}
export const requestInput = () => ({
  submissionKey: randomUUID(),
  form: {
    kind: 'request' as const,
    title: '中文 # 请求',
    typeOptionId: null,
    largeFileInfo: null,
    contentText: '<b>文字</b>\n[普通链接](https://example.com)',
  },
  attachments: [],
})
