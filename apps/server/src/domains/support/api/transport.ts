import type { FastifyInstance, FastifyRequest } from 'fastify'
import { authenticateBearer } from '../../../modules/auth/api/security.js'
import {
  createMultipartUploadRegistry,
  declaredResponseStatuses,
  type MultipartUploadLimits,
} from '../../../http/shared/multipart-upload-lifecycle.js'
import type { SupportUpload } from '../service.js'
import { FeedbackError } from '../errors.js'
const registry = createMultipartUploadRegistry<SupportUpload>()
export function getSupportUpload(request: FastifyRequest): SupportUpload {
  const value = registry.getParsed(request)
  if (!value) throw new FeedbackError('FEEDBACK_INVALID_INPUT')
  return value
}
export function registerSupportTransport(app: FastifyInstance): void {
  const controller = registry.create(app)
  app.addHook('onRoute', (route) => {
    const operation = (route.schema as { operationId?: string } | undefined)?.operationId
    if (operation === 'prepareSupportFeedback' || operation === 'advanceSupportFeedback') {
      const limit = (route.config as { bodyLimit?: number }).bodyLimit
      if (!Number.isSafeInteger(limit) || limit! <= 0) throw new Error('Missing support JSON limit')
      route.bodyLimit = limit
    }
    if (operation !== 'uploadSupportFeedbackAttachment') return
    const limits = (
      route.config as { supportUpload: MultipartUploadLimits & { fileBytes: number } }
    ).supportUpload
    if (
      !limits ||
      [
        'wireBytes',
        'fileBytes',
        'slots',
        'deadlineMs',
        'headerBytes',
        'headerPairs',
        'fieldNameBytes',
      ].some(
        (key) =>
          !Number.isSafeInteger((limits as unknown as Record<string, number>)[key]) ||
          ((limits as unknown as Record<string, number>)[key] ?? 0) < 1,
      )
    )
      throw new Error('Invalid support upload limits')
    const invalid = () => new FeedbackError('FEEDBACK_INVALID_INPUT')
    controller.attach(route, {
      limits,
      declaredStatuses: declaredResponseStatuses(route),
      errors: {
        malformed: invalid,
        tooLarge: () => new FeedbackError('FEEDBACK_TOO_LARGE'),
        unsupportedMediaType: () => new FeedbackError('FEEDBACK_UNSUPPORTED_MEDIA'),
      },
      async admit(request) {
        const identity = await authenticateBearer(request, request.server.authServices)
        const { submissionId, attachmentId } = request.params as {
          submissionId: string
          attachmentId: string
        }
        await request.server.supportServices.authorizeUpload(
          identity.userId,
          submissionId,
          attachmentId,
        )
      },
      async parse(_request, scope) {
        let file: SupportUpload | undefined
        for await (const part of scope.parts({
          parts: 1,
          files: 1,
          fields: 0,
          fileSize: limits.fileBytes,
          fieldNameSize: 64,
          headerPairs: 32,
          headerSize: 16384,
        })) {
          if (part.type !== 'file' || part.fieldname !== 'file' || file) throw invalid()
          file = {
            bytes: await scope.readFile(part.file, limits.fileBytes),
            filename: part.filename,
            contentType: part.mimetype,
          }
        }
        if (!file) throw invalid()
        return { body: { file: 'support-file' }, value: file }
      },
      classify(error) {
        if (error instanceof FeedbackError) return error
        return (error as { statusCode?: number })?.statusCode === 413
          ? new FeedbackError('FEEDBACK_TOO_LARGE')
          : invalid()
      },
      timedOut: () => new FeedbackError('FEEDBACK_UPLOAD_TIMEOUT'),
      busy: () => new FeedbackError('FEEDBACK_BUSY', 5),
    })
  })
}
