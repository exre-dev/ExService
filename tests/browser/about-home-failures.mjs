// Pass to playwright-cli run-code --filename at a Website Vite dev origin.
// Only fixture metadata, image responses and a body-chunk request are intercepted.
// The production registry adapter, AboutHome, AboutBody and useContent execute unchanged.
;async (page) => {
  const origin = await page.evaluate(() => location.origin)
  const assert = (condition, message) => {
    if (!condition) throw new Error(message)
  }
  const metadataPattern = '**/@id/__x00__virtual:content/about*'
  const imagePattern = '**/browser-fixture.png'
  const bodyPattern = '**/content/about/index.mdx?collection=aboutHome*'
  let failImage = false
  await page.route(imagePattern, (route) => route.fulfill({ status: 404, body: '' }))
  await page.route(metadataPattern, async (route) => {
    const response = await route.fetch()
    const source = await response.text()
    const fixtureUrl = failImage
      ? '/browser-fixture.png'
      : 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='
    await route.fulfill({
      response,
      body:
        source +
        '\nconst fixtureHome=data.pages.find(page=>page.kind==="home");fixtureHome.cardImages={media:{src:"assets/browser-fixture.png",alt:"Browser fixture",width:1,height:1}};assets["assets/browser-fixture.png"]=' +
        JSON.stringify(fixtureUrl) +
        ';',
    })
  })
  try {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${origin}/aboutus`)
    await page.getByText('持续整理中的介绍', { exact: true }).waitFor()
    const image = page.getByRole('img', { name: 'Browser fixture' })
    await image.waitFor()
    await image.scrollIntoViewIfNeeded()
    await page.waitForFunction(
      () => document.querySelector('img[alt="Browser fixture"]')?.naturalWidth === 1,
    )
    const before = await image.evaluate((element) => {
      const r = element.parentElement.getBoundingClientRect()
      return { width: r.width, height: r.height }
    })
    failImage = true
    await page.reload()
    await page.getByText('音乐和影像 · 素材待补充', { exact: true }).waitFor()
    assert(
      (await page.getByRole('img', { name: 'Browser fixture' }).count()) === 0,
      'Failed image remained mounted',
    )
    const after = await page
      .getByText('音乐和影像 · 素材待补充', { exact: true })
      .evaluate((element) => {
        const r = element.parentElement.getBoundingClientRect()
        return { width: r.width, height: r.height }
      })
    assert(
      Math.abs(before.width - after.width) < 1 && Math.abs(before.height - after.height) < 1,
      'Image failure changed the slot geometry',
    )
    await page.unroute(metadataPattern)
    await page.unroute(imagePattern)
    await page.route(bodyPattern, (route) => route.abort('failed'))
    await page.goto(`${origin}/aboutus`)
    const belief = page.getByRole('article', { name: '我们的理念' })
    await belief.getByRole('alert').waitFor()
    assert(
      (await page.locator('#about-content > article:not([aria-label="我们的理念"]) a').count()) ===
        5,
      'Body failure removed metadata entries',
    )
    await belief.getByRole('button', { name: '重试', exact: true }).click()
    await belief.getByRole('alert').waitFor()
    await page.unroute(bodyPattern)
    await belief.getByRole('button', { name: '重新加载当前页面' }).click()
    await page.getByText('持续整理中的介绍', { exact: true }).waitFor()
    return {
      status: 'PASS',
      validImage: true,
      failedImage: true,
      stableGeometry: before,
      bodyFailure: true,
      retry: true,
      documentReloadRecovery: true,
    }
  } finally {
    await page.unroute(metadataPattern)
    await page.unroute(imagePattern)
    await page.unroute(bodyPattern)
  }
}
