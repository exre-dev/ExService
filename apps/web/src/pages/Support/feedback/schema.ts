import { z } from 'zod'
import {
  analyzeRequest,
  composeBug,
  FREQUENCIES,
  utf8Bytes,
} from '@workspace/common/feedback-content'
import type { components } from '@workspace/sdk/types'
import type { FeedbackForm } from './flow'
import { ruleForKind } from './kind-rules'

export const FEEDBACK_LIMITS = {
  titleCodePoints: 200,
  userContentBytes: 65536,
  fileBytes: 20971520,
  files: 5,
  totalFileBytes: 104857600,
  largeFileInfoBytes: 65536,
} as const satisfies components['schemas']['FeedbackLimits']
const control = /[\u0000-\u001f\u007f-\u009f]/
export type FeedbackKind = FeedbackForm['kind']
export interface FeedbackDraft {
  contentFormat?: 'markdown'
  editorErrors: Partial<Record<MarkdownField, string | undefined>>
  title: string
  action: string
  largeFileInfoEnabled: boolean
  largeFileInfo: string
  contentText: string
  description: string
  reproductionSteps: string
  expectedResult: string
  actualResult: string
  frequency: string
  anonymous: boolean
  files: File[]
}
export type MarkdownField =
  'contentText' | 'description' | 'reproductionSteps' | 'expectedResult' | 'actualResult'
export const emptyDraft = (): FeedbackDraft => ({
  contentFormat: 'markdown',
  editorErrors: {},
  title: '',
  action: '',
  largeFileInfoEnabled: false,
  largeFileInfo: '',
  contentText: '',
  description: '',
  reproductionSteps: '',
  expectedResult: '',
  actualResult: '',
  frequency: '',
  anonymous: false,
  files: [],
})
const optional = (value: string): string | null => (value.trim() ? value : null)

export function toFeedbackForm(kind: FeedbackKind, draft: FeedbackDraft): FeedbackForm {
  const common = {
    title: draft.title.trim(),
    largeFileInfo: draft.largeFileInfoEnabled ? optional(draft.largeFileInfo) : null,
    ...(draft.contentFormat ? { contentFormat: draft.contentFormat } : {}),
  }
  switch (kind) {
    case 'bug':
      return {
        ...common,
        kind,
        details: {
          description: draft.description,
          reproductionSteps: optional(draft.reproductionSteps),
          expectedResult: optional(draft.expectedResult),
          actualResult: optional(draft.actualResult),
          frequency: draft.frequency || null,
        },
      }
    case 'feature':
      return {
        ...common,
        kind,
        contentText: draft.contentText,
      }
    case 'asset':
      return {
        ...common,
        kind,
        action: draft.action as 'add' | 'modify' | 'delete' | 'other',
        contentText: draft.contentText,
      }
    case 'request':
      return {
        ...common,
        kind,
        contentText: draft.contentText,
      }
    case 'content':
      return {
        ...common,
        kind,
        action: draft.action as 'add' | 'modify' | 'delete' | 'other',
        contentText: draft.contentText,
      }
    case 'campaign':
      return { ...common, kind, contentText: draft.contentText }
    case 'suggestion':
      return { ...common, kind, contentText: draft.contentText }
    case 'complaint':
      return { ...common, kind, contentText: draft.contentText, anonymous: draft.anonymous }
  }
}
export function draftFromForm(form: FeedbackForm): FeedbackDraft {
  const text = (value: unknown) => (typeof value === 'string' ? value : '')
  const details =
    form.details && typeof form.details === 'object'
      ? (form.details as Record<string, unknown>)
      : {}
  return {
    ...emptyDraft(),
    contentFormat: form.contentFormat === 'markdown' ? 'markdown' : undefined,
    title: form.title,
    largeFileInfo: text(form.largeFileInfo),
    largeFileInfoEnabled: Boolean(form.largeFileInfo),
    anonymous: form.anonymous === true,
    action: text(form.action),
    contentText: text(form.contentText),
    description: text(details.description),
    reproductionSteps: text(details.reproductionSteps),
    expectedResult: text(details.expectedResult),
    actualResult: text(details.actualResult),
    frequency: text(details.frequency),
  }
}
export function feedbackSchema(
  kind: FeedbackKind,
  options: Pick<components['schemas']['FeedbackOptionsData'], 'fields' | 'actions'> &
    Partial<Pick<components['schemas']['FeedbackOptionsData'], 'limits'>>,
) {
  const rule = ruleForKind(kind)
  const limits = options.limits ?? FEEDBACK_LIMITS
  return z
    .object({
      contentFormat: z.literal('markdown').optional(),
      editorErrors: z.record(z.string(), z.string().optional()),
      title: z
        .string()
        .refine(
          (value) =>
            Boolean(value.trim()) &&
            Array.from(value.trim()).length <= limits.titleCodePoints &&
            !control.test(value),
          '标题须为 1–200 字且不含换行',
        ),
      action: z
        .string()
        .refine(
          (value) =>
            !rule.action ||
            options.actions.some((action) => action.action === value && action.available),
          '请选择可用的操作',
        ),
      largeFileInfoEnabled: z.boolean(),
      largeFileInfo: z.string(),
      contentText: z.string(),
      description: z.string(),
      reproductionSteps: z.string(),
      expectedResult: z.string(),
      actualResult: z.string(),
      frequency: z
        .string()
        .refine((value) => !value || Object.hasOwn(FREQUENCIES, value), '请选择有效的发生频率'),
      anonymous: z.boolean(),
      files: z
        .array(
          z.custom<File>((value) =>
            Boolean(
              value &&
              typeof value === 'object' &&
              'size' in value &&
              'name' in value &&
              'arrayBuffer' in value,
            ),
          ),
        )
        .max(limits.files, '最多选择 5 个附件'),
    })
    .superRefine((draft, ctx) => {
      const form = toFeedbackForm(kind, draft)
      const analysis =
        form.kind === 'bug'
          ? composeBug(
              {
                description: draft.description,
                reproductionSteps: optional(draft.reproductionSteps),
                expectedResult: optional(draft.expectedResult),
                actualResult: optional(draft.actualResult),
                frequency: (draft.frequency || null) as keyof typeof FREQUENCIES | null,
              },
              draft.contentFormat,
            )
          : analyzeRequest(draft.contentText, draft.contentFormat)
      if (!analysis.valid)
        ctx.addIssue({
          code: 'custom',
          path: [rule.body === 'bug' ? 'description' : 'contentText'],
          message:
            analysis.reason === 'empty'
              ? '请填写正文'
              : analysis.reason === 'too_large'
                ? '正文超出大小限制，请缩短内容'
                : '正文格式不可用，请调整内容',
        })
      if (
        utf8Bytes(
          JSON.stringify(form)
            .replace(
              /[\u0080-\uffff]/g,
              (char) => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0'),
            )
            .replaceAll('/', '\\/'),
        ) > 131072
      )
        ctx.addIssue({
          code: 'custom',
          path: [rule.body === 'bug' ? 'description' : 'contentText'],
          message: '表单内容过大，请缩短内容',
        })
      const activeFields: MarkdownField[] =
        rule.body === 'bug'
          ? ['description', 'reproductionSteps', 'expectedResult', 'actualResult']
          : ['contentText']
      for (const field of activeFields)
        if (draft.editorErrors[field])
          ctx.addIssue({ code: 'custom', path: [field], message: draft.editorErrors[field] })
      if (rule.body === 'bug')
        for (const field of [
          'description',
          'reproductionSteps',
          'expectedResult',
          'actualResult',
        ] as const)
          if (utf8Bytes(draft[field]) > 16384)
            ctx.addIssue({ code: 'custom', path: [field], message: '此项最多 16 KiB，请缩短内容' })
      if (draft.largeFileInfoEnabled && utf8Bytes(draft.largeFileInfo) > limits.largeFileInfoBytes)
        ctx.addIssue({ code: 'custom', path: ['largeFileInfo'], message: '补充信息最多 64 KiB' })
      if (
        draft.files.some(
          (file) =>
            file.size < 1 ||
            file.size > limits.fileBytes ||
            Array.from(file.name).length < 1 ||
            Array.from(file.name).length > 255 ||
            control.test(file.name),
        ) ||
        draft.files.reduce((sum, file) => sum + file.size, 0) > limits.totalFileBytes
      )
        ctx.addIssue({
          code: 'custom',
          path: ['files'],
          message: '附件须为 1 字节至 20 MiB，文件名不超过 255 字，总计不超过 100 MiB',
        })
    })
}
