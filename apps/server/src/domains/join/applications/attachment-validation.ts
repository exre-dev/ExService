import { createHash } from 'node:crypto'
import { AuthError } from '@server/src/modules/auth/errors.js'
export interface JoinProofInput {
  originalName: string
  bytes: Buffer
}
export const MAX_PROOF_BYTES = 10 * 1024 * 1024
const extensions = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'bmp',
  'svg',
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'txt',
  'zip',
  'rar',
  '7z',
])
function starts(bytes: Buffer, header: number[]) {
  return bytes.length >= header.length && header.every((byte, index) => bytes[index] === byte)
}
function text(bytes: Buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new AuthError('JOIN_UNSUPPORTED_MEDIA_TYPE')
  }
}
function svgRoot(content: string) {
  // Each prefix advances the cursor past consumed input; never retry earlier prefixes.
  let cursor = 0
  while (cursor < content.length) {
    if (/\s/.test(content[cursor]!)) {
      cursor++
      continue
    }
    if (content.startsWith('<!--', cursor)) {
      const end = content.indexOf('-->', cursor + 4)
      if (end === -1) return false
      cursor = end + 3
      continue
    }
    if (content.startsWith('<?xml', cursor) && /\s/.test(content[cursor + 5] ?? '')) {
      const end = content.indexOf('?>', cursor + 5)
      if (end === -1) return false
      cursor = end + 2
      continue
    }
    if (!content.startsWith('<svg', cursor)) return false
    const delimiter = content[cursor + 4]
    return (
      delimiter === '>' ||
      (delimiter === '/' && content[cursor + 5] === '>') ||
      (delimiter !== undefined && /\s/.test(delimiter))
    )
  }
  return false
}
export function validateJoinProofs(
  proofs: JoinProofInput[],
  applicationType: 'new' | 'experienced',
) {
  if (!Array.isArray(proofs)) throw new AuthError('BAD_REQUEST')
  if (proofs.length > 5) throw new AuthError('JOIN_UPLOAD_TOO_LARGE')
  if (applicationType === 'new' && proofs.length) throw new AuthError('BAD_REQUEST')
  let total = 0
  return proofs.map((proof, ordinal) => {
    if (!proof || typeof proof.originalName !== 'string' || !Buffer.isBuffer(proof.bytes))
      throw new AuthError('BAD_REQUEST')
    const { originalName, bytes } = proof
    if (
      Array.from(originalName).length < 1 ||
      Array.from(originalName).length > 255 ||
      /[\/\\\u0000-\u001f\u007f-\u009f"<>:|?*]/u.test(originalName) ||
      originalName === '.' ||
      originalName === '..'
    )
      throw new AuthError('BAD_REQUEST')
    const extension = originalName.split('.').at(-1)!.toLowerCase()
    if (!originalName.includes('.') || !extensions.has(extension))
      throw new AuthError('JOIN_UNSUPPORTED_MEDIA_TYPE')
    if (bytes.length < 1) throw new AuthError('BAD_REQUEST')
    total += bytes.length
    if (bytes.length > MAX_PROOF_BYTES || total > 5 * MAX_PROOF_BYTES)
      throw new AuthError('JOIN_UPLOAD_TOO_LARGE')
    let valid = false
    switch (extension) {
      case 'png':
        valid = starts(bytes, [137, 80, 78, 71, 13, 10, 26, 10])
        break
      case 'jpg':
      case 'jpeg':
        valid = starts(bytes, [255, 216, 255])
        break
      case 'gif':
        valid = starts(bytes, [71, 73, 70, 56, 55, 97]) || starts(bytes, [71, 73, 70, 56, 57, 97])
        break
      case 'bmp':
        valid = starts(bytes, [66, 77])
        break
      case 'pdf':
        valid = starts(bytes, [37, 80, 68, 70, 45])
        break
      case 'doc':
      case 'xls':
      case 'ppt':
        valid = starts(bytes, [208, 207, 17, 224, 161, 177, 26, 225])
        break
      case 'zip':
      case 'docx':
      case 'xlsx':
      case 'pptx':
        valid =
          starts(bytes, [80, 75, 3, 4]) ||
          starts(bytes, [80, 75, 5, 6]) ||
          starts(bytes, [80, 75, 7, 8])
        break
      case 'rar':
        valid =
          starts(bytes, [82, 97, 114, 33, 26, 7, 0]) ||
          starts(bytes, [82, 97, 114, 33, 26, 7, 1, 0])
        break
      case '7z':
        valid = starts(bytes, [55, 122, 188, 175, 39, 28])
        break
      case 'txt':
        valid = !text(bytes).includes('\0')
        break
      case 'svg': {
        const content = text(bytes)
        valid =
          !content.includes('\0') && !/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(content) && svgRoot(content)
        break
      }
    }
    if (!valid) throw new AuthError('JOIN_UNSUPPORTED_MEDIA_TYPE')
    return {
      originalName,
      bytes,
      extension,
      byteLength: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      ordinal,
    }
  })
}
