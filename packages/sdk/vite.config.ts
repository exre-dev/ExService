import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const packageRoot = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: packageRoot,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
    target: 'es2022',
    lib: {
      entry: {
        browser: resolve(packageRoot, 'src/browser.ts'),
        node: resolve(packageRoot, 'src/node.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['axios', '@exre/exui'],
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
    },
  },
})
