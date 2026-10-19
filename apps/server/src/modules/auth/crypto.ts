import {
  randomBytes as nodeRandomBytes,
  randomInt as nodeRandomInt,
  scrypt,
  timingSafeEqual,
} from 'node:crypto'
import { AuthError } from '@server/src/modules/auth/errors.js'

const SCRYPT_N = 32768
const SCRYPT_R = 8
const SCRYPT_P = 1
const SCRYPT_KEY_LENGTH = 64
const SCRYPT_MAXMEM = 64 * 1024 * 1024

export interface PasswordHasher {
  hash(password: string): Promise<string>
  verify(password: string, encodedHash: string): Promise<boolean>
}

class PasswordWorkGate {
  private active = 0
  private readonly waiters: Array<() => void> = []

  async run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.active >= 2) {
      if (this.waiters.length >= 16) {
        throw new AuthError('AUTH_BUSY', { retryAfterSeconds: 1 })
      }
      await new Promise<void>((resolve) => this.waiters.push(resolve))
    } else {
      this.active += 1
    }

    try {
      return await operation()
    } finally {
      const next = this.waiters.shift()
      // Hand the occupied slot directly to the waiter. Its resumed continuation
      // already owns this reservation, so an intervening request cannot steal it.
      if (next !== undefined) {
        next()
      } else {
        this.active -= 1
      }
    }
  }
}

export class ScryptPasswordHasher implements PasswordHasher {
  private readonly gate = new PasswordWorkGate()

  async hash(password: string): Promise<string> {
    return this.gate.run(async () => {
      const salt = nodeRandomBytes(16)
      const result = await derive(password, salt)
      return `scrypt$v1$N=${SCRYPT_N},r=${SCRYPT_R},p=${SCRYPT_P}$${salt.toString('base64url')}$${result.toString('base64url')}`
    })
  }

  async verify(password: string, encodedHash: string): Promise<boolean> {
    return this.gate.run(async () => {
      const parts = encodedHash.split('$')
      if (
        parts.length !== 5 ||
        parts[0] !== 'scrypt' ||
        parts[1] !== 'v1' ||
        parts[2] !== `N=${SCRYPT_N},r=${SCRYPT_R},p=${SCRYPT_P}`
      ) {
        return false
      }

      const saltPart = parts[3]
      const digestPart = parts[4]
      if (saltPart === undefined || digestPart === undefined) {
        return false
      }

      const salt = Buffer.from(saltPart, 'base64url')
      const expected = Buffer.from(digestPart, 'base64url')
      if (salt.length !== 16 || expected.length !== SCRYPT_KEY_LENGTH) {
        return false
      }

      const actual = await derive(password, salt)
      return timingSafeEqual(actual, expected)
    })
  }
}

async function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      SCRYPT_KEY_LENGTH,
      {
        N: SCRYPT_N,
        r: SCRYPT_R,
        p: SCRYPT_P,
        maxmem: SCRYPT_MAXMEM,
      },
      (error, derivedKey) => {
        if (error !== null) {
          reject(error)
          return
        }
        resolve(Buffer.from(derivedKey))
      },
    )
  })
}

export const secureRandom = {
  bytes: (length: number): Buffer => nodeRandomBytes(length),
  integer: (maximum: number): number => nodeRandomInt(0, maximum),
}

export function parseAuthCodeHmacKey(value: string | undefined): Buffer {
  if (value === undefined || !/^[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error('AUTH_CODE_HMAC_KEY 必须是 32 个随机字节的 64 位十六进制编码。')
  }
  return Buffer.from(value, 'hex')
}
