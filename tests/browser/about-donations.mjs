// Run with playwright-cli run-code --filename at a Website Vite dev origin.
// Fixture channels/donors are only injected into this browser's metadata response.
;async (page) => {
  const origin = await page.evaluate(() => location.origin)
  const assert = (condition, message) => {
    if (!condition) throw new Error(message)
  }
  const metadataPattern = '**/@id/__x00__virtual:content/about*'
  const publicFixture = {
    channels: [
      {
        id: 'fixture-channel',
        name: '浏览器测试渠道',
        description: '仅用于验收的测试资料',
        url: 'https://example.com/support',
        qrCode: { src: 'assets/browser-qr.png', alt: '测试二维码', width: 1, height: 1 },
      },
    ],
    donors: [{ id: 'fixture-donor', nickname: '测试昵称'.repeat(20), date: '2026-10-12' }],
  }
  const rows = []
  let fixtureEnabled = true
  await page.route(metadataPattern, async (route) => {
    const response = await route.fetch()
    const source = await response.text()
    await route.fulfill({
      response,
      body:
        source +
        (fixtureEnabled
          ? '\nObject.assign(data.pages.find(page=>page.kind==="donations"),' +
            JSON.stringify(publicFixture) +
            ');assets["assets/browser-qr.png"]="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";'
          : ''),
    })
  })
  try {
    await page.goto(`${origin}/aboutus/donations`)
    await page.getByRole('heading', { level: 1 }).waitFor()
    const channel = page.getByRole('article', { name: '浏览器测试渠道', exact: true })
    const link = channel.getByRole('link', { name: '前往浏览器测试渠道', exact: true })
    assert(
      (await link.getAttribute('href')) === 'https://example.com/support',
      'Channel URL was not rendered',
    )
    assert(
      (await link.getAttribute('rel')) === 'noopener noreferrer',
      'Channel link lacks opener isolation',
    )
    await channel.getByRole('img', { name: '测试二维码' }).scrollIntoViewIfNeeded()
    await page.waitForFunction(() =>
      [...document.querySelectorAll('main img')].some(
        (image) => image.alt === '测试二维码' && image.naturalWidth === 1,
      ),
    )
    assert(
      (await page.locator('main time').getAttribute('datetime')) === '2026-10-12',
      'Donor date is not semantic',
    )
    assert(
      (await page.getByText(publicFixture.donors[0].nickname, { exact: true }).count()) === 1,
      'Donor nickname missing',
    )
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 })
      for (const theme of ['light', 'dark']) {
        await page.evaluate((theme) => {
          document.documentElement.classList.remove('light', 'dark')
          document.documentElement.classList.add(theme)
        }, theme)
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        )
        assert(!overflow, `Donation overflow at ${width}px/${theme}`)
        rows.push({ width, theme, overflow })
      }
    }
    fixtureEnabled = false
    await page.goto(`${origin}/aboutus/donations`)
    await page.getByRole('heading', { name: '渠道信息正在整理', exact: true }).waitFor()
    await page.getByRole('heading', { name: '每一份心意，我们都记得。', exact: true }).waitFor()
    assert(
      (await page.locator('main time').count()) === 0,
      'Fixture donor remained after removing test input',
    )
    return {
      status: 'PASS',
      channelLink: true,
      qrImage: true,
      nicknameAndDate: true,
      rows,
      realContentEmptyStates: true,
    }
  } finally {
    await page.unroute(metadataPattern)
  }
}
