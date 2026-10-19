// Run: node tests/browser/notification-experience.mjs
// Real Chromium geometry/focus with isolated UI props, not authenticated API acceptance.
import assert from 'node:assert/strict'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runBrowserSuite } from './browser-suite.mjs'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const evidence = resolve(repository, 'output/playwright/notification-experience')
const fixturePath = resolve(repository, 'tests/browser/notification-fixture.tsx').replaceAll(
  '\\',
  '/',
)
const results = []
const preferenceResults = []
const outcome = await runBrowserSuite({
  repository,
  output: evidence,
  results,
  fixture: {
    name: 'isolated-notification-fixture',
    route: '/__notification_fixture.html',
    path: fixturePath,
  },
  run: async ({ browser, origin }) => {
    for (const colorScheme of ['light', 'dark'])
      for (const reducedMotion of ['no-preference', 'reduce']) {
        const context = await browser.newContext({
          viewport: { width: 1440, height: 900 },
          colorScheme,
          reducedMotion,
        })
        try {
          const page = await context.newPage()
          const errors = [],
            apiRequests = []
          page.on('pageerror', (error) => errors.push(error.message))
          page.on('request', (request) => {
            if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url())
          })
          await page.goto(`${origin}/__notification_fixture.html`)
          const bell = page.getByRole('button', { name: '未读通知，0 条', exact: true })
          await bell.waitFor()
          assert.equal(await bell.locator('span').count(), 0, 'Zero count renders no badge')
          await bell.click()
          assert.equal(await page.getByText('打开面板不会自动标为已读。').count(), 0)
          await page.getByRole('button', { name: '查看全部', exact: true }).click()
          const dialog = page.getByRole('dialog', { name: '通知历史', exact: true })
          await dialog.waitFor()
          const settle = async () => {
            await dialog.evaluate(async (element) => {
              await document.fonts.ready
              // Resize observers and the responsive layout must run before collecting their animations.
              await new Promise((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(resolve)),
              )
              await Promise.all(
                element
                  .getAnimations({ subtree: true })
                  .map((animation) => animation.finished.catch(() => undefined)),
              )
              await new Promise((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(resolve)),
              )
            })
          }
          const listScroll = dialog.getByRole('tabpanel')
          for (const width of [1440, 390, 360, 767, 768]) {
            await page.setViewportSize({ width, height: 900 })
            await settle()
            const geometry = await dialog.evaluate((element) => {
              const rect = (target) => {
                const { x, y, width, height } = target.getBoundingClientRect()
                return { x, y, width, height }
              }
              const detail = element.querySelector('[aria-label="通知正文"]')
              const placeholder = [...detail.querySelectorAll('p')].find(
                (node) => node.textContent === '点击通知查看内容',
              )
              const empty = placeholder?.parentElement
              const tabs = element.querySelector('[role="tablist"]')
              const activeTab = tabs.querySelector('[aria-selected="true"]')
              const button = [...element.querySelectorAll('button')].find(
                (node) => node.textContent === '清理全部',
              )
              const body = element.querySelector('[data-slot="dialog-body"]')
              if (!body) throw new Error('DialogBody slot is missing')
              const buttonStyle = getComputedStyle(button)
              const secondaryProbe = document.createElement('span')
              secondaryProbe.style.color = 'var(--exui-text-secondary)'
              button.append(secondaryProbe)
              const secondaryColor = getComputedStyle(secondaryProbe).color
              secondaryProbe.remove()
              return {
                modal: rect(element),
                detail: rect(detail),
                empty: empty ? rect(empty) : null,
                tabs: rect(tabs),
                button: rect(button),
                viewport: {
                  width: innerWidth,
                  height: innerHeight,
                  clientWidth: document.documentElement.clientWidth,
                },
                tabsVariant: tabs.dataset.variant,
                clearColor: buttonStyle.color,
                secondaryColor,
                tabsRadius: parseFloat(getComputedStyle(tabs).borderTopLeftRadius),
                activeTabRadius: parseFloat(getComputedStyle(activeTab).borderTopLeftRadius),
                activeTabHeight: rect(activeTab).height,
                clearBorderColor: buttonStyle.borderTopColor,
                bodyOverflow: body.scrollHeight - body.clientHeight,
                horizontal: document.documentElement.scrollWidth - innerWidth,
              }
            })
            assert(geometry.horizontal <= 1, 'No horizontal overflow')
            assert.equal(geometry.tabsVariant, 'default', 'Tabs use the segmented surface')
            assert(
              geometry.tabsRadius >= geometry.tabs.height / 2,
              'Tab group has semicircular ends',
            )
            assert(
              geometry.activeTabRadius >= geometry.activeTabHeight / 2,
              'Active Tab has semicircular ends',
            )
            assert.equal(geometry.clearColor, geometry.secondaryColor, 'Clear uses secondary text')
            assert.equal(
              geometry.clearBorderColor,
              'rgba(0, 0, 0, 0)',
              'Clear has no visible outline',
            )
            assert(geometry.bodyOverflow <= 1, 'Outer body does not introduce a third scrollbar')
            assert(
              Math.abs(
                geometry.tabs.y +
                  geometry.tabs.height / 2 -
                  geometry.button.y -
                  geometry.button.height / 2,
              ) <= 2,
              'Tools occupy one row',
            )
            if (width < 768) {
              for (const axis of ['x', 'y'])
                assert(Math.abs(geometry.modal[axis]) <= 1, 'Phone frame starts at viewport edge')
              for (const axis of ['width', 'height'])
                assert(
                  Math.abs(
                    geometry.modal[axis] -
                      (axis === 'width' ? geometry.viewport.clientWidth : geometry.viewport.height),
                  ) <= 1,
                  `Phone modal fills viewport: ${JSON.stringify({ width, axis, geometry })}`,
                )
            } else {
              assert(geometry.empty?.height > 0)
              const center = (rect) => [rect.x + rect.width / 2, rect.y + rect.height / 2]
              const left = center(geometry.detail),
                right = center(geometry.empty)
              assert(
                left.every((value, index) => Math.abs(value - right[index]) <= 2),
                'Empty body fills and centers in usable detail column',
              )
            }
            results.push({ colorScheme, reducedMotion, width, geometry })
            if (reducedMotion === 'no-preference' && (width === 1440 || width === 390)) {
              await page.screenshot({ path: resolve(evidence, `${colorScheme}-${width}-list.png`) })
            }
          }
          for (const rootPx of [16, 20, 24]) {
            await page.evaluate((size) => {
              document.documentElement.style.fontSize = `${size}px`
            }, rootPx)
            for (const width of [48 * rootPx - 1, 48 * rootPx + 1]) {
              await page.setViewportSize({ width, height: 900 })
              await settle()
              await dialog.evaluate(async (element) => {
                const animations = element
                  .getAnimations({ subtree: true })
                  .filter((animation) => animation.playState === 'running')
                await Promise.race([
                  Promise.all(
                    animations.map((animation) => animation.finished.catch(() => undefined)),
                  ),
                  new Promise((resolve) => setTimeout(resolve, 500)),
                ])
              })
              await settle()
              const layout = await dialog.evaluate((element) => ({
                layout: element.querySelector('[data-layout]')?.getAttribute('data-layout'),
                horizontal: document.documentElement.scrollWidth - innerWidth,
                clientWidth: document.documentElement.clientWidth,
                viewportWidth: innerWidth,
                rect: element.getBoundingClientRect().toJSON(),
              }))
              const expected = width < 48 * rootPx ? 'narrow' : 'wide'
              assert.equal(
                layout.layout,
                expected,
                `48rem layout at ${rootPx}px root and ${width}px viewport`,
              )
              assert(layout.horizontal <= 1, 'No horizontal overflow across dynamic root sizes')
              if (expected === 'narrow') {
                assert(
                  Math.abs(layout.rect.width - layout.viewportWidth) <= 1,
                  `Narrow dialog fills physical viewport: ${JSON.stringify(layout)}`,
                )
              }
              results.push({ colorScheme, reducedMotion, rootPx, width, layout })
            }
          }
          await page.setViewportSize({ width: 640, height: 320 })
          await page.evaluate(() => {
            document.documentElement.style.fontSize = '32px'
          })
          await settle()
          for (const target of [
            dialog.getByRole('heading', { name: '通知历史' }),
            dialog.getByRole('button', { name: '清理全部' }),
          ]) {
            await target.scrollIntoViewIfNeeded()
            assert(
              await target.isVisible(),
              'Title and action remain reachable at 640x320/root 32px',
            )
          }
          assert(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            'Extreme dialog has no horizontal overflow',
          )
          await page.screenshot({
            path: resolve(evidence, `${colorScheme}-${reducedMotion}-640x320-root32.png`),
          })
          results.push({
            colorScheme,
            reducedMotion,
            rootPx: 32,
            width: 640,
            height: 320,
            reachable: true,
          })
          await page.evaluate(() => {
            document.documentElement.style.fontSize = ''
          })
          // Pagination and independent scroll containers in the desktop layout.
          await page.setViewportSize({ width: 1440, height: 900 })
          await settle()
          await listScroll.evaluate((element) => {
            element.scrollTop = element.scrollHeight
          })
          await page.waitForFunction(
            () =>
              document.querySelector('[data-load-calls]')?.getAttribute('data-load-calls') === '1',
          )
          assert.equal(await dialog.locator('[data-notification-select]').count(), 40)
          await dialog.locator('[data-notification-select="receipt-25"]').click()
          const detail = dialog.getByRole('region', { name: '通知正文', exact: true })
          const beforeList = await listScroll.evaluate((element) => element.scrollTop)
          await detail.evaluate((element) => {
            element.scrollTop = 500
          })
          assert.equal(await listScroll.evaluate((element) => element.scrollTop), beforeList)
          assert(
            await detail.evaluate(
              (element) => element.scrollHeight > element.clientHeight && element.scrollTop > 0,
            ),
          )
          await page.setViewportSize({ width: 390, height: 900 })
          await settle()
          assert(
            await detail.getByRole('heading', { name: '通知 26', exact: true }).isVisible(),
            'Selection survives narrowing',
          )
          await page.setViewportSize({ width: 768, height: 900 })
          await settle()
          await page.setViewportSize({ width: 390, height: 900 })
          await settle()
          await dialog.getByRole('button', { name: '返回列表', exact: true }).click()
          await page.waitForFunction(
            () => document.activeElement?.getAttribute('data-notification-select') === 'receipt-25',
          )
          assert(
            Math.abs((await listScroll.evaluate((element) => element.scrollTop)) - beforeList) <= 2,
            'Back restores list scroll',
          )
          await page.keyboard.press('Escape')
          await dialog.waitFor({ state: 'hidden' })
          assert(
            await bell.evaluate((element) => document.activeElement === element),
            'Close returns focus to bell',
          )
          // Direct Popup selection opens phone body immediately; nested confirmation stays scoped.
          await bell.click()
          await page.evaluate(() => {
            window.notificationEntryShowsBody = null
            const check = () => {
              const modal = document.querySelector('[role="dialog"][data-slot="dialog-content"]')
              if (!modal || modal.getBoundingClientRect().width === 0) {
                requestAnimationFrame(check)
                return
              }
              const list = modal.querySelector('[aria-label="通知列表"]')
              window.notificationEntryShowsBody = getComputedStyle(list).display === 'none'
            }
            requestAnimationFrame(check)
          })
          await page.getByRole('button', { name: '通知 1', exact: true }).click()
          await dialog.waitFor()
          await settle()
          await page.waitForFunction(() => window.notificationEntryShowsBody !== null)
          assert(
            await page.evaluate(() => window.notificationEntryShowsBody),
            'First observed animation frame opens the phone body',
          )
          assert(await detail.getByRole('heading', { name: '通知 1', exact: true }).isVisible())
          await dialog.getByRole('button', { name: '返回列表', exact: true }).click()
          await listScroll.evaluate((element) => {
            element.scrollTop = 240
          })
          await dialog.locator('[data-notification-select="receipt-5"]').click()
          await page.evaluate(() => window.configureNotificationFixture('read-refresh'))
          await settle()
          await dialog.getByRole('button', { name: '返回列表', exact: true }).click()
          assert(
            Math.abs((await listScroll.evaluate((element) => element.scrollTop)) - 240) <= 2,
            'Phone return position survives a background first-page replacement',
          )
          assert.equal(
            await page.evaluate(() =>
              document.activeElement?.getAttribute('data-notification-select'),
            ),
            'receipt-5',
          )
          await dialog.getByRole('button', { name: '清理全部', exact: true }).click()
          const confirmation = page.getByRole('alertdialog')
          await confirmation.waitFor()
          await page.keyboard.press('Escape')
          await confirmation.waitFor({ state: 'hidden' })
          assert(await dialog.isVisible(), 'Confirmation Escape does not close outer Modal')
          await dialog.getByRole('button', { name: '清理全部', exact: true }).click()
          // The AlertDialog correctly hides its outer dialog from the accessibility tree.
          const frame = page.locator('[role="dialog"][data-slot="dialog-content"]')
          await confirmation.getByRole('button', { name: '确认清理', exact: true }).click()
          await page.waitForFunction(() =>
            [...document.querySelectorAll('button')].some(
              (button) => button.textContent.trim() === '关闭通知历史' && button.disabled,
            ),
          )
          assert(
            await frame
              .getByRole('button', { name: '关闭通知历史', exact: true, includeHidden: true })
              .isDisabled(),
          )
          await page.keyboard.press('Escape')
          assert(await frame.isVisible())
          await confirmation.waitFor({ state: 'hidden' })
          await page.evaluate(() => window.configureNotificationFixture('short'))
          await page
            .waitForFunction(
              () =>
                document.querySelector('[data-load-calls]')?.getAttribute('data-load-calls') ===
                '2',
            )
            .catch(async (error) => {
              const state = await page.evaluate(() => ({
                fixture: window.notificationFixtureState,
                list: document.querySelector('[role="tabpanel"]')?.getBoundingClientRect().toJSON(),
                sentinel: document
                  .querySelector('[role="tabpanel"]')
                  ?.lastElementChild?.getBoundingClientRect()
                  .toJSON(),
              }))
              console.error(
                JSON.stringify({ scenario: 'short-pages', colorScheme, reducedMotion, state }),
              )
              await page.screenshot({
                path: resolve(evidence, `${colorScheme}-${reducedMotion}-failure.png`),
              })
              throw error
            })
          assert.equal(
            await dialog.locator('[data-notification-select]').count(),
            3,
            'Short pages continue without an intersection transition',
          )
          await dialog.getByRole('tab', { name: '未读', exact: true }).click()
          assert(
            await dialog.getByRole('button', { name: '清理全部', exact: true }).isEnabled(),
            'Empty unread does not imply empty history',
          )
          await page.evaluate(() => window.configureNotificationFixture('failed'))
          await dialog
            .getByRole('button', { name: '重新加载通知', exact: true })
            .waitFor({ state: 'visible' })
          assert(
            await dialog.getByRole('button', { name: '重新加载通知', exact: true }).isVisible(),
          )
          await page.screenshot({
            path: resolve(evidence, `${colorScheme}-${reducedMotion}-phone.png`),
          })
          await page.goto(`${origin}/__notification_fixture.html?preferences=1#preferences`)
          const community = page.getByRole('switch', { name: '社区动态', exact: true })
          const personal = page.getByRole('switch', { name: '个人提醒', exact: true })
          await community.waitFor()
          assert.equal(
            await page.getByRole('switch').count(),
            2,
            'Only editable preferences are shown',
          )
          assert.equal(await page.getByText('服务通知', { exact: true }).count(), 0)
          assert.equal(await page.getByRole('button', { name: /保存更改|取消更改/ }).count(), 0)
          assert.equal(await page.getByText(/已保存/).count(), 0, 'Saved status stays silent')
          assert.equal(
            await page.locator('[data-preference-calls]').getAttribute('data-preference-calls'),
            '0',
            'Initial read does not save',
          )
          await community.click()
          await page.waitForFunction(
            () =>
              document
                .querySelector('[data-preference-calls]')
                ?.getAttribute('data-preference-calls') === '1',
          )
          assert(await community.isDisabled())
          assert(await personal.isDisabled())
          await page.evaluate(() => window.finishPreferenceSave(true))
          await page.waitForFunction(() => !document.querySelector('[role="switch"]')?.disabled)
          assert.equal(await community.getAttribute('aria-checked'), 'false')
          assert.equal(
            await page.getByText(/已保存/).count(),
            0,
            'Successful autosave stays silent',
          )
          await personal.click()
          await page.waitForFunction(
            () =>
              document
                .querySelector('[data-preference-calls]')
                ?.getAttribute('data-preference-calls') === '2',
          )
          await page.evaluate(() => window.finishPreferenceSave(false))
          await page.getByRole('alert').waitFor()
          assert.equal(
            await personal.getAttribute('aria-checked'),
            'true',
            'Failed change rolls back',
          )
          await page.getByRole('button', { name: '重试保存', exact: true }).click()
          await page.waitForFunction(
            () =>
              document
                .querySelector('[data-preference-calls]')
                ?.getAttribute('data-preference-calls') === '3',
          )
          await page.evaluate(() => window.finishPreferenceSave(true))
          await page.waitForFunction(() => !document.querySelector('[role="switch"]')?.disabled)
          assert.equal(await personal.getAttribute('aria-checked'), 'false')
          for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: 900 })
            assert(
              await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
              'Preference panel has no horizontal overflow',
            )
            await page.screenshot({
              path: resolve(evidence, `${colorScheme}-${reducedMotion}-${width}-preferences.png`),
            })
          }
          preferenceResults.push({ colorScheme, reducedMotion, status: 'PASS', saves: 3 })
          assert.deepEqual(errors, [])
          assert.deepEqual(apiRequests, [], 'Fixture never calls a runtime API')
        } finally {
          await context.close()
        }
      }
  },
  report: ({ status, results, failures }) => ({
    status,
    evidence: 'isolated UI in real Chromium',
    results,
    preferences: preferenceResults,
    failures,
  }),
  summary: ({ status, results, failures }) => ({
    status,
    geometries: results.length,
    preferences: preferenceResults.length,
    browser: 'Chromium',
    evidence: 'isolated shared UI fixture',
    output: 'output/playwright/notification-experience',
    authenticatedAPI: 'NOT_EXECUTED',
    realDevices: 'NOT_EXECUTED',
    failures,
  }),
})
if (outcome.status === 'FAIL') process.exitCode = 1
