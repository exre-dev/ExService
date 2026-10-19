// Run with a Browser Use tab at a desktop viewport with classic scrollbars.
// Usage: await assertNavbarGeometry(tab, 'http://localhost:8081')
// DOM geometry needs a real browser; jsdom cannot detect this regression.
export async function assertNavbarGeometry(tab, baseUrl) {
  const rows = []
  for (const path of ['/about', '/communities/rifling-911', '/about']) {
    await tab.goto(new URL(path, baseUrl).href)
    await tab.playwright.getByRole('navigation', { name: '主导航' }).waitFor({ state: 'visible' })
    rows.push(
      await tab.playwright.evaluate(async () => {
        await document.fonts.ready
        const navigation = document.querySelector('[aria-label="主导航"]')
        const logo = document.querySelector('a[href="/"]')
        const rect = (element) => {
          const { x, y, width, height } = element.getBoundingClientRect()
          return { x, y, width, height }
        }
        return { path: location.pathname, logo: rect(logo), navigation: rect(navigation) }
      }),
    )
  }
  const reference = rows[0]
  for (const row of rows) {
    for (const element of ['logo', 'navigation']) {
      for (const axis of ['x', 'y', 'width', 'height']) {
        if (Math.abs(row[element][axis] - reference[element][axis]) > 1) {
          throw new Error(`NavBar geometry shifted: ${JSON.stringify(rows)}`)
        }
      }
    }
  }
  return rows
}

export async function assertNavbarModalGeometry(tab, baseUrl) {
  const rows = []
  for (const path of ['/about', '/communities/rifling-911']) {
    await tab.goto(new URL(path, baseUrl).href)
    const login = tab.playwright.getByRole('button', { name: '登录', exact: true })
    await login.waitFor({ state: 'visible' })
    const measure = () =>
      tab.playwright.evaluate(async () => {
        await document.fonts.ready
        return document.querySelector('a[href="/"]').getBoundingClientRect().x
      })
    const before = await measure()
    await login.click()
    await tab.playwright.getByRole('dialog').waitFor({ state: 'visible' })
    const open = await measure()
    await tab.playwright.getByRole('dialog').press('Escape')
    await tab.playwright.getByRole('dialog').waitFor({ state: 'hidden' })
    const closed = await measure()
    rows.push({ path, before, open, closed })
    if (Math.abs(open - before) > 1 || Math.abs(closed - before) > 1) {
      throw new Error(`Modal changed NavBar position: ${JSON.stringify(rows)}`)
    }
  }
  return rows
}
