// Run: node tests/browser/exui-v1-overlays.mjs
// Isolated Chromium acceptance for real overlays; all identities and actions are test fixtures.
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runBrowserSuite } from './browser-suite.mjs'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const evidence = resolve(repository, 'output/playwright/exui-v1-overlays')
const fixturePath = resolve(repository, 'tests/browser/exui-v1-overlays-fixture.tsx').replaceAll(
  '\\',
  '/',
)
const results = []
const settle = (page) =>
  page.evaluate(async () => {
    await document.fonts.ready
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
  })
const visibleInViewport = (locator) =>
  locator.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.top >= -1 &&
      rect.bottom <= innerHeight + 1 &&
      rect.left >= -1 &&
      rect.right <= innerWidth + 1
    )
  })
const snapshot = (page) =>
  page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    rootPx: parseFloat(getComputedStyle(document.documentElement).fontSize),
    theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
    colorScheme: getComputedStyle(document.documentElement).colorScheme,
    horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
  }))
async function run(name, action) {
  if (process.argv.includes('--auth-only') && !name.startsWith('auth modal')) return
  if (process.argv.includes('--message-only') && !name.startsWith('single ExMessage')) return
  if (process.argv.includes('--dialogs-only') && !name.startsWith('OIDC')) return
  try {
    results.push({ name, status: 'PASS', ...(await action()) })
    console.log(`PASS ${name}`)
  } catch (error) {
    results.push({ name, status: 'FAIL', error: String(error?.stack ?? error) })
    console.error(`FAIL ${name}: ${error?.stack ?? error}`)
  }
}
async function openFixture(page, origin, mode, scheme, viewport, rootPx, reduce = false) {
  await page.setViewportSize(viewport)
  await page.emulateMedia({
    colorScheme: scheme,
    reducedMotion: reduce ? 'reduce' : 'no-preference',
  })
  await page.goto(`${origin}/__exui_v1_overlays.html?mode=${mode}`)
  await page.evaluate((size) => {
    document.documentElement.style.fontSize = `${size}px`
  }, rootPx)
  await settle(page)
  const trigger =
    mode === 'oidc'
      ? page.getByRole('button', { name: '隔离测试应用将获取哪些信息？' })
      : page.getByRole('button', {
          name: mode.startsWith('join-') ? '打开测试申请弹窗' : '打开测试认证弹窗',
        })
  await trigger.click()
  const dialog = page.getByRole('dialog')
  await dialog.waitFor()
  await settle(page)
  return { trigger, dialog }
}
async function wheelInside(page, container, delta = 600) {
  const before = await container.evaluate((element) => ({
    top: element.scrollTop,
    max: element.scrollHeight - element.clientHeight,
    overflow: getComputedStyle(element).overflowY,
    rect: element.getBoundingClientRect().toJSON(),
  }))
  const x = Math.max(
    1,
    Math.min(before.rect.x + before.rect.width / 2, page.viewportSize().width - 1),
  )
  const y = Math.max(
    1,
    Math.min(before.rect.y + before.rect.height / 2, page.viewportSize().height - 1),
  )
  const hit = await page.evaluate(
    ({ x, y }) => {
      const element = document.elementFromPoint(x, y)
      return {
        tag: element?.tagName,
        className: typeof element?.className === 'string' ? element.className : null,
        text: element?.textContent?.slice(0, 70),
      }
    },
    { x, y },
  )
  await page.mouse.move(x, y)
  await page.mouse.wheel(0, delta)
  await page.waitForTimeout(80)
  const after = await container.evaluate((element) => element.scrollTop)
  return { ...before, x, y, hit, after }
}
async function keyboardReach(page, locator, maxTabs = 40) {
  // Starting at a dialog control, real Tab navigation must focus the target and scroll it into view.
  const visited = []
  for (let index = 0; index < maxTabs; index++) {
    if (await locator.evaluate((element) => document.activeElement === element))
      return { tabs: index, inViewport: await visibleInViewport(locator), visited }
    if (visited.length < 12)
      visited.push(
        await page.evaluate(() => ({
          tag: document.activeElement?.tagName,
          text:
            document.activeElement?.getAttribute('aria-label') ??
            document.activeElement?.textContent?.slice(0, 30),
        })),
      )
    await page.keyboard.press('Tab')
  }
  return { tabs: null, inViewport: false, visited }
}

const outcome = await runBrowserSuite({
  repository,
  output: evidence,
  results,
  fixture: {
    name: 'isolated-exui-v1-overlays',
    route: '/__exui_v1_overlays.html',
    path: fixturePath,
  },
  run: async ({ browser, origin }) => {
    await run(
      'auth modal and Login/Invitation/Captcha forms across themes and viewports',
      async () => {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
        const page = await context.newPage(),
          rows = [],
          errors = [],
          apiRequests = [],
          issues = []
        page.on('pageerror', (error) => errors.push(error.message))
        page.on('request', (request) => {
          if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url())
        })
        try {
          const modes = [
            'login',
            'captcha',
            'invitation-email',
            'invitation-code',
            'invitation-profile',
          ]
          for (const mode of modes)
            for (const scheme of ['light', 'dark']) {
              const viewport =
                scheme === 'light' ? { width: 1440, height: 900 } : { width: 390, height: 844 }
              const { trigger, dialog } = await openFixture(
                page,
                origin,
                mode,
                scheme,
                viewport,
                16,
                scheme === 'dark',
              )
              const state = await snapshot(page)
              assert.equal(state.theme, scheme)
              assert.equal(state.colorScheme, scheme)
              assert(state.horizontalOverflow <= 1, `${mode}/${scheme} horizontal overflow`)
              assert((await dialog.getByRole('heading').count()) > 0)
              const firstField = dialog.locator('input').first()
              assert(await visibleInViewport(firstField), `${mode}/${scheme} first field visible`)
              if (mode === 'login') {
                await dialog.getByRole('button', { name: '继续' }).click()
                assert(await dialog.getByText('请输入有效的邮箱地址').isVisible())
                await dialog.getByRole('textbox', { name: '邮箱' }).fill('fixture@example.test')
                await dialog.locator('input[type=password]').fill('fixturepass')
                await dialog.getByRole('button', { name: '继续' }).click()
                assert.equal(await page.locator('[data-submissions]').textContent(), '1')
              } else if (mode === 'invitation-email') {
                await dialog.getByRole('textbox', { name: '邮箱' }).fill('fixture@example.test')
                await dialog.getByRole('button', { name: '继续' }).click()
                assert.equal(await page.locator('[data-submissions]').textContent(), '1')
              } else if (mode === 'captcha') {
                assert(
                  await dialog
                    .getByText('验证码功能开发中，当前输入不校验；留空也可继续。')
                    .isVisible(),
                )
                await dialog.getByRole('button', { name: '登录' }).click()
                assert.equal(await page.locator('[data-submissions]').textContent(), '1')
              } else if (mode === 'invitation-code') {
                await firstField.fill('123456')
                await page.waitForFunction(
                  () => document.querySelector('[data-submissions]')?.textContent === '1',
                )
              } else {
                await dialog.getByRole('textbox', { name: '用户名' }).fill('测试用户')
                await dialog.locator('input[type=password]').fill('fixturepass')
                await dialog.getByRole('button', { name: '完成注册' }).click()
                assert.equal(await page.locator('[data-submissions]').textContent(), '1')
              }
              await page.screenshot({
                path: resolve(evidence, `auth-${mode}-${scheme}-${viewport.width}.png`),
              })
              await page.keyboard.press('Escape')
              await dialog.waitFor({ state: 'hidden' })
              await page.waitForFunction(
                (element) => document.activeElement === element,
                await trigger.elementHandle(),
                { timeout: 1500 },
              )
              rows.push({ mode, scheme, ...state, escapeRestoredFocus: true })
            }
          // Dynamic font sizes, narrowest viewport, system changes, and extreme short dialog.
          for (const [viewport, rootPx] of [
            [{ width: 360, height: 640 }, 16],
            [{ width: 390, height: 844 }, 20],
            [{ width: 640, height: 600 }, 24],
            [{ width: 640, height: 320 }, 32],
          ]) {
            const { dialog } = await openFixture(
              page,
              origin,
              'login',
              'light',
              viewport,
              rootPx,
              true,
            )
            const scroll = await wheelInside(page, dialog)
            const submit = dialog.getByRole('button', { name: '继续' })
            const reach = await keyboardReach(page, submit)
            const state = await snapshot(page)
            rows.push({ mode: 'login', ...state, scroll, submit: reach })
            await page.screenshot({
              path: resolve(
                evidence,
                `auth-login-${viewport.width}x${viewport.height}-root${rootPx}.png`,
              ),
            })
            assert(state.horizontalOverflow <= 1)
            assert(
              reach.inViewport,
              `Login action reachable by Tab at ${viewport.width}x${viewport.height}/root${rootPx}`,
            )
            if (scroll.max > 1) assert(scroll.after > scroll.top, 'Login content wheel-scrolls')
            await page.keyboard.press('Escape')
            await dialog.waitFor({ state: 'hidden' })
          }
          const { dialog } = await openFixture(
            page,
            origin,
            'captcha',
            'light',
            { width: 640, height: 320 },
            32,
            true,
          )
          const action = dialog.getByRole('button', { name: '登录' })
          const reach = await keyboardReach(page, action)
          assert(reach.inViewport, 'Captcha action reachable at extreme geometry')
          await page.screenshot({ path: resolve(evidence, 'auth-captcha-640x320-root32.png') })
          await page.keyboard.press('Escape')
          await dialog.waitFor({ state: 'hidden' })
          for (const mode of ['invitation-email', 'invitation-code', 'invitation-profile'])
            for (const [viewport, rootPx] of [
              [{ width: 360, height: 640 }, 16],
              [{ width: 640, height: 320 }, 32],
            ]) {
              const { dialog: invitation } = await openFixture(
                page,
                origin,
                mode,
                'dark',
                viewport,
                rootPx,
                true,
              )
              const buttonName =
                mode === 'invitation-email'
                  ? '继续'
                  : mode === 'invitation-code'
                    ? '重新发送验证码'
                    : '完成注册'
              const button = invitation.getByRole('button', { name: buttonName })
              const initial = await snapshot(page)
              const scroll = await wheelInside(page, invitation)
              const focus = await keyboardReach(page, button)
              rows.push({ mode, ...initial, scroll, action: focus })
              await page.screenshot({
                path: resolve(
                  evidence,
                  `auth-${mode}-${viewport.width}x${viewport.height}-root${rootPx}.png`,
                ),
              })
              assert(initial.horizontalOverflow <= 1)
              if (!focus.inViewport && mode === 'invitation-code') {
                const diagnosis = await invitation.evaluate((element) => ({
                  buttons: [...element.querySelectorAll('button')].map((button) => ({
                    text: button.textContent,
                    disabled: button.disabled,
                    tabIndex: button.tabIndex,
                    inert: button.closest('[inert]') !== null,
                    hidden: button.closest('[aria-hidden="true"]') !== null,
                    display: getComputedStyle(button).display,
                    visibility: getComputedStyle(button).visibility,
                  })),
                  active: document.activeElement?.outerHTML.slice(0, 350),
                }))
                await button.focus()
                diagnosis.buttonFocusSucceeded = await button.evaluate(
                  (element) => document.activeElement === element,
                )
                await page.keyboard.press('Tab')
                diagnosis.afterButtonTab = await page.evaluate(() =>
                  document.activeElement?.outerHTML.slice(0, 350),
                )
                issues.push({ mode, viewport, rootPx, focus, diagnosis })
              }
              if (mode !== 'invitation-code')
                assert(
                  focus.inViewport,
                  `${mode} action reachable by Tab at ${viewport.width}x${viewport.height}/root${rootPx}: ${JSON.stringify({ focus, scroll })}`,
                )
              if (scroll.max > 1) assert(scroll.after > scroll.top, `${mode} content wheel-scrolls`)
              await page.keyboard.press('Escape')
              await invitation.waitFor({ state: 'hidden' })
            }
          const { dialog: systemDialog } = await openFixture(
            page,
            origin,
            'login',
            'light',
            { width: 390, height: 844 },
            16,
          )
          const stableInput = await systemDialog
            .getByRole('textbox', { name: '邮箱' })
            .elementHandle()
          assert.equal((await snapshot(page)).theme, 'light')
          await page.emulateMedia({ colorScheme: 'dark' })
          await settle(page)
          assert.equal((await snapshot(page)).theme, 'dark', 'system follows OS color change live')
          assert(
            await stableInput.evaluate((element) => element.isConnected),
            'Theme switch preserves input node',
          )
          rows.push({
            mode: 'system-live',
            lightToDark: true,
            nodePreserved: true,
            ...(await snapshot(page)),
          })
          await page.keyboard.press('Escape')
          await systemDialog.waitFor({ state: 'hidden' })
          assert.deepEqual(apiRequests, [], 'Fixture forms do not call a real API')
          assert.deepEqual(errors, [], 'No browser errors')
          await writeFile(
            resolve(evidence, 'auth-rows.json'),
            JSON.stringify({ rows, issues }, null, 2),
          )
          if (issues.length)
            throw new Error(
              `Invitation code keyboard reachability: ${JSON.stringify(
                issues.map((issue) => ({
                  viewport: issue.viewport,
                  rootPx: issue.rootPx,
                  tabs: issue.focus.tabs,
                  sequence: issue.focus.visited.map((step) => step.tag),
                  buttonsFocusable: issue.diagnosis.buttonFocusSucceeded,
                })),
              )}`,
            )
          return { rows, apiRequests: 0 }
        } finally {
          await context.close()
        }
      },
    )
    await run('OIDC sharing, Join application and review long-content geometry', async () => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page = await context.newPage(),
        rows = [],
        errors = []
      page.on('pageerror', (error) => errors.push(error.message))
      try {
        for (const mode of ['oidc', 'join-application', 'join-review'])
          for (const [viewport, rootPx, scheme] of [
            [{ width: 1440, height: 900 }, 16, 'light'],
            [{ width: 390, height: 844 }, 16, 'dark'],
            [{ width: 360, height: 640 }, 20, 'light'],
            [{ width: 640, height: 600 }, 24, 'dark'],
            [{ width: 640, height: 320 }, 32, 'light'],
          ]) {
            const { trigger, dialog } = await openFixture(
              page,
              origin,
              mode,
              scheme,
              viewport,
              rootPx,
              true,
            )
            const title = dialog.getByRole('heading').first()
            const action =
              mode === 'oidc'
                ? dialog.getByRole('button', { name: '知道了' })
                : mode === 'join-review'
                  ? dialog.getByRole('button', { name: '关闭详情' })
                  : dialog.getByRole('button', { name: '继续' })
            const body =
              mode === 'join-review'
                ? dialog.locator('[aria-busy]').first()
                : mode === 'join-application'
                  ? dialog.getByRole('region', { name: /内容/ })
                  : dialog
            const before = await snapshot(page)
            const titleVisible = await visibleInViewport(title)
            const scroll = await wheelInside(page, body)
            const row = { mode, scheme, viewport, rootPx, before, titleVisible, scroll }
            rows.push(row)
            if (scroll.max > 1 && scroll.after <= scroll.top) {
              const outer = await wheelInside(page, dialog)
              const afterOuter = await body.evaluate((element) =>
                element.getBoundingClientRect().toJSON(),
              )
              row.outerScroll = outer
              row.bodyAfterOuter = afterOuter
              assert(
                outer.max > 1 && outer.after > outer.top && afterOuter.top < viewport.height,
                `${mode} actual scroll chain reaches body: ${JSON.stringify({ viewport, rootPx, scroll, outer, afterOuter })}`,
              )
              const inner = await wheelInside(page, body)
              row.innerScrollAfterOuter = inner
              if (inner.after <= inner.top)
                row.computed = await dialog.evaluate((element) => {
                  const tabs = element.querySelector('[data-slot="tabs"]')
                  const tabList = element.querySelector('[data-slot="tabs-list"]')
                  const scroll = element.querySelector('[aria-busy]')
                  const footer = element.querySelector('[data-slot="dialog-footer"]')
                  const nodes = {
                    content: element,
                    body: element.querySelector('[data-slot="dialog-body"]'),
                    tabs,
                    tabList,
                    scroll,
                    footer,
                    button: [...element.querySelectorAll('button')].find(
                      (node) => node.textContent === '测试操作',
                    ),
                  }
                  return Object.fromEntries(
                    Object.entries(nodes).map(([name, node]) => {
                      if (!node) return [name, null]
                      const style = getComputedStyle(node)
                      return [
                        name,
                        {
                          rect: node.getBoundingClientRect().toJSON(),
                          position: style.position,
                          zIndex: style.zIndex,
                          overflow: style.overflow,
                          display: style.display,
                          flex: style.flex,
                          scrollTop: node.scrollTop,
                          scrollHeight: node.scrollHeight,
                          clientHeight: node.clientHeight,
                        },
                      ]
                    }),
                  )
                })
              assert(
                inner.after > inner.top,
                `${mode} inner body wheel-scrolls after outer fallback: ${JSON.stringify({ inner, computed: row.computed })}`,
              )
            }
            const reach = await keyboardReach(page, action)
            row.action = reach
            row.after = await snapshot(page)
            await page.screenshot({
              path: resolve(
                evidence,
                `${mode}-${viewport.width}x${viewport.height}-root${rootPx}-${scheme}.png`,
              ),
            })
            assert(before.horizontalOverflow <= 1, `${mode} has no horizontal overflow`)
            assert(
              titleVisible,
              `${mode} title visible at ${viewport.width}x${viewport.height}/root${rootPx}`,
            )
            assert(
              reach.inViewport,
              `${mode} action reachable by Tab at ${viewport.width}x${viewport.height}/root${rootPx}`,
            )
            if (mode === 'join-review') {
              await dialog.getByRole('tab', { name: '审核与邀请' }).click()
              assert(
                (await dialog
                  .getByRole('tab', { name: '审核与邀请' })
                  .getAttribute('data-state')) === 'active',
              )
            }
            await page.keyboard.press('Escape')
            await dialog.waitFor({ state: 'hidden' })
            await page.waitForFunction(
              (element) => document.activeElement === element,
              await trigger.elementHandle(),
              { timeout: 1500 },
            )
          }
        assert.deepEqual(errors, [])
        return { rows }
      } finally {
        await context.close()
      }
    })
    await run('single ExMessage host loading completion, failure, cancellation', async () => {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        colorScheme: 'light',
        reducedMotion: 'reduce',
      })
      const page = await context.newPage(),
        errors = [],
        navigations = []
      page.on('pageerror', (error) => errors.push(error.message))
      page.on('framenavigated', (frame) => {
        if (frame === page.mainFrame()) navigations.push(frame.url())
      })
      try {
        await page.goto(`${origin}/__exui_v1_overlays.html?mode=message`)
        await page.waitForTimeout(2000)
        await page.reload()
        await settle(page)
        const baselineNavigations = navigations.length
        assert.equal((await snapshot(page)).theme, 'light')
        await page.getByRole('button', { name: '普通成功' }).click()
        await page.getByText('普通成功消息').waitFor()
        const states = [
          {
            action: 'ordinary-success',
            visible: true,
            hostCount: await page.locator('[data-sonner-toaster]').count(),
          },
        ]
        await page.getByRole('button', { name: '开始任务' }).click()
        await page.getByText('隔离任务进行中').waitFor()
        assert.equal(await page.locator('[data-sonner-toaster]').count(), 1, 'One message host')
        states.push({ action: 'loading', visible: true, hostCount: 1 })
        await page.screenshot({ path: resolve(evidence, 'message-light-reduced.png') })
        await page.emulateMedia({ colorScheme: 'dark' })
        await settle(page)
        assert.equal(
          (await snapshot(page)).theme,
          'dark',
          'System theme follows live dark preference',
        )
        assert(
          await page.getByText('隔离任务进行中').isVisible(),
          'Theme switch preserves loading message',
        )
        await page.getByRole('button', { name: '完成任务' }).click()
        const completionVisible = await page
          .getByText('隔离任务完成')
          .waitFor({ state: 'visible', timeout: 3000 })
          .then(
            () => true,
            () => false,
          )
        states.push({
          action: 'completion',
          visible: completionVisible,
          hostCount: await page.locator('[data-sonner-toaster]').count(),
          transition: await page.locator('[data-message-transition]').textContent(),
        })
        await page.getByRole('button', { name: '开始任务' }).click()
        await page.getByText('隔离任务进行中').waitFor()
        await page.getByRole('button', { name: '任务失败' }).click()
        const failureVisible = await page
          .getByText('隔离任务失败')
          .waitFor({ state: 'visible', timeout: 3000 })
          .then(
            () => true,
            () => false,
          )
        states.push({
          action: 'failure',
          visible: failureVisible,
          hostCount: await page.locator('[data-sonner-toaster]').count(),
        })
        await page.getByRole('button', { name: '开始任务' }).click()
        await page.getByText('隔离任务进行中').waitFor()
        await page.getByRole('button', { name: '取消任务' }).click()
        await page.getByText('隔离任务进行中').waitFor({ state: 'hidden' })
        states.push({
          action: 'cancel',
          loadingCount: await page.getByText('隔离任务进行中').count(),
        })
        await page.screenshot({ path: resolve(evidence, 'message-dark-reduced.png') })
        assert.deepEqual(errors, [])
        assert.equal(
          navigations.length,
          baselineNavigations,
          `HMR/navigation while message active: ${JSON.stringify(navigations)}`,
        )
        assert(
          states.find((state) => state.action === 'completion').visible,
          `Loading completion visible: ${JSON.stringify(states)}`,
        )
        assert(
          states.find((state) => state.action === 'failure').visible,
          `Loading failure visible: ${JSON.stringify(states)}`,
        )
        assert.equal(states.find((state) => state.action === 'cancel').loadingCount, 0)
        return { theme: 'system live light to dark', reducedMotion: true, states }
      } finally {
        await context.close()
      }
    })
  },
  report: ({ status, browser, results, failures }) => ({ status, browser, results, failures }),
  summary: ({ status, results, failures }) => ({
    status,
    results: results.map(({ name, status }) => ({ name, status })),
    failures,
    output: 'output/playwright/exui-v1-overlays',
  }),
})
if (outcome.status === 'FAIL') process.exitCode = 1
