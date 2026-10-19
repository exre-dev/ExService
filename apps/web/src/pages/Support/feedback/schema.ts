import { z } from 'zod'
import {
  analyzeRequest,
  composeBug,
  FEEDBACK_LIMITS,
  FREQUENCIES,
  utf8Bytes,
} from '@workspace/common/feedback-content'
import type { components } from '@workspace/sdk/types'
import type { FeedbackForm } from './flow'
import { ruleForKind } from './kind-rules'

const control = /[\u0000-\u001f\u007f-\u009f]/
export type FeedbackKind = FeedbackForm['kind']
export interface FeedbackDraft {
  contentFormat?: 'markdown'
  editorErrors: Partial<Record<MarkdownField, string | undefined>>
  title: string
  typeOptionId: string
  departmentOptionId: string
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
  typeOptionId: '',
  departmentOptionId: '',
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

export function toFeedbackForm(
  kind: FeedbackKind,
  draft: FeedbackDraft,
): components['schemas']['FeedbackSubmissionForm'] {
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
        typeOptionId: draft.typeOptionId,
        details: {
          description: draft.description,
          reproductionSteps: optional(draft.reproductionSteps),
          expectedResult: optional(draft.expectedResult),
          actualResult: optional(draft.actualResult),
          frequency: (draft.frequency ||
            null) as components['schemas']['FeedbackBugDetails']['frequency'],
        },
      }
    case 'feature':
      return {
        ...common,
        kind,
        typeOptionId: optional(draft.typeOptionId),
        departmentOptionId: optional(draft.departmentOptionId),
        contentText: draft.contentText,
      }
    case 'asset':
      return {
        ...common,
        kind,
        typeOptionId: optional(draft.typeOptionId),
        action: draft.action as 'add' | 'modify' | 'delete' | 'other',
        contentText: draft.contentText,
      }
    case 'request':
      return {
        ...common,
        kind,
        typeOptionId: optional(draft.typeOptionId),
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
  return {
    ...emptyDraft(),
    contentFormat: form.contentFormat,
    title: form.title,
    largeFileInfo: form.largeFileInfo ?? '',
    largeFileInfoEnabled: form.largeFileInfo !== null,
    ...('typeOptionId' in form ? { typeOptionId: form.typeOptionId ?? '' } : {}),
    ...(form.kind === 'feature' ? { departmentOptionId: form.departmentOptionId ?? '' } : {}),
    ...(form.kind === 'complaint' ? { anonymous: form.anonymous } : {}),
    ...('action' in form ? { action: form.action } : {}),
    ...(form.kind === 'bug'
      ? {
          description: form.details.description,
          reproductionSteps: form.details.reproductionSteps ?? '',
          expectedResult: form.details.expectedResult ?? '',
          actualResult: form.details.actualResult ?? '',
          frequency: form.details.frequency ?? '',
        }
      : { contentText: form.contentText }),
  }
}
export function feedbackSchema(
  kind: FeedbackKind,
  options: Pick<components['schemas']['FeedbackOptions'], 'fields' | 'actions'>,
) {
  const rule = ruleForKind(kind)
  const fieldOptions = (id: string) =>
    options.fields.find((field) => field.id === id)?.type_config.options ?? []
  const selection = (items: { id: string }[]) =>
    z
      .string()
      .refine(
        (value) => !value || items.some((item) => item.id === value),
        '选项已不可用，请重新选择',
      )
  return z
    .object({
      contentFormat: z.literal('markdown').optional(),
      editorErrors: z.record(z.string(), z.string().optional()),
      title: z
        .string()
        .refine(
          (value) =>
            Boolean(value.trim()) &&
            Array.from(value.trim()).length <= FEEDBACK_LIMITS.titleCodePoints &&
            !control.test(value),
          '标题须为 1–200 字且不含换行',
        ),
      typeOptionId: selection(fieldOptions('4c3befc0-5146-43a2-8610-86efe4e8124a')).refine(
        (value) => rule.typeField !== 'required' || Boolean(value),
        '请选择问题分类',
      ),
      departmentOptionId: selection(fieldOptions('9b3d2027-2162-42e2-81b9-d907592cdb5b')),
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
        .max(FEEDBACK_LIMITS.files, '最多选择 5 个附件'),
    })
    .superRefine((draft, ctx) => {
      const form = toFeedbackForm(kind, draft)
      const analysis =
        form.kind === 'bug'
          ? composeBug(form.details, draft.contentFormat)
          : analyzeRequest(form.contentText, draft.contentFormat)
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
      if (draft.largeFileInfoEnabled && utf8Bytes(draft.largeFileInfo) > 16384)
        ctx.addIssue({ code: 'custom', path: ['largeFileInfo'], message: '补充信息最多 16 KiB' })
      if (
        draft.files.some(
          (file) =>
            file.size < 1 ||
            file.size > FEEDBACK_LIMITS.fileBytes ||
            Array.from(file.name).length < 1 ||
            Array.from(file.name).length > 255 ||
            control.test(file.name),
        ) ||
        draft.files.reduce((sum, file) => sum + file.size, 0) > FEEDBACK_LIMITS.totalFileBytes
      )
        ctx.addIssue({
          code: 'custom',
          path: ['files'],
          message: '附件须为 1 字节至 20 MiB，文件名不超过 255 字，总计不超过 100 MiB',
        })
    })
}
