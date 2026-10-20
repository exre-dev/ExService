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

it('consumes actual Node dist without ExUI, React or COS and keeps HTTP/storage on one singleton', () => {
  const root = fixture()
  dependency(root, 'axios', join(sdkRoot, 'node_modules/axios'))
  const output = node(
    root,
    `
    import assert from 'node:assert/strict'; import { createServer } from 'node:http';
    import * as sdk from '@workspace/sdk';
    assert.deepEqual(Object.keys(sdk).sort(), ['instance','storage','setBaseUrl','setAccessToken','setSessionExpiredHandler','ExAxiosError','StorageSdkError'].sort());
    assert.equal('setToken' in sdk.instance, false); assert.equal('GET' in sdk.instance, false);
    await assert.rejects(sdk.instance({url:'/health'}), error => error instanceof sdk.ExAxiosError && error.code === 'CONFIG_ERROR');
    const seen=[]; const server=createServer((req,res)=>{ seen.push(req.headers.authorization); req.resume(); req.on('end',()=>{
      res.setHeader('Content-Type','application/json');
      if(req.url.endsWith('/prepare')) res.end(JSON.stringify({medium:'file',maxBytes:1024}));
      else if(req.url.endsWith('/uploads')) res.end(JSON.stringify({url:'uploaded'}));
      else res.end(JSON.stringify({status:'ok'}));
    }) });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    try { sdk.setBaseUrl('http://127.0.0.1:'+server.address().port+'/api'); sdk.setAccessToken('shared-token');
      assert.deepEqual(await sdk.instance({url:'/health'}),{status:'ok'});
      assert.equal(await sdk.storage.upload('a.bin',new Uint8Array([1])),'uploaded');
      assert.deepEqual(seen,['Bearer shared-token','Bearer shared-token','Bearer shared-token']);
      for(const subpath of ['browser','node','http','http/browser','http/node','types','src/runtime']) {
        await assert.rejects(import('@workspace/sdk/'+subpath),{code:'ERR_PACKAGE_PATH_NOT_EXPORTED'});
      }
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

it('resolves actual public declarations and the generated-only NodeNext entry with no DOM or private dependencies', () => {
  const root = fixture()
  writeFileSync(
    join(root, 'server.mts'),
    "import type { paths, operations, components } from '@workspace/sdk/types';\ntype Health = paths['/health']['get'];\nexport type Contract = [Health, operations, components];\n",
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

it('preserves the actual dist binary 64 KiB error budget and session handling for blob and arraybuffer', () => {
  const root = fixture()
  dependency(root, 'axios', join(sdkRoot, 'node_modules/axios'))
  expect(
    node(
      root,
      `
    import assert from 'node:assert/strict'; import { createServer } from 'node:http';
    import * as sdk from '@workspace/sdk';
    const empty=JSON.stringify({error:{code:'SESSION_INVALID',message:'',requestId:'body-id'}});
    const payload=size=>JSON.stringify({error:{code:'SESSION_INVALID',message:'x'.repeat(size-Buffer.byteLength(empty)),requestId:'body-id'}});
    let mode='inside', handled=0, authorization;
    const server=createServer((req,res)=>{
      authorization=req.headers.authorization;
      if(req.url==='/api/health'){res.writeHead(200,{'content-type':'application/json'});res.end('{"status":"ok"}');return;}
      res.writeHead(401,{'content-type':mode==='media'?'text/plain':'application/json','x-request-id':'header-id'});
      res.end(mode==='inside'?payload(5077):mode==='boundary'?payload(65536):mode==='outside'?payload(65537):mode==='malformed'?JSON.stringify({error:{code:'SESSION_INVALID',message:'safe',requestId:'body-id',extra:true}}):mode==='invalid-json'?'{invalid':payload(5077));
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    sdk.setBaseUrl('http://127.0.0.1:'+server.address().port+'/api');
    sdk.setSessionExpiredHandler(()=>{handled++});
    try {
      for(const responseType of ['blob','arraybuffer']) {
        for(mode of ['inside','boundary','outside','media','malformed','invalid-json']) {
          const accepted=mode==='inside'||mode==='boundary'; const before=handled;
          sdk.setAccessToken('fixture-token');
          await assert.rejects(sdk.instance({url:'/storage/files',params:{key:'fixture'},responseType,alert:false}),error=>error instanceof sdk.ExAxiosError&&error.code===(accepted?'SESSION_INVALID':'HTTP_ERROR')&&error.requestId===(accepted?'body-id':'header-id'));
          assert.equal(handled,before+(accepted?1:0));
          await sdk.instance({url:'/health'}); assert.equal(authorization,accepted?undefined:'Bearer fixture-token');
        }
      }
      console.log('binary-budget-dist-ok');
    } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  `,
    ),
  ).toBe('binary-budget-dist-ok')
})

it('runs actual Browser dist with the real ExUI peer, one message host, session handling and no eager COS', async () => {
  const root = fixture()
  for (const name of ['axios', 'cos-js-sdk-v5', '@exre/exui'])
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
    import { createElement } from 'react'; import { createRoot } from 'react-dom/client';
    import { Toaster } from '@exre/exui'; import * as sdk from '@workspace/sdk';
    createRoot(document.getElementById('root')).render(createElement(Toaster,{duration:10000}));
    window.sdk=sdk; window.expired=[];
    sdk.setSessionExpiredHandler(context=>{window.expired.push({code:context.error.code,loginUrl:context.loginUrl})});
    window.ready=true;
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
  const entry = outputs.find((chunk) => chunk.type === 'chunk' && chunk.isEntry)
  expect(entry?.type === 'chunk' ? entry.code : '').not.toMatch(
    /TmpSecretId|TmpSecretKey|class COS/,
  )
  const cloudChunks = outputs
    .filter((chunk) => chunk.type === 'chunk' && chunk.isDynamicEntry)
    .map((chunk) => chunk.fileName)
  expect(cloudChunks.length).toBeGreaterThan(0)
  const received: string[] = []
  const server = createServer((request, response) => {
    if (request.url?.startsWith('/api/')) {
      received.push(request.headers.authorization ?? '')
      response.setHeader('content-type', 'application/json')
      if (request.url.endsWith('/auth/me')) {
        response.statusCode = 401
        response.end(
          JSON.stringify({
            error: {
              code: 'SESSION_INVALID',
              message: 'SDK fixture session expired',
              requestId: 'browser-dist',
            },
          }),
        )
      } else response.end('{"status":"ok"}')
      return
    }
    const pathname = new URL(request.url ?? '/', 'http://fixture').pathname
    const artifact = join(root, 'dist', pathname === '/' ? 'index.html' : pathname)
    try {
      response.setHeader(
        'content-type',
        artifact.endsWith('.js') ? 'application/javascript' : 'text/html',
      )
      response.end(readFileSync(artifact))
    } catch {
      response.statusCode = 404
      response.end()
    }
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Expected browser fixture address')
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    const loaded: string[] = []
    page.on('request', (request) => loaded.push(request.url()))
    await page.goto(`http://127.0.0.1:${address.port}`)
    await page.waitForFunction(() => (window as unknown as { ready: boolean }).ready)
    await page.evaluate(async () => {
      const scope = window as unknown as {
        sdk: {
          instance(config: object): Promise<unknown>
          ExAxiosError: new (...args: never[]) => Error
        }
        expired: unknown[]
        sameErrorClass: boolean
      }
      localStorage.setItem('exwebsite.auth.token', 'browser-token')
      await scope.sdk.instance({ url: '/health' })
      const failures = await Promise.allSettled([
        scope.sdk.instance({ url: '/auth/me' }),
        scope.sdk.instance({ url: '/auth/me' }),
      ])
      scope.sameErrorClass = failures.every(
        (result) => result.status === 'rejected' && result.reason instanceof scope.sdk.ExAxiosError,
      )
    })
    await expect
      .poll(async () => page.getByText('SDK fixture session expired', { exact: true }).count())
      .toBe(1)
    expect(await page.locator('[data-sonner-toaster]').count()).toBe(1)
    expect(
      await page.evaluate(() => (window as unknown as { expired: unknown[] }).expired),
    ).toEqual([{ code: 'SESSION_INVALID', loginUrl: `http://127.0.0.1:${address.port}/login` }])
    expect(await page.evaluate(() => localStorage.getItem('exwebsite.auth.token'))).toBeNull()
    expect(
      await page.evaluate(() => (window as unknown as { sameErrorClass: boolean }).sameErrorClass),
    ).toBe(true)
    expect(received).toEqual([
      'Bearer browser-token',
      'Bearer browser-token',
      'Bearer browser-token',
    ])
    expect(loaded.some((url) => /cos|storage-browser/i.test(url))).toBe(false)
    expect(loaded.some((url) => cloudChunks.some((chunk) => url.endsWith(chunk)))).toBe(false)
  } finally {
    await browser.close()
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})
