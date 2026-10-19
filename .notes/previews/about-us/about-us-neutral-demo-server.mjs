// Temporary local visual demo. Run: node .notes/previews/about-us/about-us-neutral-demo-server.mjs
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const files = new Map([
  ['/', ['about-us-neutral-prototype.html', 'text/html; charset=utf-8']],
  ['/refined', ['about-us-refined-prototype.html', 'text/html; charset=utf-8']],
  [
    '/exui.css',
    ['../../../apps/web/node_modules/@exre/exui/dist/index.css', 'text/css; charset=utf-8'],
  ],
  ['/ExIcon.svg', ['../../../apps/web/public/ExIcon.svg', 'image/svg+xml']],
])
createServer(async (request, response) => {
  const path = new URL(request.url, 'http://127.0.0.1').pathname
  const entry = files.get(path)
  if (!entry) {
    response.writeHead(404)
    response.end()
    return
  }
  try {
    const data = await readFile(fileURLToPath(new URL(entry[0], import.meta.url)))
    response.writeHead(200, { 'Content-Type': entry[1], 'Cache-Control': 'no-store' })
    response.end(data)
  } catch {
    response.writeHead(500)
    response.end('Demo resource unavailable')
  }
}).listen(8199, '127.0.0.1', () => console.log('About Demo: http://127.0.0.1:8199/?variant=A'))
