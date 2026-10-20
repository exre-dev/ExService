import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import { afterEach, expect, it } from 'vitest'
import { build } from 'vite'
import { chromium } from 'playwright'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const sdkRoot = join(repositoryRoot, 'packages/sdk')
const fixtures: string[] = []
afterEach(() => {
  for (const path of fixtures.splice(0)) {
    const target = resolve(path)
    if (
      dirname(target) !== resolve(tmpdir()) ||
      !target.startsWith(join(resolve(tmpdir()), 'exwebsite-sdk-dist-'))
    )
      throw new Error('Invalid owned SDK fixture directory')
    rmSync(target, { recursive: true, force: true })
  }
})
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'exwebsite-sdk-dist-'))
  fixtures.push(root)
  const destination = join(root, 'node_modules/@workspace/sdk')
  mkdirSync(destination, { recursive: true })
  cpSync(join(sdkRoot, 'dist'), join(destination, 'dist'), { recursive: true })
  cpSync(join(sdkRoot, 'package.json'), join(destination, 'package.json'))
  writeFileSync(join(root, 'package.json'), '{"private":true,"type":"module"}')
  return root
}
function dependency(root: string, name: string, installed: string) {
  const target = join(root, 'node_modules', name)
  mkdirSync(dirname(target), { recursive: true })
  symlinkSync(realpathSync(installed), target, 'junction')
}
function node(root: string, code: string, conditions: string[] = []) {
  const result = spawnSync(process.execPath, [...conditions, '--input-type=module', '-e', code], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  })
  expect(result.stderr, result.stdout).toBe('')
  expect(result.status, result.stderr).toBe(0)
  return result.stdout.trim()
}

it('consumes Node dist with one HTTP/storage singleton and only public exports', () => {
  const root = fixture()
  dependency(root, 'axios', join(sdkRoot, 'node_modules/axios'))
  const output = node(
    root,
    `
    import assert from 'node:assert/strict'; import { createServer } from 'node:http';
    import * as sdk from '@workspace/sdk';
    assert.deepEqual(Object.keys(sdk).sort(), ['instance','storage','setBaseUrl','setAccessToken','setSessionExpiredHandler','ExAxiosError','StorageSdkError'].sort());
    await assert.rejects(sdk.instance({url:'/api/health'}),e=>e.code==='CONFIG_ERROR');
    const seen=[]; const server=createServer((req,res)=>{seen.push([req.url,req.headers.authorization]);req.resume();req.on('end',()=>{res.setHeader('content-type','application/json');res.end(req.url.endsWith('/prepare')?JSON.stringify({msg:'ok',data:{medium:'file',maxBytes:1024}}):req.url.endsWith('/uploads')?JSON.stringify({msg:'ok',data:{url:'uploaded'}}):JSON.stringify({msg:'ok',data:{status:'ok'}}))})});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    try {sdk.setBaseUrl('http://127.0.0.1:'+server.address().port+'/backend');sdk.setAccessToken('shared-token');
      assert.deepEqual(await sdk.instance({url:'/api/health'}),{msg:'ok',data:{status:'ok'}});
      assert.equal(await sdk.storage.upload('a.bin',new Uint8Array([1])),'uploaded');
      assert.deepEqual(seen.map(x=>x[0]),['/backend/api/health','/backend/api/storage/uploads/prepare','/backend/api/storage/uploads']);
      assert.ok(seen.every(x=>x[1]==='Bearer shared-token'));
      for(const subpath of ['browser','node','http','types','src/runtime']) await assert.rejects(import('@workspace/sdk/'+subpath),{code:'ERR_PACKAGE_PATH_NOT_EXPORTED'});
      console.log('node-dist-ok');
    } finally { server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); }
  `,
  )
  expect(output).toBe('node-dist-ok')
  expect(node(root, "console.log(import.meta.resolve('@workspace/sdk'))")).toMatch(
    /\/dist\/node\.js$/,
  )
  expect(
    node(root, "console.log(import.meta.resolve('@workspace/sdk'))", ['--conditions=browser']),
  ).toMatch(/\/dist\/browser\.js$/)
  const missingPeer = spawnSync(
    process.execPath,
    ['--conditions=browser', '--input-type=module', '-e', "await import('@workspace/sdk')"],
    { cwd: root, encoding: 'utf8', windowsHide: true },
  )
  expect(missingPeer.status).not.toBe(0)
  expect(missingPeer.stderr).toContain('@exre/exui')
})

it('publishes PHP wire declarations through the generated-only NodeNext type entry', () => {
  const root = fixture()
  writeFileSync(
    join(root, 'server.mts'),
    "import type { paths, components } from '@workspace/sdk/types';\ntype Health = paths['/api/health']['get'];\ntype Me = components['schemas']['AccountMeData'];\nexport type Contract = [Health, Me];\n",
  )
  writeFileSync(
    join(root, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        lib: ['ES2022'],
        types: [],
        skipLibCheck: false,
        noEmit: true,
      },
      include: ['server.mts'],
    }),
  )
  const result = spawnSync(
    process.execPath,
    [join(repositoryRoot, 'node_modules/typescript/bin/tsc'), '-p', join(root, 'tsconfig.json')],
    { cwd: root, encoding: 'utf8', windowsHide: true },
  )
  expect(result.stdout + result.stderr).toBe('')
  expect(result.status).toBe(0)
  const sourceFixture = readFileSync(
    join(repositoryRoot, 'tests/sdk/types/types.fixture.ts'),
    'utf8',
  )
  writeFileSync(join(root, 'client.mts'), sourceFixture)
  writeFileSync(
    join(root, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        lib: ['ES2022', 'DOM'],
        types: [],
        skipLibCheck: false,
        noEmit: true,
      },
      include: ['client.mts'],
    }),
  )
  const client = spawnSync(
    process.execPath,
    [join(repositoryRoot, 'node_modules/typescript/bin/tsc'), '-p', join(root, 'tsconfig.json')],
    { cwd: root, encoding: 'utf8', windowsHide: true },
  )
  expect(client.stdout + client.stderr).toBe('')
  expect(client.status).toBe(0)
})

it('keeps the 64 KiB JSON error budget in built Node code', () => {
  const root = fixture()
  dependency(root, 'axios', join(sdkRoot, 'node_modules/axios'))
  expect(
    node(
      root,
      `
    import assert from 'node:assert/strict'; import { createServer } from 'node:http'; import * as sdk from '@workspace/sdk';
    let large=false;const server=createServer((_req,res)=>{res.writeHead(500,{'content-type':'application/json'});res.end(JSON.stringify({msg:large?'secret'.repeat(12000):'safe'}))});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));sdk.setBaseUrl('http://127.0.0.1:'+server.address().port);
    try {await assert.rejects(sdk.instance({url:'/api/health',responseType:'blob'}),e=>e.code==='HTTP_ERROR'&&e.message==='safe');large=true;
      await assert.rejects(sdk.instance({url:'/api/health',responseType:'arraybuffer'}),e=>e.code==='HTTP_ERROR'&&e.message==='请求失败，请稍后重试');console.log('budget-ok');
    }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
  `,
    ),
  ).toBe('budget-ok')
})

it('runs Browser dist with ExUI, scoped storage and protected 401 handling', async () => {
  const root = fixture()
  for (const name of ['axios', '@exre/exui'])
    dependency(root, name, join(sdkRoot, 'node_modules', name))
  for (const name of ['react', 'react-dom'])
    dependency(root, name, join(repositoryRoot, 'apps/web/node_modules', name))
  writeFileSync(
    join(root, 'index.html'),
    '<html><body><div id="root"></div><script type="module" src="/entry.js"></script></body></html>',
  )
  writeFileSync(
    join(root, 'entry.js'),
    `
    import { createElement } from 'react';import { createRoot } from 'react-dom/client';import { Toaster } from '@exre/exui';import * as sdk from '@workspace/sdk';
    createRoot(document.getElementById('root')).render(createElement(Toaster,{duration:10000}));
    window.sdk=sdk;window.expired=[];sdk.setSessionExpiredHandler(context=>window.expired.push({status:context.error.status,loginUrl:context.loginUrl}));window.ready=true;
  `,
  )
  const result = await build({
    root,
    configFile: false,
    logLevel: 'silent',
    resolve: { dedupe: ['react', 'react-dom', '@exre/exui'] },
    build: { minify: false },
  })
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((result) =>
    'output' in result ? result.output : [],
  )
  const code = outputs
    .filter((chunk) => chunk.type === 'chunk')
    .map((chunk) => chunk.code)
    .join('\n')
  expect(code).not.toMatch(/TmpSecretId|TmpSecretKey|class COS/)
  const received: string[] = []
  const server = createServer((request, response) => {
    if (request.url?.startsWith('/api/')) {
      received.push(request.headers.authorization ?? '')
      response.writeHead(request.url.endsWith('/auth/me') ? 401 : 200, {
        'content-type': 'application/json',
      })
      response.end(
        request.url.endsWith('/auth/me')
          ? JSON.stringify({ msg: 'SDK 会话已失效' })
          : JSON.stringify({ msg: 'ok', data: {} }),
      )
      return
    }
    const pathname = new URL(request.url ?? '/', 'http://fixture').pathname
    const artifact = join(root, 'dist', pathname === '/' ? 'index.html' : pathname)
    try {
      response.writeHead(200, {
        'content-type': artifact.endsWith('.js') ? 'application/javascript' : 'text/html',
      })
      response.end(readFileSync(artifact))
    } catch {
      response.writeHead(404)
      response.end()
    }
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw Error('Missing browser address')
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    await page.goto(`http://127.0.0.1:${address.port}`)
    await page.waitForFunction(() => (window as unknown as { ready: boolean }).ready)
    await page.evaluate(async () => {
      const scope = window as unknown as {
        sdk: { instance(config: object): Promise<unknown> }
        expired: unknown[]
      }
      localStorage.setItem(
        `exwebsite.php.auth.v1:${encodeURIComponent(location.origin)}`,
        'browser-token',
      )
      await scope.sdk.instance({ url: '/api/health' })
      await Promise.allSettled([
        scope.sdk.instance({ url: '/api/auth/me' }),
        scope.sdk.instance({ url: '/api/auth/me' }),
      ])
    })
    expect(received).toEqual([
      'Bearer browser-token',
      'Bearer browser-token',
      'Bearer browser-token',
    ])
    expect(
      await page.evaluate(() =>
        localStorage.getItem(`exwebsite.php.auth.v1:${encodeURIComponent(location.origin)}`),
      ),
    ).toBeNull()
    expect(
      await page.evaluate(() => (window as unknown as { expired: unknown[] }).expired),
    ).toEqual([{ status: 401, loginUrl: `http://127.0.0.1:${address.port}/login` }])
    await expect.poll(async () => page.getByText('SDK 会话已失效', { exact: true }).count()).toBe(1)
  } finally {
    await browser.close()
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})
