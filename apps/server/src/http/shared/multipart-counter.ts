import { Transform } from 'node:stream'

export interface MultipartWireLimits {
  /** 原始 multipart wire 字节上限，包含 boundary、头与分隔符的全部开销。 */
  wireBytes: number
  headerBytes: number
  headerPairs: number
}

export interface MultipartWireErrors {
  /** 413：wire 字节或 header 预算超限。 */
  tooLarge(): Error
  /** 400：结构非法。 */
  malformed(): Error
  /** 415：请求本身不是 multipart。 */
  unsupportedMediaType(): Error
}

/**
 * 受控 wire 计数器。
 *
 * `@fastify/multipart` 10 直接消费 `request.raw`，而不是 Fastify 的 preParsing payload，
 * 因此仅仅返回一个 preParsing Transform 并不能保证字节受限：必须把这个计数流接入实际解析路径。
 *
 * 同时在这里强制 header 预算 —— busboy 自己的 header parser 会把超长头静默截断，
 * 不先拦截就等于没有限制。
 */
export class MultipartWireCounter extends Transform {
  receivedEncodedLength = 0
  private pending = Buffer.alloc(0)
  private phase: 'preamble' | 'headers' | 'body' | 'suffix' | 'done' = 'preamble'
  private readonly boundary: Buffer
  private readonly firstBoundary: Buffer

  constructor(
    boundary: string,
    private readonly limits: MultipartWireLimits,
    private readonly errors: MultipartWireErrors,
  ) {
    super()
    this.boundary = Buffer.from(`\r\n--${boundary}`)
    this.firstBoundary = Buffer.from(`--${boundary}`)
  }

  override _transform(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error | null, data?: Buffer) => void,
  ): void {
    try {
      this.receivedEncodedLength += chunk.length
      if (this.receivedEncodedLength > this.limits.wireBytes) throw this.errors.tooLarge()
      this.scan(chunk)
      callback(null, chunk)
    } catch (error) {
      callback(error as Error)
    }
  }

  /**
   * 正常结束时解除边界扫描保留的 pending buffer。
   *
   * 这里只补资源清理，不改变扫描算法或 wire 预算；扫描已在最后一个 chunk 完成，
   * `_flush` 之后没有任何路径再读 pending。
   */
  override _flush(callback: (error?: Error | null, data?: Buffer) => void): void {
    this.pending = Buffer.alloc(0)
    callback(null)
  }

  /** 销毁时同样解除 pending：`Transform.destroy` 本身不清该字段。 */
  override _destroy(error: Error | null, callback: (error?: Error | null) => void): void {
    this.pending = Buffer.alloc(0)
    super._destroy(error, callback)
  }

  private scan(chunk: Buffer): void {
    this.pending = Buffer.concat([this.pending, chunk])
    for (;;) {
      if (this.phase === 'done') {
        this.pending = Buffer.alloc(0)
        return
      }
      if (this.phase === 'preamble') {
        const index = this.pending.indexOf(this.firstBoundary)
        if (index < 0) {
          this.pending = this.pending.subarray(
            Math.max(0, this.pending.length - this.firstBoundary.length),
          )
          return
        }
        this.pending = this.pending.subarray(index + this.firstBoundary.length)
        this.phase = 'suffix'
      } else if (this.phase === 'suffix') {
        if (this.pending.length < 2) return
        if (this.pending.subarray(0, 2).equals(Buffer.from('--'))) {
          this.phase = 'done'
          continue
        }
        if (!this.pending.subarray(0, 2).equals(Buffer.from('\r\n'))) throw this.errors.malformed()
        this.pending = this.pending.subarray(2)
        this.phase = 'headers'
      } else if (this.phase === 'headers') {
        const end = this.pending.indexOf('\r\n\r\n')
        if ((end < 0 ? this.pending.length : end + 4) > this.limits.headerBytes)
          throw this.errors.tooLarge()
        if (end < 0) return
        const lines = this.pending.subarray(0, end).toString('latin1').split('\r\n')
        if (lines.length > this.limits.headerPairs) throw this.errors.tooLarge()
        if (lines.some((line) => !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+:/.test(line)))
          throw this.errors.malformed()
        this.pending = this.pending.subarray(end + 4)
        this.phase = 'body'
      } else {
        const index = this.pending.indexOf(this.boundary)
        if (index < 0) {
          this.pending = this.pending.subarray(
            Math.max(0, this.pending.length - this.boundary.length - 2),
          )
          return
        }
        // 只有分隔符后缀才算数；同样的字节可能出现在文件内容里。
        const suffix = this.pending.subarray(
          index + this.boundary.length,
          index + this.boundary.length + 2,
        )
        if (suffix.length < 2) {
          this.pending = this.pending.subarray(index)
          return
        }
        if (!suffix.equals(Buffer.from('--')) && !suffix.equals(Buffer.from('\r\n'))) {
          this.pending = this.pending.subarray(index + 2)
          continue
        }
        this.pending = this.pending.subarray(index + this.boundary.length)
        this.phase = 'suffix'
      }
    }
  }
}

/** 非 multipart 请求直接 415；boundary 缺失或非法属于坏请求。 */
export function multipartBoundary(
  contentType: string | undefined,
  errors: MultipartWireErrors,
): string {
  if (typeof contentType !== 'string' || !/^multipart\/form-data(?:\s*;|$)/i.test(contentType)) {
    throw errors.unsupportedMediaType()
  }
  const match = /(?:^|;)\s*boundary=(?:"([^"\r\n]+)"|([^;\s]+))/i.exec(contentType)
  const boundary = match?.[1] ?? match?.[2]
  if (boundary === undefined || boundary.length > 200 || /[\r\n]/.test(boundary))
    throw errors.malformed()
  return boundary
}
