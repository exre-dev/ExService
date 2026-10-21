import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const localRoot = join(root, '.local/runtime')
