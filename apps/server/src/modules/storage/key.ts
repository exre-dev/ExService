import { StorageError } from '@server/src/modules/storage/errors.js'

/**
 * 可移植 key 的基本规则。Contract 的 `StorageKey` schema 用同一个 pattern 表达
 * “基本规则”，本文件再补充 schema 无法表达的语义（Windows 保留设备名）。
 *
 * 首版不清洗、不自动小写、不二次 URL 解码：非法输入明确失败，调用方自行生成兼容 key。
 */
export const STORAGE_KEY_PATTERN =
  /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9_-])?(?:\/[a-z0-9](?:[a-z0-9._-]*[a-z0-9_-])?)*$/

export const STORAGE_KEY_MAX_LENGTH = 240

/** Windows 设备名在任何目录、任何扩展名下都是保留名。 */
const RESERVED_DEVICE_NAMES = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  ...Array.from({ length: 9 }, (_, index) => `com${index + 1}`),
  ...Array.from({ length: 9 }, (_, index) => `lpt${index + 1}`),
])

/**
 * 校验并返回规范化 key。
 *
 * 通过校验的 key 只含 ASCII 小写字母、数字、点、下划线、连字符与 `/` 分隔符，
 * 因此不含空段、`.`、`..`、反斜杠、盘符、前后斜杠、控制字符与百分号编码。
 */
export function assertStorageKey(key: unknown): string {
  if (typeof key !== 'string' || key.length === 0 || key.length > STORAGE_KEY_MAX_LENGTH) {
    throw new StorageError('STORAGE_INVALID_INPUT')
  }
  if (!STORAGE_KEY_PATTERN.test(key)) {
    throw new StorageError('STORAGE_INVALID_INPUT')
  }
  for (const segment of key.split('/')) {
    // `con.txt` 与 `con` 都是保留名，因此只取第一个点之前的基名比较。
    if (RESERVED_DEVICE_NAMES.has(segment.split('.')[0]!.toLowerCase())) {
      throw new StorageError('STORAGE_INVALID_INPUT')
    }
  }
  return key
}

/** Content-Disposition 的 filename 只取最后一个已校验的段。 */
export function lastKeySegment(key: string): string {
  const segments = key.split('/')
  return segments[segments.length - 1] ?? key
}

/**
 * quoted-string 编码：转义反斜杠与双引号，并丢弃控制字符。
 * 段字符集本身不含控制字符，这里仍然防御，因为响应头是逐字节拼接的。
 */
export function quotedStringFilename(name: string): string {
  let encoded = ''
  for (const character of name) {
    if (character === '\\' || character === '"') {
      encoded += `\\${character}`
    } else if (character < ' ' || character === '\u007f') {
      continue
    } else {
      encoded += character
    }
  }
  return `"${encoded}"`
}
