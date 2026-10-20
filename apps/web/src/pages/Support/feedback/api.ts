import { instance } from '@workspace/sdk'
import type { FeedbackPort } from './flow'

export const feedbackPort: FeedbackPort = {
  prepare: (body, area) =>
    instance({
      url: '/api/support/feedback/submissions',
      method: 'POST',
      data: body,
      params: { area },
      alert: false,
      timeout: 15000,
    }).then((response) => response.data),
  get: (submissionId) =>
    instance({
      url: '/api/support/feedback/submissions/{submissionId}',
      method: 'GET',
      pathParams: { submissionId },
      alert: false,
      timeout: 15000,
    }).then((response) => response.data),
  lookup: (submissionKey) =>
    instance({
      url: '/api/support/feedback/submissions/lookup',
      method: 'GET',
      params: { submissionKey },
      alert: false,
      timeout: 15000,
    }).then((response) => response.data),
  upload: (submissionId, attachmentId, file) => {
    const body = new FormData()
    body.append('file', file, file.name)
    return instance({
      url: '/api/support/feedback/submissions/{submissionId}/attachments/{attachmentId}',
      method: 'PUT',
      pathParams: { submissionId, attachmentId },
      data: body,
      alert: false,
      timeout: 130000,
    }).then((response) => response.data)
  },
  advance: (submissionId, body) =>
    instance({
      url: '/api/support/feedback/submissions/{submissionId}/advance',
      method: 'POST',
      pathParams: { submissionId },
      data: body,
      alert: false,
      timeout: 95000,
    }).then((response) => response.data),
}
export const getFeedbackOptions = (area: 'development' | 'community' = 'development') =>
  instance({
    url: '/api/support/feedback/options',
    method: 'GET',
    alert: false,
    timeout: 15000,
  }).then((response) => response.data)
