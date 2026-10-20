import type { Schema } from './types'

export type InstallationStatus = Schema<'SystemInstallationStatusData'>
export type InstallationForm = Schema<'SystemInstallInput'>
const failureMessage = '初始化请求失败，请检查服务后重试'
class InstallationRequestError extends Error {}

async function installationRequest(
  path: 'status' | 'install',
  body?: InstallationForm,
): Promise<unknown> {
  try {
    const response = await fetch(`/api/installation/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      cache: 'no-store',
      headers:
        body === undefined ? {} : { 'Content-Type': 'application/json', 'X-Setup-Request': '1' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const result: unknown = await response.json()
    if (
      response.status >= 400 &&
      response.status < 500 &&
      result &&
      typeof result === 'object' &&
      'msg' in result &&
      typeof result.msg === 'string' &&
      result.msg
    )
      throw new InstallationRequestError(result.msg)
    if (!response.ok || !result || typeof result !== 'object' || !('data' in result))
      throw new Error(failureMessage)
    return result.data
  } catch (cause) {
    throw cause instanceof InstallationRequestError ? cause : new Error(failureMessage)
  }
}
export async function getInstallationStatus(): Promise<InstallationStatus> {
  const data = await installationRequest('status')
  if (
    !data ||
    typeof data !== 'object' ||
    !('installed' in data) ||
    typeof data.installed !== 'boolean'
  )
    throw new Error(failureMessage)
  if ('ready' in data && typeof data.ready !== 'boolean') throw new Error(failureMessage)
  if (
    'checks' in data &&
    (!Array.isArray(data.checks) ||
      !data.checks.every(
        (check) =>
          check &&
          typeof check === 'object' &&
          typeof check.name === 'string' &&
          typeof check.passed === 'boolean',
      ))
  )
    throw new Error(failureMessage)
  return data as InstallationStatus
}
export async function install(body: InstallationForm): Promise<void> {
  await installationRequest('install', body)
}
