import { instance } from '@workspace/sdk'
import type { FeedbackPort } from './flow'

export const feedbackPort: FeedbackPort = {
  prepare: (body) =>
    instance({
      url: '/support/feedback/submissions',
      method: 'POST',
      data: body,
      alert: false,
      timeout: 15000,
    }),
  get: (submissionId) =>
    instance({
      url: '/support/feedback/submissions/{submissionId}',
      method: 'GET',
      pathParams: { submissionId },
      alert: false,
      timeout: 15000,
    }),
  lookup: (submissionKey) =>
    instance({
      url: '/support/feedback/submissions/lookup',
      method: 'GET',
      params: { submissionKey },
      alert: false,
      timeout: 15000,
    }),
  upload: (submissionId, attachmentId, file) => {
    const body = new FormData()
    body.append('file', file, file.name)
    return instance({
      url: '/support/feedback/submissions/{submissionId}/attachments/{attachmentId}',
      method: 'PUT',
      pathParams: { submissionId, attachmentId },
      data: body,
      alert: false,
      timeout: 130000,
    })
  },
  advance: (submissionId, body) =>
    instance({
      url: '/support/feedback/submissions/{submissionId}/advance',
      method: 'POST',
      pathParams: { submissionId },
      data: body,
      alert: false,
      timeout: 95000,
    }),
}
export const getFeedbackOptions = (area: 'development' | 'community' = 'development') =>
  instance({
    url: '/support/feedback/options',
    method: 'GET',
    params: { area },
    alert: false,
    timeout: 15000,
  })
