import { readClickUpConfig, type ClickUpConfig } from './config.js'
import { ClickUpError } from './errors.js'
import {
  createEnabledClickUpServices,
  type ClickUpServices,
  type ClickUpServiceOptions,
} from './service.js'
export type { ClickUpServices } from './service.js'

export function createClickUpServices(
  config: ClickUpConfig,
  options: ClickUpServiceOptions = {},
): ClickUpServices {
  if (config.kind === 'enabled') {
    // Validate even when the discriminated config is provided by an internal caller.
    const checked = readClickUpConfig({ CLICKUP_TOKEN: config.token })
    if (checked.kind === 'enabled') return createEnabledClickUpServices(checked.token, options)
    config = { kind: 'invalid', reason: 'configuration_invalid' }
  }
  const unavailable = async (): Promise<never> => {
    throw new ClickUpError('unavailable', 'CLICKUP_UNAVAILABLE')
  }
  return {
    available: false,
    reason: config.kind === 'disabled' ? 'not_configured' : 'configuration_invalid',
    getList: unavailable,
    getFields: unavailable,
    getTaskTypes: unavailable,
    getSpaceTags: unavailable,
    getTask: unavailable,
    listTasks: unavailable,
    createTask: unavailable,
    uploadAttachment: unavailable,
  }
}
