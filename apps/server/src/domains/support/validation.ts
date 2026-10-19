import { createHash } from 'node:crypto'
import { Ajv } from 'ajv'
import type { components } from '@workspace/sdk/types'
import { readContract } from '../../contract/document.js'
import {
  analyzeRequest,
  composeBug,
  normalizeMime,
  utf8Bytes,
  FEEDBACK_LIMITS,
} from '@workspace/common/feedback-content'
import { FeedbackError } from './errors.js'
export type FeedbackPrepare = components['schemas']['FeedbackPrepare']
export type FeedbackForm = components['schemas']['FeedbackForm']
export type FeedbackSnapshot = components['schemas']['FeedbackSnapshot']
export type FeedbackOptions = components['schemas']['FeedbackOptions']
export type FeedbackAdvance = components['schemas']['FeedbackAdvance']
type StoredPrepare = Omit<FeedbackPrepare, 'form'> & { form: FeedbackForm }
const ajv = new Ajv({ strict: false, validateFormats: false, allErrors: false })
const document = readContract()
const schemas = document.components?.schemas ?? {}
for (const [name, schema] of Object.entries(schemas))
  ajv.addSchema(schema as object, `#/components/schemas/${name}`)
const prepareValidator = ajv.getSchema('#/components/schemas/FeedbackPrepare')!
const prepareSchema = schemas.FeedbackPrepare as { properties: Record<string, object> }
const storedPrepareValidator = ajv.compile({
  ...prepareSchema,
  properties: { ...prepareSchema.properties, form: { $ref: '#/components/schemas/FeedbackForm' } },
})
const advanceValidator = ajv.getSchema('#/components/schemas/FeedbackAdvance')!
export const sha256 = (bytes: string | Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex')
export function normalizePrepare(value: unknown): FeedbackPrepare {
  if (!prepareValidator(value)) throw new FeedbackError('FEEDBACK_INVALID_INPUT')
  return normalizeValidatedPrepare(value as FeedbackPrepare) as FeedbackPrepare
}
/** Frozen records retain their original form even when new submissions gain required fields. */
export function normalizeStoredPrepare(value: unknown): StoredPrepare {
  if (!storedPrepareValidator(value)) throw new FeedbackError('FEEDBACK_INVALID_INPUT')
  return normalizeValidatedPrepare(value as StoredPrepare)
}
function normalizeValidatedPrepare(input: StoredPrepare): StoredPrepare {
  const f = input.form
  const title = f.title.trim()
  if (!title || [...title].length > 200 || /[\x00-\x1f\x7f-\x9f]/.test(title))
    throw new FeedbackError('FEEDBACK_INVALID_INPUT')
  const largeFileInfo = f.largeFileInfo && f.largeFileInfo.trim() ? f.largeFileInfo : null
  if (largeFileInfo !== null && utf8Bytes(largeFileInfo) > 16384)
    throw new FeedbackError('FEEDBACK_TOO_LARGE')
  const analysis =
    f.kind === 'bug'
      ? composeBug(f.details, f.contentFormat)
      : analyzeRequest(f.contentText, f.contentFormat)
  if (!analysis.valid)
    throw new FeedbackError(
      analysis.reason === 'too_large' ? 'FEEDBACK_TOO_LARGE' : 'FEEDBACK_INVALID_INPUT',
    )
  let form: FeedbackForm
  switch (f.kind) {
    case 'bug':
      form = {
        kind: 'bug',
        title,
        typeOptionId: f.typeOptionId,
        largeFileInfo,
        details: {
          description: f.details.description,
          reproductionSteps: f.details.reproductionSteps,
          expectedResult: f.details.expectedResult,
          actualResult: f.details.actualResult,
          frequency: f.details.frequency,
        },
        ...(f.contentFormat && { contentFormat: f.contentFormat }),
      }
      break
    case 'feature':
      form = {
        kind: 'feature',
        title,
        typeOptionId: f.typeOptionId,
        departmentOptionId: f.departmentOptionId,
        largeFileInfo,
        contentText: f.contentText,
        ...(f.contentFormat && { contentFormat: f.contentFormat }),
      }
      break
    case 'asset':
      form = {
        kind: 'asset',
        title,
        typeOptionId: f.typeOptionId,
        action: f.action,
        largeFileInfo,
        contentText: f.contentText,
        ...(f.contentFormat && { contentFormat: f.contentFormat }),
      }
      break
    case 'request':
      form = {
        kind: 'request',
        title,
        typeOptionId: f.typeOptionId,
        largeFileInfo,
        contentText: f.contentText,
        ...(f.contentFormat && { contentFormat: f.contentFormat }),
      }
      break
    case 'content':
      form = {
        kind: 'content',
        title,
        action: f.action,
        largeFileInfo,
        contentText: f.contentText,
        ...(f.contentFormat && { contentFormat: f.contentFormat }),
      }
      break
    case 'campaign':
      form = {
        kind: 'campaign',
        title,
        largeFileInfo,
        contentText: f.contentText,
        ...(f.contentFormat && { contentFormat: f.contentFormat }),
      }
      break
    case 'suggestion':
      form = {
        kind: 'suggestion',
        title,
        largeFileInfo,
        contentText: f.contentText,
        ...(f.contentFormat && { contentFormat: f.contentFormat }),
      }
      break
    case 'complaint':
      form = {
        kind: 'complaint',
        title,
        largeFileInfo,
        contentText: f.contentText,
        anonymous: f.anonymous,
        ...(f.contentFormat && { contentFormat: f.contentFormat }),
      }
      break
  }
  const ids = new Set<string>()
  let total = 0
  const attachments = input.attachments.map((a) => {
    if (
      ids.has(a.id) ||
      [...a.originalName].length > 255 ||
      /[\x00-\x1f\x7f-\x9f]/.test(a.originalName)
    )
      throw new FeedbackError('FEEDBACK_INVALID_INPUT')
    ids.add(a.id)
    total += a.byteLength
    return {
      id: a.id,
      originalName: a.originalName,
      contentType: normalizeMime(a.contentType),
      byteLength: a.byteLength,
      sha256: a.sha256,
    }
  })
  if (total > FEEDBACK_LIMITS.totalFileBytes) throw new FeedbackError('FEEDBACK_TOO_LARGE')
  return { submissionKey: input.submissionKey, form, attachments }
}
export function content(form: FeedbackForm): string {
  return (
    form.kind === 'bug'
      ? composeBug(form.details, form.contentFormat)
      : analyzeRequest(form.contentText, form.contentFormat)
  ).markdown
}
export function normalizeAdvance(value: unknown): FeedbackAdvance {
  if (!advanceValidator(value)) throw new FeedbackError('FEEDBACK_INVALID_INPUT')
  const input = value as FeedbackAdvance
  return { expectedRevision: input.expectedRevision, intent: input.intent }
}
