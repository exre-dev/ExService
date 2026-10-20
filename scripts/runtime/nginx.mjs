import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { listOperations, readContract } from '../api/read-contract.mjs'
import { RuntimeError } from './output.mjs'

/**
 * Closed Docs registration shapes from the approved Contract appendix §5; only these keys are allowed.
 * `content`/`command` carry a JSON body, `read`/`reserved-upload` carry none.
 */
const DOCS_BODY_KINDS = new Set(['content', 'command'])
const DOCS_KINDS = new Set([...DOCS_BODY_KINDS, 'read', 'reserved-upload'])

function docsBudgetInvalid(keys) {
  return new RuntimeError('NGINX_DOCS_BUDGET_INVALID', { keys })
}

/**
 * Largest Docs JSON body wire budget declared by the same generated Contract.
 *
 * Derived, never duplicated: read/reserved-upload do not participate, and a missing or
 * malformed Docs registration refuses to render instead of silently falling back to the
 * support/storage budgets.
 */
export function docsWireBytes(contract) {
  const budgets = []
  for (const { operation, location } of listOperations(contract)) {
    const config = operation['x-fastify-config']?.docs
    if (config === undefined) continue
    if (!config || typeof config !== 'object' || Array.isArray(config))
      throw docsBudgetInvalid([location])
    const keys = Object.keys(config)
    if (!DOCS_KINDS.has(config.kind)) throw docsBudgetInvalid([location])
    if (DOCS_BODY_KINDS.has(config.kind)) {
      if (
        keys.length !== 2 ||
        !keys.includes('wireBytes') ||
        !Number.isSafeInteger(config.wireBytes) ||
        config.wireBytes <= 0
      )
        throw docsBudgetInvalid([location])
      budgets.push(config.wireBytes)
    } else if (keys.length !== 1) throw docsBudgetInvalid([location])
  }
  if (!budgets.length) throw docsBudgetInvalid(['x-fastify-config.docs'])
  return Math.max(...budgets)
}

/** Renders validated deployment addresses. Installation/reload remain explicit operator actions. */
export function nginxConfiguration(state) {
  if (state.profile !== 'deployment') throw new RuntimeError('DEPLOYMENT_PROFILE_REQUIRED')
  const origin = new URL(state.config.publicOrigin),
    issuer = new URL(state.config.issuer)
  if (origin.hostname === issuer.hostname || origin.port || issuer.port)
    throw new RuntimeError('NGINX_DISTINCT_HTTPS_HOSTS_REQUIRED')
  const contract = readContract(join(state.workspace, 'api/generated/openapi.json'))
  const supportBytes =
    contract.paths['/support/feedback/submissions/{submissionId}/attachments/{attachmentId}'].put[
      'x-fastify-config'
    ].supportUpload.wireBytes
  const overheadBytes =
    contract.paths['/storage/uploads'].post['x-fastify-config'].storageUpload.wireOverheadBytes
  const docsWire = docsWireBytes(contract)
  // Match the storage parser's default; the proxy ceiling includes multipart metadata.
  const raw = state.values.STORAGE_MAX_BYTES
  const storageBytes = Number(raw === undefined || raw === '' ? 20 * 1024 * 1024 : raw)
  const storageWireBytes = storageBytes + overheadBytes
  if (
    (raw !== undefined && raw !== '' && !/^[0-9]+$/.test(raw)) ||
    ![supportBytes, overheadBytes, storageBytes, storageWireBytes, docsWire].every(
      (value) => Number.isSafeInteger(value) && value > 0,
    )
  )
    throw new RuntimeError('NGINX_UPLOAD_BUDGET_INVALID', { keys: ['STORAGE_MAX_BYTES'] })
  const values = {
    API_MAX_BODY_BYTES: String(Math.max(supportBytes, storageWireBytes, docsWire)),
    SITE_HOST: origin.hostname,
    ISSUER_HOST: issuer.hostname,
    SITE_ROOT: join(state.workspace, 'apps/web/dist').replaceAll('\\', '/'),
    API_UPSTREAM: state.internal.website.replace(/\/$/, ''),
    HYDRA_UPSTREAM: state.values.HYDRA_INTERNAL_PUBLIC_URL?.replace(/\/$/, ''),
    SITE_CERT: state.values.NGINX_SITE_CERT,
    SITE_KEY: state.values.NGINX_SITE_KEY,
    ISSUER_CERT: state.values.NGINX_ISSUER_CERT,
    ISSUER_KEY: state.values.NGINX_ISSUER_KEY,
  }
  for (const [key, value] of Object.entries(values)) {
    if (!value || /[\s;{}$'"\\]/.test(value))
      throw new RuntimeError('NGINX_VALUE_INVALID', { keys: [key] })
    if (key.endsWith('UPSTREAM')) {
      let url
      try {
        url = new URL(value)
      } catch {
        throw new RuntimeError('NGINX_UPSTREAM_INVALID', { keys: [key] })
      }
      if (
        url.protocol !== 'http:' ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        url.pathname !== '/'
      )
        throw new RuntimeError('NGINX_UPSTREAM_INVALID', { keys: [key] })
    }
  }
  return readFileSync(join(state.workspace, 'infra/runtime/nginx.conf.template'), 'utf8').replace(
    /@@([A-Z_]+)@@/g,
    (_, key) => values[key],
  )
}
export function renderNginx(state) {
  const content = nginxConfiguration(state),
    directory = join(state.directory, 'nginx')
  mkdirSync(directory, { recursive: true })
  const file = join(directory, 'nginx.conf')
  writeFileSync(file, content, { mode: 0o600 })
  return file
}
