import { DatabaseConfigurationError } from '@server/src/db/client.js'
import { IdentityConfigError } from './config.js'
import { IdentityReadinessError } from './errors.js'

/** Classify database startup failures using trusted codes, never driver messages or connection strings. */
export function databaseReadinessError(error: unknown): IdentityReadinessError {
  if (error instanceof DatabaseConfigurationError)
    return new IdentityReadinessError(`INTEGRATION_CHECK_${error.code}`)
  const source = error as {
    code?: string
    cause?: { code?: string }
    errors?: Array<{ code?: string }>
  }
  const code = source?.code ?? source?.cause?.code ?? source?.errors?.[0]?.code
  const codes: Record<string, string> = {
    '28P01': 'AUTH_FAILED',
    '28000': 'AUTH_FAILED',
    '3D000': 'NOT_FOUND',
    ECONNREFUSED: 'CONNECTION_REFUSED',
    ENOTFOUND: 'DNS_FAILED',
    EAI_AGAIN: 'DNS_FAILED',
    ETIMEDOUT: 'TIMEOUT',
    ECONNRESET: 'CONNECTION_RESET',
  }
  return new IdentityReadinessError(`INTEGRATION_CHECK_DATABASE_${codes[code ?? ''] ?? 'INVALID'}`)
}

const databaseKeys = 'DATABASE_HOST、DATABASE_PORT、DATABASE_NAME、DATABASE_USER、DATABASE_PASSWORD'
const failures: Record<string, [string, string, string]> = {
  INTEGRATION_CHECK_DATABASE_URL_REQUIRED: [
    'Website 数据库连接未配置',
    databaseKeys,
    '在根 .env.local 填写 Website 数据库连接字段',
  ],
  INTEGRATION_CHECK_DATABASE_URL_INVALID: [
    'Website 数据库 URL 无效或目标不是独立 exre',
    databaseKeys,
    '核对连接字段，DATABASE_NAME 必须为 exre',
  ],
  INTEGRATION_CHECK_DATABASE_URL_OPTIONS_INVALID: [
    'Website 数据库连接选项不受支持或重复',
    'DATABASE_SSLMODE、DATABASE_SSLROOTCERT、DATABASE_CONNECT_TIMEOUT、DATABASE_OPTIONS',
    '只使用受支持的连接选项，删除覆盖 host、port、user、database 等目标的参数',
  ],
  INTEGRATION_CHECK_DATABASE_TLS_INVALID: [
    'Website 数据库 TLS 模式无效',
    'DATABASE_SSLMODE',
    '使用 disable、allow、prefer、require、verify-ca 或 verify-full',
  ],
  INTEGRATION_CHECK_DATABASE_TIMEOUT_INVALID: [
    'Website 数据库连接超时设置无效',
    'DATABASE_CONNECT_TIMEOUT',
    '设置 1–2147483 秒的整数',
  ],
  INTEGRATION_CHECK_DATABASE_AUTH_FAILED: [
    'Website 数据库认证失败',
    'DATABASE_USER、DATABASE_PASSWORD',
    '核对现有数据库角色和密码；修改容器初始化变量不会更改已有角色密码',
  ],
  INTEGRATION_CHECK_DATABASE_NOT_FOUND: [
    'Website 数据库 exre 不存在',
    'DATABASE_NAME',
    '显式创建独立 exre 及其 owner，再执行 pnpm db:migrate',
  ],
  INTEGRATION_CHECK_DATABASE_CONNECTION_REFUSED: [
    'Website 数据库连接被拒绝',
    'DATABASE_HOST、DATABASE_PORT',
    '核对地址和端口；本地依赖执行 pnpm service:status 和 pnpm service:start，远程数据库检查目标服务',
  ],
  INTEGRATION_CHECK_DATABASE_DNS_FAILED: [
    'Website 数据库主机无法解析',
    'DATABASE_HOST',
    '修正主机名或 DNS 配置',
  ],
  INTEGRATION_CHECK_DATABASE_TIMEOUT: [
    'Website 数据库连接超时',
    'DATABASE_HOST、DATABASE_PORT、DATABASE_CONNECT_TIMEOUT',
    '检查目标服务、网络和连接超时设置',
  ],
  INTEGRATION_CHECK_DATABASE_CONNECTION_RESET: [
    'Website 数据库连接中断',
    'DATABASE_HOST、DATABASE_PORT',
    '检查目标 PostgreSQL 日志和网络后重试',
  ],
  INTEGRATION_CHECK_DATABASE_IDENTITY_CONFLICT: [
    'Website 实际连接目标不是 exre',
    databaseKeys,
    '修正连接目标，不得连接 Outline 数据库',
  ],
  INTEGRATION_CHECK_DATABASE_SCHEMA_INVALID: [
    'Website schema 名称无效',
    'DATABASE_OPTIONS',
    '使用受控 public schema',
  ],
  INTEGRATION_CHECK_DATABASE_SCHEMA_CONFLICT: [
    'Website 实际 schema 与预期不一致',
    'DATABASE_OPTIONS',
    '核对 exre 中 public schema 是否存在及角色权限',
  ],
  INTEGRATION_CHECK_DATABASE_INVALID: [
    'Website 数据库检查失败，无法确定具体原因',
    databaseKeys,
    '核对连接字段和 PostgreSQL 日志；错误输出不会包含连接串、SQL 或秘密',
  ],
  INTEGRATION_CHECK_SCHEMA_NOT_READY: [
    'Website 表结构或 migration 未就绪',
    'DATABASE_NAME',
    '对现有 exre 显式执行 pnpm db:migrate；结构被手工修改时先核对迁移记录',
  ],
  INTEGRATION_CHECK_AUTH_KEY_INVALID: [
    'Website 认证密钥格式无效',
    'AUTH_CODE_HMAC_KEY',
    '填写既有的 64 位 hex 密钥，不要轮换已有环境的密钥',
  ],
  INTEGRATION_CHECK_STORAGE_INVALID: [
    'Website 存储配置无效',
    'STORAGE_DEFAULT_ADAPTER、STORAGE_MAX_BYTES',
    '核对所选存储适配器和文件大小设置',
  ],
  INTEGRATION_CHECK_CORS_INVALID: [
    'Website CORS 配置无效',
    'SERVER_CORS_ALLOWED_ORIGINS',
    '填写有效来源地址',
  ],
  INTEGRATION_CHECK_PUBLIC_WEB_INVALID: [
    'Website 公共地址无效',
    'PUBLIC_ORIGIN',
    '核对网站公共来源地址',
  ],
  INTEGRATION_CHECK_AVATAR_INVALID: [
    'Website 头像路径或公共地址无效',
    'SERVER_AVATAR_DIRECTORY、SERVER_PUBLIC_AVATAR_BASE_URL',
    '头像目录使用绝对路径，公共地址使用有效 URL',
  ],
  INTEGRATION_CHECK_ADMIN_NOT_ACTIVE: [
    '指定管理员账号不存在或已停用',
    '--admin-user-id',
    '由用户选择已有 active Website 账号 UUID',
  ],
  INTEGRATION_CHECK_ARGUMENTS_INVALID: [
    'Website 检查参数无效',
    '--admin-user-id',
    '不传参数，或仅传 --admin-user-id <已有账号 UUID>',
  ],
}

/** Produce actionable CLI-only diagnostics from fixed text; HTTP error envelopes remain unchanged. */
export function integrationCheckFailure(error: unknown): string {
  const code =
    error instanceof IdentityConfigError
      ? error.message
      : error instanceof IdentityReadinessError
        ? error.code
        : 'INTEGRATION_CHECK_FAILED'
  const failure = failures[code]
  if (failure) return `${code}；检查项：${failure[0]}；配置键：${failure[1]}；下一步：${failure[2]}`
  if (/^IDENTITY_CONFIG_INVALID:[A-Z][A-Z0-9_]*$/.test(code))
    return `${code}；检查项：Website 身份配置无效；配置键：${code.split(':')[1]}；下一步：修正根 .env.local 中该字段的格式与服务地址`
  return 'INTEGRATION_CHECK_FAILED；检查项：Website 启动检查未通过；下一步：检查 Website 服务日志及数据库结构；原始异常已隐藏'
}
