import { randomBytes } from 'node:crypto'
import { lstat, mkdir, open, rename, rm } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import type { Readable } from 'node:stream'
import type { StorageAdapter } from '@server/src/modules/storage/service.js'
import { StorageError } from '@server/src/modules/storage/errors.js'
import { assertStorageKey } from '@server/src/modules/storage/key.js'

export interface StoredFileRead {
  stream: Readable
  bytes: number
  release: () => Promise<void>
}

/**
 * 本地文件介质。
 *
 * 可信前提是 `data` 根目录不会被其他不受信任的本地进程写入：
 * 这里的 key 与路径检查用于拦截 HTTP 输入，不声称能防住具备本地文件系统写权限的并发攻击者。
 */
export class FileAdapter implements StorageAdapter {
  constructor(
    private readonly root: string,
    private readonly tmpRoot: string,
    private readonly publicApiBaseUrl: string,
  ) {}

  /**
   * 把已校验的 key 解析为 uploads 根内的绝对路径。
   *
   * 逐段 lstat：已存在的父段必须是真实目录（拒绝符号链接与 junction），
   * 不存在的父段按需创建；返回的目标路径始终位于根目录内。
   */
  private async resolveTarget(key: string): Promise<string> {
    if (!(await this.insideRoot(this.root))) {
      throw new StorageError('INTERNAL_ERROR')
    }
    const segments = key.split('/')
    let current = this.root
    await mkdir(current, { recursive: true })

    for (let index = 0; index < segments.length - 1; index++) {
      current = this.child(current, segments[index]!)
      const existing = await lstatOrUndefined(current)
      if (existing === undefined) {
        // 父段是文件时 mkdir 会得到 ENOTDIR / EEXIST，即路径前缀冲突。
        await this.mkdirOrConflict(current)
        continue
      }
      if (existing.isSymbolicLink() || !existing.isDirectory()) {
        throw new StorageError('STORAGE_CONFLICT')
      }
    }

    const target = this.child(current, segments[segments.length - 1]!)
    // 最终段同样要检查：已存在的目标若是链接，写入或读取都会越过 uploads 根目录。
    const existing = await lstatOrUndefined(target)
    if (existing !== undefined && (existing.isSymbolicLink() || !existing.isFile())) {
      throw new StorageError('STORAGE_CONFLICT')
    }
    return target
  }

  private child(parent: string, segment: string): string {
    const next = resolve(parent, segment)
    // key 不含 `..`，这里仍然显式复核，避免解析规则变化时越界。
    if (dirname(next) !== parent || !this.isInside(next))
      throw new StorageError('STORAGE_INVALID_INPUT')
    return next
  }

  private isInside(candidate: string): boolean {
    return candidate === this.root || candidate.startsWith(this.root + sep)
  }

  /**
   * 根本身必须是真实目录，不能是符号链接或 junction。
   *
   * 这里刻意不比较 `realpath(dir) === dir`：Windows 上 `os.tmpdir()` 返回 8.3 短名
   * （`GRIMES~1`），而 realpath 返回长名，字符串相等会误判，且这种比较对安全没有额外价值。
   * 越界防护由上层的段级 lstat 与 `isInside` 前缀检查承担。
   */
  private async insideRoot(directory: string): Promise<boolean> {
    try {
      const stats = await lstat(directory)
      return stats.isDirectory() && !stats.isSymbolicLink()
    } catch {
      return false
    }
  }

  private async mkdirOrConflict(directory: string): Promise<void> {
    try {
      await mkdir(directory)
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code === 'EEXIST') {
        // 其他上传可能已创建同一父目录；仍要拒绝文件、符号链接和 junction。
        const existing = await lstatOrUndefined(directory)
        if (existing?.isDirectory() && !existing.isSymbolicLink()) return
      }
      if (code === 'ENOTDIR' || code === 'EEXIST') throw new StorageError('STORAGE_CONFLICT')
      throw new StorageError('INTERNAL_ERROR')
    }
  }

  async put(_key: string, bytes: Uint8Array, _contentType: string): Promise<void> {
    const key = assertStorageKey(_key)
    const target = await this.resolveTarget(key)
    await mkdir(this.tmpRoot, { recursive: true })
    const temporary = resolve(this.tmpRoot, randomBytes(24).toString('hex'))

    let handle: Awaited<ReturnType<typeof open>> | undefined
    try {
      // 独占创建：不覆盖既有临时文件，也不让临时文件预先存在于公开读取目录。
      handle = await open(temporary, 'wx', 0o600)
      await handle.write(bytes)
      await handle.close()
      handle = undefined
    } catch (error) {
      if (handle !== undefined) await handle.close().catch(() => undefined)
      await rm(temporary, { force: true }).catch(() => undefined)
      throw mapWriteError(error)
    }

    try {
      // 先完整写入再 rename 替换：不先 unlink 旧目标，替换失败时已有内容仍可读。
      await rename(temporary, target)
    } catch (error) {
      await rm(temporary, { force: true }).catch(() => undefined)
      throw mapWriteError(error)
    }
  }

  async getUrl(key: string): Promise<string> {
    const validated = assertStorageKey(key)
    return `${this.publicApiBaseUrl}/storage/files?key=${encodeURIComponent(validated)}`
  }

  /**
   * 先安全打开文件描述符并确认普通文件，再用该描述符产生流与大小，
   * 避免检查后重新按路径打开带来的 TOCTOU 窗口。
   */
  async openRead(key: string): Promise<StoredFileRead> {
    const validated = assertStorageKey(key)
    const target = await this.resolveTarget(validated)
    let handle: Awaited<ReturnType<typeof open>> | undefined
    try {
      handle = await open(target, 'r')
      const stats = await handle.stat()
      if (!stats.isFile()) throw new StorageError('STORAGE_CONFLICT')
      const fileHandle = handle
      // 流与句柄共享关闭状态，避免 destroy 与 FileHandle.close 重复关闭裸 fd。
      const stream = fileHandle.createReadStream({ autoClose: false })
      return {
        stream,
        bytes: stats.size,
        release: async () => {
          stream.destroy()
          await fileHandle.close().catch(() => undefined)
        },
      }
    } catch (error) {
      if (handle !== undefined) await handle.close().catch(() => undefined)
      throw mapReadError(error)
    }
  }
}

async function lstatOrUndefined(path: string) {
  try {
    return await lstat(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    if ((error as NodeJS.ErrnoException).code === 'ENOTDIR')
      throw new StorageError('STORAGE_CONFLICT')
    throw new StorageError('INTERNAL_ERROR')
  }
}

function mapWriteError(error: unknown): StorageError {
  if (error instanceof StorageError) return error
  const code = (error as NodeJS.ErrnoException).code
  // 路径前缀冲突：已有文件挡在目录路径上。
  if (code === 'ENOTDIR' || code === 'EEXIST' || code === 'EISDIR')
    return new StorageError('STORAGE_CONFLICT')
  if (code === 'ENOENT') return new StorageError('STORAGE_NOT_FOUND')
  // 这些 errno 都归为内部故障：Windows 上目标被占用时 rename 会失败（EBUSY/EPERM/EACCES），
  // 只读文件系统（EROFS）与磁盘写满（ENOSPC）同样不可对外细分；已有内容保持可读，临时文件已清理。
  return new StorageError('INTERNAL_ERROR')
}

function mapReadError(error: unknown): StorageError {
  if (error instanceof StorageError) return error
  const code = (error as NodeJS.ErrnoException).code
  if (code === 'ENOENT' || code === 'ENOTDIR') return new StorageError('STORAGE_NOT_FOUND')
  if (code === 'EISDIR') return new StorageError('STORAGE_CONFLICT')
  return new StorageError('INTERNAL_ERROR')
}
