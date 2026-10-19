import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { copyFile } from 'node:fs/promises'
import { dts } from 'rollup-plugin-dts'
const packageRoot = dirname(fileURLToPath(import.meta.url))
export default {
  input: resolve(packageRoot, 'src/index.ts'),
  output: { file: resolve(packageRoot, 'dist/index.d.ts'), format: 'es' },
  plugins: [
    dts({ tsconfig: resolve(packageRoot, 'tsconfig.build.json'), respectExternal: true }),
    {
      name: 'copy-raw-contract-types',
      async writeBundle() {
        await copyFile(
          resolve(packageRoot, 'src/generated/schema.d.ts'),
          resolve(packageRoot, 'dist/schema.d.ts'),
        )
      },
    },
  ],
  external: [],
}
