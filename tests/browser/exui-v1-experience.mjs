// Run: node tests/browser/exui-v1-experience.mjs
// Chromium acceptance: isolated real components plus backend-free public routes.
import assert from 'node:assert/strict'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runBrowserSuite } from './browser-suite.mjs'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const evidence = resolve(repository, 'output/playwright/exui-v1-experience')
const fixturePath = resolve(repository, 'tests/browser/exui-v1-fixture.tsx').replaceAll('\\', '/')
const results = []
async function scenario(name, run) {
  if (
    process.argv.includes('--settings-modal-only') &&
    name !== 'settings modal fixture: outer geometry'
  )
    return
  if (process.argv.includes('--settings-only') && !name.startsWith('settings fixture:')) return
  if (process.argv.includes('--real-only') && !name.startsWith('public routes')) return
  if (process.argv.includes('--emoji-only') && !name.startsWith('emoji fixture')) return
  if (process.argv.includes('--feedback-only') && !name.startsWith('feedback fixture')) return
  if (process.argv.includes('--member-only') && !name.startsWith('member modal')) return
  if (process.argv.includes('--header-only') && !name.startsWith('site header')) return
  try {
    const detail = await run()
    results.push({ name, status: 'PASS', ...detail })
  } catch (error) {
    results.push({
      name,
      status: 'FAIL',
      error: String(error?.stack ?? error),
      ...(error?.details ?? {}),
    })
    console.error(`${name}: ${error?.stack ?? error}`)
  }
}
const settle = (page) =>
  page.evaluate(async () => {
    await document.fonts.ready
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })
const geometry = (page) =>
  page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    rootPx: parseFloat(getComputedStyle(document.documentElement).fontSize),
    horizontal: document.documentElement.scrollWidth - innerWidth,
    theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
    colorScheme: getComputedStyle(document.documentElement).colorScheme,
  }))
async function reachable(locator) {
  try {
    await locator.scrollIntoViewIfNeeded({ timeout: 3000 })
  } catch {
    return false
  }
  return locator.evaluate((element) => {
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
}
const outcome = await runBrowserSuite({
  repository,
  output: evidence,
  results,
  fixture: {
    name: 'isolated-exui-v1-fixture',
    route: '/__exui_v1_fixture.html',
    path: fixturePath,
  },
  run: async ({ browser, origin }) => {
    await scenario('settings fixture: themes, viewports, nested dialog', async () => {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        colorScheme: 'light',
      })
      const page = await context.newPage(),
        rows = [],
        errors = []
      page.on('pageerror', (error) => errors.push(error.message))
      try {
        await page.goto(`${origin}/__exui_v1_fixture.html?mode=settings`)
        const theme = page.getByRole('combobox', { name: '网站主题' })
        await theme.waitFor()
        for (const [option, expected] of [
          ['深色', 'dark'],
          ['浅色', 'light'],
          ['跟随系统', 'light'],
        ]) {
          await theme.click()
          await page.getByRole('option', { name: option }).click()
          await settle(page)
          const state = await geometry(page)
          assert.equal(state.theme, expected, `${option} applies immediately`)
          assert.equal(state.colorScheme, expected, `${option} sets native color scheme`)
          rows.push({ option, ...state })
        }
        await page.emulateMedia({ colorScheme: 'dark' })
        await settle(page)
        assert.equal((await geometry(page)).theme, 'dark', 'system follows a live OS change')
        await page.emulateMedia({ reducedMotion: 'reduce' })
        for (const viewport of [
          { width: 1440, height: 900 },
          { width: 390, height: 844 },
          { width: 360, height: 640 },
        ]) {
          await page.setViewportSize(viewport)
          await settle(page)
          const state = await geometry(page)
          assert(state.horizontal <= 1, 'Settings have no horizontal overflow')
          assert(await theme.isVisible(), 'Theme control remains reachable')
          rows.push({ viewport, reducedMotion: 'reduce', ...state })
          await page.screenshot({
            path: resolve(evidence, `settings-${viewport.width}x${viewport.height}.png`),
          })
        }
        for (const [rootPx, height] of [
          [20, 600],
          [32, 600],
          [32, 320],
        ]) {
          await page.setViewportSize({ width: 640, height })
          await page.evaluate((size) => {
            document.documentElement.style.fontSize = `${size}px`
          }, rootPx)
          const profileNavigation = page.getByRole('button', { name: '个人资料', exact: true })
          if (await profileNavigation.isVisible()) await profileNavigation.click()
          else {
            await page.getByRole('combobox', { name: '选择设置页面' }).click()
            await page.getByRole('option', { name: '个人资料' }).click()
          }
          await page.getByRole('button', { name: '编辑用户名' }).click()
          const dialog = page.getByRole('dialog')
          await dialog.waitFor()
          const name = dialog.getByRole('textbox')
          assert(await reachable(name), 'Nested edit input remains reachable')
          const actions = await dialog.getByRole('button').all()
          for (const button of actions) {
            assert(await reachable(button), 'Nested edit action remains reachable')
          }
          await page.screenshot({
            path: resolve(evidence, `settings-edit-640x${height}-root${rootPx}.png`),
          })
          rows.push({
            viewport: { width: 640, height },
            rootPx,
            dialogButtons: actions.length,
            ...(await geometry(page)),
          })
          await dialog.getByRole('button', { name: '取消' }).click()
        }
        await page.getByRole('button', { name: '编辑头像' }).click()
        const upload = page.getByRole('dialog', { name: '上传头像' })
        await upload.waitFor()
        const uploadActions = await upload.getByRole('button').all()
        for (const button of uploadActions)
          assert(await reachable(button), 'Avatar upload action remains reachable')
        const uploadGeometry = await upload.evaluate((element) => ({
          rect: element.getBoundingClientRect().toJSON(),
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight,
        }))
        await page.screenshot({
          path: resolve(evidence, 'settings-avatar-upload-640x320-root32.png'),
        })
        const png = Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl1Uk0AAAAASUVORK5CYII=',
          'base64',
        )
        await upload
          .getByLabel('头像图片')
          .setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: png })
        const crop = page.getByRole('dialog', { name: '裁剪头像' })
        await crop.waitFor()
        const cropActions = await crop.getByRole('button').all()
        for (const button of cropActions)
          assert(await reachable(button), 'Avatar crop action remains reachable')
        const cropGeometry = await crop.evaluate((element) => ({
          rect: element.getBoundingClientRect().toJSON(),
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight,
        }))
        await page.screenshot({
          path: resolve(evidence, 'settings-avatar-crop-640x320-root32.png'),
        })
        await crop.getByRole('button', { name: '取消' }).click()
        rows.push({
          viewport: { width: 640, height: 320 },
          rootPx: 32,
          nestedAvatar: {
            upload: uploadGeometry,
            crop: cropGeometry,
            uploadActions: uploadActions.length,
            cropActions: cropActions.length,
          },
        })
        assert.deepEqual(errors, [], 'Settings fixture has no page errors')
        return { evidence: 'isolated real SettingsPanel', rows }
      } finally {
        await context.close()
      }
    })
    await scenario('settings modal fixture: outer geometry', async () => {
      const context = await browser.newContext({ viewport: { width: 640, height: 600 } })
      const page = await context.newPage(),
        rows = [],
        errors = [],
        apiRequests = [],
        unexpectedRequests = []
      page.on('pageerror', (error) => errors.push(error.message))
      await context.route('**/*', (route) => {
        const request = route.request(),
          path = new URL(request.url()).pathname
        if (!path.startsWith('/api/')) return route.continue()
        apiRequests.push(`${request.method()} ${path}`)
        if (request.method() === 'GET' && path === '/api/auth/me')
          return route.fulfill({
            json: {
              id: '00000000-0000-4000-8000-000000000001',
              email: 'settings-browser@example.test',
              nickname: '真实设置宿主用户',
              qq: null,
              fivemId: null,
              avatarUrl: null,
            },
          })
        if (request.method() === 'GET' && path === '/api/notification-preferences')
          return route.fulfill({
            json: {
              revision: 0,
              optionalCategories: { announcement: true, personal_update: true },
              necessaryCategories: [],
              serverTime: 0,
            },
          })
        unexpectedRequests.push(`${request.method()} ${path}`)
        return route.fulfill({ status: 503, json: { error: 'Unexpected fixture API request' } })
      })
      try {
        for (const [rootPx, height] of [
          [20, 600],
          [32, 600],
          [32, 320],
        ]) {
          await page.setViewportSize({ width: 640, height })
          await page.goto(`${origin}/__exui_v1_fixture.html?mode=settings-modal`)
          await page.evaluate((size) => {
            document.documentElement.style.fontSize = `${size}px`
          }, rootPx)
          const dialog = page.getByRole('dialog', { name: '设置' })
          await dialog.waitFor()
          const measurement = await dialog.evaluate((element) => {
            const navigation = element.querySelector('nav[aria-label="设置分类"]')
            const panel = navigation?.parentElement?.parentElement
            const content = panel?.lastElementChild
            const rect = (node) => node?.getBoundingClientRect().toJSON()
            return {
              modal: rect(element),
              modalScrollHeight: element.scrollHeight,
              modalClientHeight: element.clientHeight,
              panel: rect(panel),
              panelScrollHeight: panel?.scrollHeight,
              panelClientHeight: panel?.clientHeight,
              content: rect(content),
              contentScrollHeight: content?.scrollHeight,
              contentClientHeight: content?.clientHeight,
            }
          })
          const themeReachable = await reachable(dialog.getByRole('combobox', { name: '网站主题' }))
          await dialog.getByRole('button', { name: '个人资料', exact: true }).focus()
          for (let i = 0; i < 4; i++) await page.keyboard.press('Tab')
          const keyboardLogoutFocused = await dialog
            .getByRole('button', { name: '退出登录' })
            .evaluate((element) => document.activeElement === element)
          const logoutVisibleAfterTab = await dialog
            .getByRole('button', { name: '退出登录' })
            .evaluate((element) => {
              const rect = element.getBoundingClientRect()
              return rect.top >= 0 && rect.bottom <= innerHeight
            })
          const contentScroll = await dialog.evaluate(async (element) => {
            const navigation = element.querySelector('nav[aria-label="设置分类"]')
            const content = navigation?.parentElement?.parentElement?.lastElementChild
            if (
              !(content instanceof HTMLElement) ||
              content.scrollHeight <= content.clientHeight + 1
            )
              return { needed: false }
            content.scrollTop = 0
            return { needed: true, before: content.scrollTop }
          })
          if (contentScroll.needed) {
            const rect = measurement.content
            await page.mouse.move(
              rect.x + Math.min(30, rect.width / 2),
              rect.y + Math.min(30, rect.height / 2),
            )
            await page.mouse.wheel(0, 300)
            await page.waitForTimeout(50)
            contentScroll.after = await dialog.evaluate(
              (element) =>
                element.querySelector('nav[aria-label="设置分类"]')?.parentElement?.parentElement
                  ?.lastElementChild?.scrollTop,
            )
          }
          const panelFits = measurement.panel.bottom <= measurement.modal.bottom + 2
          const row = {
            rootPx,
            width: 640,
            height,
            themeReachable,
            keyboardLogoutFocused,
            logoutVisibleAfterTab,
            panelFits,
            contentScroll,
            measurement,
          }
          rows.push(row)
          await page.screenshot({
            path: resolve(evidence, `settings-modal-640x${height}-root${rootPx}.png`),
          })
          assert(
            themeReachable && keyboardLogoutFocused && logoutVisibleAfterTab && panelFits,
            `SettingsModal panel and keyboard controls fit at ${height}px/root ${rootPx}px`,
          )
          assert(
            !contentScroll.needed || contentScroll.after > contentScroll.before,
            `SettingsModal content scrolls by wheel at ${height}px/root ${rootPx}px`,
          )
          await dialog.getByRole('button', { name: '个人资料', exact: true }).click()
          // The geometry assertions above target General; here only prove the real controller read the fixture profile.
          await dialog
            .getByText('真实设置宿主用户', { exact: true })
            .waitFor({ state: 'attached', timeout: 10000 })
          assert(
            apiRequests.includes('GET /api/auth/me'),
            'Real settings host reads its profile through the HTTP seam',
          )
          await page.keyboard.press('Escape')
          await dialog.waitFor({ state: 'hidden' })
          await page.getByRole('button', { name: '打开设置验收弹窗' }).click()
          await dialog.waitFor()
          await dialog.getByRole('combobox', { name: '网站主题' }).waitFor()
          row.closedAndReopened = true
        }
        assert.deepEqual(errors, [], 'SettingsModal fixture has no page errors')
        assert.deepEqual(unexpectedRequests, [], 'All settings API requests stay in the fixture')
        return {
          evidence: 'real SettingsModal, SettingsExperience and AuthProvider; intercepted HTTP',
          rows,
          apiRequests,
        }
      } finally {
        await context.close()
      }
    })
    await scenario('emoji fixture: native keyboard, sessions, local data', async () => {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        colorScheme: 'dark',
      })
      const page = await context.newPage(),
        remote = [],
        errors = []
      page.on('request', (request) => {
        if (new URL(request.url()).origin !== origin) remote.push(request.url())
      })
      page.on('pageerror', (error) => errors.push(error.message))
      const editor = page.getByRole('textbox', { name: '浏览器 Emoji 编辑器' })
      const picker = page.getByRole('dialog', { name: '选择 Emoji' })
      const openPicker = async (offset = null) => {
        await editor.evaluate((element, targetOffset) => {
          element.focus()
          const node = element.querySelector('p')?.firstChild
          if (!(node instanceof Text)) throw new Error('Expected an editor text node')
          const range = document.createRange()
          range.setStart(node, targetOffset ?? node.length)
          range.collapse(true)
          const selection = window.getSelection()
          selection.removeAllRanges()
          selection.addRange(range)
        }, offset)
        await page.keyboard.type('$')
        await picker.waitFor()
      }
      try {
        await page.goto(`${origin}/__exui_v1_fixture.html?mode=emoji`)
        await editor.waitFor()
        await openPicker(2)
        const list = picker.getByRole('listbox')
        await list.waitFor()
        assert(
          await list.evaluate((element) => document.activeElement === element),
          'Ready native listbox receives focus',
        )
        assert((await picker.getByRole('option').count()) > 0, 'Local Chinese data renders options')
        await page.screenshot({ path: resolve(evidence, 'emoji-native-listbox.png') })
        await list.press('ArrowRight')
        await list.press('Enter')
        await picker.waitFor({ state: 'hidden' })
        const content = await editor.textContent()
        assert(
          content.startsWith('前 ') && content.endsWith('后') && !content.includes('$'),
          'Selection inserts Unicode at the mapped caret',
        )
        await page.getByRole('button', { name: '导出 Markdown' }).click()
        const markdown = await page.locator('[data-markdown-result]').textContent()
        assert.equal(markdown, content, 'Emoji remains plain text in Markdown export')
        const geometryRows = []
        for (const [rootPx, viewport] of [
          [16, { width: 390, height: 844 }],
          [20, { width: 390, height: 844 }],
          [24, { width: 390, height: 844 }],
          [32, { width: 640, height: 320 }],
        ]) {
          await page.setViewportSize(viewport)
          await page.evaluate((size) => {
            document.documentElement.style.fontSize = `${size}px`
          }, rootPx)
          await page.getByRole('button', { name: '替换文档' }).click()
          await openPicker()
          await page.waitForTimeout(250)
          await settle(page)
          const measurements = await picker.evaluate((element) => {
            const list = element.querySelector('[role="listbox"]')
            const categories = element.querySelector('[data-slot="emoji-picker-categories"]')
            const rect = (node) => node?.getBoundingClientRect().toJSON()
            return {
              panel: rect(element),
              list: rect(list),
              scrollHeight: list?.scrollHeight,
              clientHeight: list?.clientHeight,
              categories: element.querySelectorAll('[role="tab"]').length,
              categoriesRect: rect(categories),
              side: element.getAttribute('data-side'),
              availableHeight: getComputedStyle(element)
                .getPropertyValue('--radix-popover-content-available-height')
                .trim(),
            }
          })
          await page.screenshot({
            path: resolve(evidence, `emoji-root${rootPx}-${viewport.width}x${viewport.height}.png`),
          })
          geometryRows.push({ rootPx, viewport, measurements })
          assert(
            measurements.list?.height > 0,
            `Native listbox has positive height at root ${rootPx}: ${JSON.stringify(measurements)}`,
          )
          await list.waitFor({ timeout: 3000 })
          assert(
            measurements.panel.top >= -1 && measurements.panel.bottom <= viewport.height + 1,
            `Emoji panel fits viewport vertically at root ${rootPx}: ${JSON.stringify(measurements)}`,
          )
          assert(measurements.categories > 1, 'Category tabs are present')
          await picker.getByRole('tab').nth(1).click()
          assert(
            measurements.scrollHeight > measurements.clientHeight,
            'Emoji list has a scroll range',
          )
          await list.evaluate((element) => {
            element.scrollTop = 0
          })
          const listRect = measurements.list
          await page.mouse.move(listRect.x + listRect.width / 2, listRect.y + listRect.height / 2)
          await page.mouse.wheel(0, 200)
          await page.waitForTimeout(50)
          assert(
            await list.evaluate((element) => element.scrollTop > 0),
            'Emoji list scrolls by wheel',
          )
          if (rootPx === 32) {
            const outer = await picker.evaluate((element) => ({
              rect: element.getBoundingClientRect().toJSON(),
              scrollHeight: element.scrollHeight,
              clientHeight: element.clientHeight,
              scrollTop: element.scrollTop,
            }))
            if (outer.scrollHeight > outer.clientHeight + 1) {
              await page.mouse.move(outer.rect.right - 12, outer.rect.bottom - 12)
              await page.mouse.wheel(0, 180)
              await page.waitForTimeout(50)
            }
            const target = await list.evaluate((element) => {
              const rect = element.getBoundingClientRect()
              const panel = element.closest('[data-tiptap-emoji-picker]')
              const panelRect = panel.getBoundingClientRect()
              const candidates = Array.from(element.querySelectorAll('[role="option"]'))
                .map((option) => {
                  const optionRect = option.getBoundingClientRect()
                  const left = Math.max(optionRect.left, rect.left, panelRect.left, 0)
                  const right = Math.min(optionRect.right, rect.right, panelRect.right, innerWidth)
                  const top = Math.max(optionRect.top, rect.top, panelRect.top, 0)
                  const bottom = Math.min(
                    optionRect.bottom,
                    rect.bottom,
                    panelRect.bottom,
                    innerHeight,
                  )
                  if (right - left < 4 || bottom - top < 4) return null
                  const x = (left + right) / 2,
                    y = (top + bottom) / 2
                  const hit = document.elementFromPoint(x, y)
                  return {
                    point: { x, y },
                    option: option.getAttribute('aria-label'),
                    actualHit: Boolean(hit && (option === hit || option.contains(hit))),
                    hit: hit?.outerHTML.slice(0, 140),
                    optionRect: optionRect.toJSON(),
                  }
                })
                .filter(Boolean)
              return {
                panelScrollTop: panel.scrollTop,
                panelScrollHeight: panel.scrollHeight,
                panelClientHeight: panel.clientHeight,
                candidates: candidates.slice(0, 8),
                reachableOption: candidates.find((candidate) => candidate.actualHit),
              }
            })
            geometryRows.at(-1).wheelTarget = target
            assert(
              target.reachableOption,
              `Real pointer reaches an Emoji option at root32: ${JSON.stringify(target)}`,
            )
            await page.screenshot({ path: resolve(evidence, 'emoji-root32-option-reachable.png') })
            await page.mouse.click(target.reachableOption.point.x, target.reachableOption.point.y)
            await picker.waitFor({ state: 'hidden' })
            assert(
              !(await editor.textContent()).includes('$'),
              'Root32 pointer picks an Emoji after wheel scrolling',
            )
          } else {
            await page.keyboard.press('Escape')
            await picker.waitFor({ state: 'hidden' })
            const afterEscape = await editor.textContent()
            assert(
              afterEscape.includes('$'),
              `Escape keeps trigger at root ${rootPx}: ${JSON.stringify(afterEscape)}`,
            )
            assert(
              await editor.evaluate((element) => document.activeElement === element),
              'Escape returns editor focus',
            )
          }
        }
        await page.setViewportSize({ width: 390, height: 844 })
        await page.evaluate(() => {
          document.documentElement.style.fontSize = ''
        })
        await page.getByRole('button', { name: '替换文档' }).click()
        await openPicker()
        await page.getByRole('button', { name: '外部焦点' }).click()
        await picker.waitFor({ state: 'hidden' })
        assert(
          await page
            .getByRole('button', { name: '外部焦点' })
            .evaluate((element) => document.activeElement === element),
          'Outside focus is retained',
        )
        await openPicker()
        await page.getByRole('button', { name: '替换文档' }).click()
        await picker.waitFor({ state: 'hidden' })
        assert.equal(await editor.textContent(), '替换内容')
        await openPicker()
        await page.getByRole('button', { name: '切换只读' }).click()
        await picker.waitFor({ state: 'hidden' })
        assert.equal(await editor.getAttribute('contenteditable'), 'false')
        assert.deepEqual(remote, [], 'Emoji local data creates no third party requests')
        assert.deepEqual(errors, [], 'Emoji fixture has no page errors')
        return {
          evidence: 'isolated real TiptapEditor and ExUI EmojiPicker',
          content,
          markdown,
          geometryRows,
          remoteRequests: remote.length,
        }
      } finally {
        await context.close()
      }
    })
    await scenario('feedback fixture: draft, attachment, close and in-flight request', async () => {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
      await context.addInitScript(() =>
        localStorage.setItem('exwebsite.auth.token', 'browser-token'),
      )
      const page = await context.newPage(),
        errors = [],
        requests = []
      page.on('pageerror', (error) => errors.push(error.message))
      let pendingSubmission, resolveSubmission
      const submissionSeen = new Promise((resolve) => {
        resolveSubmission = resolve
      })
      const options = {
        available: true,
        reason: null,
        fields: [],
        kinds: [{ kind: 'suggestion', available: true, reason: null }],
        actions: [],
        limits: {},
      }
      await page.route('**/api/support/feedback/**', (route) => {
        const request = route.request(),
          url = new URL(request.url())
        requests.push({ method: request.method(), path: url.pathname })
        if (url.pathname.endsWith('/options')) return route.fulfill({ status: 200, json: options })
        if (request.method() === 'POST' && url.pathname.endsWith('/submissions')) {
          pendingSubmission = route
          resolveSubmission()
          return
        }
        return route.fulfill({ status: 404, json: { error: 'fixture endpoint unavailable' } })
      })
      try {
        await page.goto(`${origin}/__exui_v1_fixture.html?mode=feedback`)
        await page
          .getByRole('button', { name: '打开投诉和建议' })
          .waitFor({ timeout: 10000 })
          .catch(async (error) => {
            throw new Error(
              `${error.message}; page errors: ${JSON.stringify(errors)}; body: ${JSON.stringify((await page.locator('body').innerText()).slice(0, 500))}`,
            )
          })
        await page.getByRole('button', { name: '打开投诉和建议' }).click()
        await page.getByText('反馈和建议', { exact: true }).click()
        const dialog = page.getByRole('dialog')
        await dialog.waitFor()
        const title = dialog.getByRole('textbox', { name: '标题' })
        await title.fill('浏览器反馈草稿')
        await dialog.getByRole('textbox', { name: '内容' }).fill('可保留的反馈内容')
        await dialog.locator('input[type="file"]').setInputFiles({
          name: 'proof.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('proof'),
        })
        assert(await dialog.getByText(/proof\.txt/).isVisible(), 'Controlled attachment is shown')
        const body = dialog.locator('[data-slot="dialog-body"]'),
          footer = dialog.locator('[data-slot="dialog-footer"]')
        assert(
          await body.evaluate(
            (element) => element.parentElement?.getAttribute('data-slot') === 'dialog-content',
          ),
        )
        assert(
          await footer.evaluate(
            (element) => element.parentElement?.getAttribute('data-slot') === 'dialog-content',
          ),
        )
        await dialog.getByRole('button', { name: '关闭反馈表单' }).click()
        await dialog.getByRole('heading', { name: '放弃未提交内容？' }).waitFor()
        await dialog.getByRole('button', { name: '继续填写' }).click()
        assert.equal(await title.inputValue(), '浏览器反馈草稿')
        assert(await dialog.getByText(/proof\.txt/).isVisible(), 'Cancel preserves selected File')
        await page.evaluate(() => {
          window.__feedbackNodes = {
            title: document.querySelector('input[aria-required="true"]'),
            file: document.querySelector('input[type="file"]'),
            form: document.querySelector('[data-slot="dialog-body"] form'),
          }
        })
        const geometryRows = []
        for (const [rootPx, viewport] of [
          [16, { width: 390, height: 844 }],
          [20, { width: 390, height: 844 }],
          [24, { width: 390, height: 844 }],
          [32, { width: 640, height: 320 }],
        ]) {
          await page.setViewportSize(viewport)
          await page.evaluate((size) => {
            document.documentElement.style.fontSize = `${size}px`
          }, rootPx)
          const nodesRetained = await page.evaluate(() =>
            Object.values(window.__feedbackNodes).every((node) => node?.isConnected),
          )
          assert(nodesRetained, 'Zoom keeps the original title/file/form nodes mounted')
          assert.equal(await title.inputValue(), '浏览器反馈草稿')
          assert(
            await dialog.getByText(/proof\.txt/).isVisible(),
            'Zoom retains the controlled File',
          )
          const headingReachable = await reachable(dialog.getByRole('heading').first())
          const submitReachable = await reachable(
            dialog.getByRole('button', { name: '提交', exact: true }),
          )
          geometryRows.push({
            rootPx,
            viewport,
            headingReachable,
            submitReachable,
            ...(await geometry(page)),
          })
          await page.screenshot({
            path: resolve(
              evidence,
              `feedback-root${rootPx}-${viewport.width}x${viewport.height}.png`,
            ),
          })
          assert(
            headingReachable && submitReachable,
            'Feedback title/submit remain reachable after zoom',
          )
        }
        await dialog.getByRole('button', { name: '提交', exact: true }).click()
        await Promise.race([
          submissionSeen,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Submission did not reach fixture route')), 5000),
          ),
        ])
        assert(pendingSubmission, 'Submission reached the isolated API route')
        await dialog.getByRole('button', { name: '关闭反馈表单' }).click()
        await dialog.waitFor({ state: 'hidden' })
        await pendingSubmission.fulfill({ status: 500, json: { error: 'fixture failure' } })
        await page.waitForTimeout(100)
        assert.equal(await dialog.count(), 0, 'Closed failed request does not reopen feedback')
        assert.deepEqual(errors, [], 'Feedback fixture has no page errors')
        return {
          evidence: 'real FeedbackProvider/FeedbackModal with browser API interception',
          requests,
          attachment: 'proof.txt',
          geometryRows,
        }
      } finally {
        await context.close()
      }
    })
    await scenario('public routes: real page render without backend', async () => {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        colorScheme: 'dark',
      })
      const page = await context.newPage(),
        rows = [],
        errors = [],
        httpErrors = [],
        failedRequests = []
      page.on('pageerror', (error) => errors.push(error.message))
      page.on('response', (response) => {
        if (response.status() >= 400 && !new URL(response.url()).pathname.startsWith('/api/'))
          httpErrors.push({ status: response.status(), url: response.url() })
      })
      page.on('requestfailed', (request) =>
        failedRequests.push({ url: request.url(), failure: request.failure() }),
      )
      await page.route('**/*', (route) =>
        new URL(route.request().url()).pathname.startsWith('/api/')
          ? route.fulfill({
              status: 503,
              contentType: 'application/json',
              body: '{"error":"offline"}',
            })
          : route.continue(),
      )
      try {
        const routes = process.argv.includes('--real-smoke')
          ? ['/']
          : [
              '/',
              '/aboutus',
              '/aboutus/team',
              '/communities/rifling-911',
              '/docs',
              '/missing-page',
              '/login',
              '/register',
              '/identity/signed-out',
              '/support',
            ]
        await page.goto(origin)
        for (const route of routes)
          for (const [viewport, themePreference, expectedTheme] of [
            [{ width: 1440, height: 900 }, 'light', 'light'],
            [{ width: 390, height: 844 }, 'dark', 'dark'],
            [{ width: 360, height: 640 }, 'system', 'dark'],
          ]) {
            await page.setViewportSize(viewport)
            await page.evaluate((value) => localStorage.setItem('theme', value), themePreference)
            await page.goto(`${origin}${route}`)
            await page.locator('#root').waitFor({ state: 'attached' })
            await page
              .waitForFunction(
                () => document.querySelector('#root')?.children.length > 0,
                undefined,
                { timeout: 5000 },
              )
              .catch(() => undefined)
            if (route === '/aboutus' || route === '/aboutus/team')
              await page.locator('main h1').first().waitFor({ timeout: 10000 })
            await settle(page)
            const state = await geometry(page)
            const text = (await page.locator('#root').innerText()).slice(0, 100)
            const slots = await page.evaluate(() =>
              Array.from(document.querySelectorAll('[data-slot]')).reduce((counts, element) => {
                const key = element.getAttribute('data-slot')
                counts[key] = (counts[key] ?? 0) + 1
                return counts
              }, {}),
            )
            const row = {
              requestedRoute: route,
              actualRoute: new URL(page.url()).pathname,
              viewport,
              themePreference,
              expectedTheme,
              text,
              slots,
              errors: errors.slice(),
              httpErrors: httpErrors.slice(),
              failedRequests: failedRequests.slice(),
              ...state,
            }
            rows.push(row)
            if (state.horizontal > 1) row.issue = 'horizontal overflow'
            if (!text) row.issue = 'blank root'
            if (errors.length) row.issue = 'page error'
            if (state.theme !== expectedTheme || state.colorScheme !== expectedTheme)
              row.issue = 'theme did not apply'
            await page.screenshot({
              path: resolve(
                evidence,
                `real-${route.replaceAll('/', '_') || 'home'}-${viewport.width}-${themePreference}.png`,
              ),
            })
          }
        if (errors.length || rows.some((row) => row.issue)) {
          throw Object.assign(
            new Error(`Real routes have ${rows.filter((row) => row.issue).length} issues`),
            { details: { rows } },
          )
        }
        return { evidence: 'real app routes with API explicitly stubbed offline', rows }
      } finally {
        await context.close()
      }
    })
    await scenario('site header fixture: zoom, account and notification slots', async () => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page = await context.newPage(),
        rows = [],
        errors = []
      page.on('pageerror', (error) => errors.push(error.message))
      try {
        for (const auth of ['no', 'yes'])
          for (const notifications of ['no', 'yes']) {
            await page.goto(
              `${origin}/__exui_v1_fixture.html?mode=header&auth=${auth}&notifications=${notifications}`,
            )
            const header = page.locator('[data-site-header]')
            await header.waitFor()
            for (const [rootPx, viewport] of [
              [16, { width: 1440, height: 900 }],
              [20, { width: 1440, height: 900 }],
              [24, { width: 1440, height: 900 }],
              [32, { width: 1440, height: 900 }],
              [16, { width: 640, height: 320 }],
              [20, { width: 640, height: 320 }],
              [24, { width: 640, height: 320 }],
              [32, { width: 640, height: 320 }],
            ]) {
              await page.setViewportSize(viewport)
              await page.evaluate((size) => {
                document.documentElement.style.fontSize = `${size}px`
              }, rootPx)
              await settle(page)
              const state = await geometry(page)
              const headerRect = await header.evaluate((element) =>
                element.getBoundingClientRect().toJSON(),
              )
              const navigation = page.getByRole('navigation', { name: '主导航' })
              const mobileNavigation = page.locator('[aria-label="打开导航菜单"]')
              const navigationVisible = await navigation.isVisible()
              const mobileNavigationVisible = await mobileNavigation.isVisible()
              const account =
                auth === 'yes' || mobileNavigationVisible
                  ? page.locator('[aria-label="用户菜单"]:visible').first()
                  : page.getByRole('button', { name: '登录', exact: true })
              const accountReachable = await reachable(account)
              const notificationReachable =
                notifications === 'no' ||
                (await reachable(page.getByRole('button', { name: '通知验收' })))
              const row = {
                auth,
                notifications,
                rootPx,
                viewport,
                headerRect,
                navigationVisible,
                mobileNavigationVisible,
                accountReachable,
                notificationReachable,
                ...state,
              }
              rows.push(row)
              await page.screenshot({
                path: resolve(
                  evidence,
                  `header-${auth}-${notifications}-root${rootPx}-${viewport.width}.png`,
                ),
              })
              assert(
                state.horizontal <= 1 && headerRect.right <= viewport.width + 1,
                `Header overflows at ${JSON.stringify(row)}`,
              )
              assert(
                navigationVisible !== mobileNavigationVisible &&
                  accountReachable &&
                  notificationReachable,
                `Header navigation/account/notification unreachable at ${JSON.stringify(row)}`,
              )
            }
          }
        assert.deepEqual(errors, [], 'Header fixture has no page errors')
        return { evidence: 'real SiteHeader and AuthArea with website CSS', rows }
      } finally {
        await context.close()
      }
    })
    await scenario('member modal: isolated real component', async () => {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
      const page = await context.newPage(),
        errors = []
      page.on('pageerror', (error) => errors.push(error.message))
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(`console: ${message.text()}`)
      })
      try {
        await page.goto(`${origin}/__exui_v1_fixture.html?mode=member`)
        const trigger = page.getByRole('button', { name: '打开成员简介' })
        await trigger.waitFor({ timeout: 10000 }).catch(async (error) => {
          throw new Error(
            `${error.message}; page errors: ${JSON.stringify(errors)}; body: ${JSON.stringify((await page.locator('body').innerText()).slice(0, 500))}`,
          )
        })
        await trigger.click()
        const dialog = page.getByRole('dialog')
        await dialog.waitFor()
        await settle(page)
        const state = await dialog.evaluate((element) => ({
          rect: element.getBoundingClientRect().toJSON(),
          viewport: { width: innerWidth, height: innerHeight },
          horizontal: document.documentElement.scrollWidth - innerWidth,
        }))
        await page.screenshot({ path: resolve(evidence, 'fixture-member-modal-390.png') })
        if (Math.abs(state.rect.width - state.viewport.width) > 1 || errors.length) {
          throw Object.assign(new Error('Member dialog does not fill the phone viewport'), {
            details: { state, errors },
          })
        }
        await dialog.getByRole('button', { name: '关闭成员简介' }).click()
        await dialog.waitFor({ state: 'hidden' })
        await page.waitForFunction(
          () => document.activeElement?.textContent === '打开成员简介',
          undefined,
          { timeout: 3000 },
        )
        return { evidence: 'isolated real MemberModal with website CSS', state }
      } finally {
        await context.close()
      }
    })
  },
  report: ({ status, browser, results, failures }) => ({ status, browser, results, failures }),
  summary: ({ status, results, failures }) => ({
    status,
    results: results.map(({ name, status, error }) => ({ name, status, error })),
    failures,
    output: 'output/playwright/exui-v1-experience',
  }),
})
if (outcome.status === 'FAIL') process.exitCode = 1
