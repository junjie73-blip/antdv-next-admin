const { chromium } = require('playwright')

;(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  })
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  await page.goto('http://localhost:9081/dashboard/monitor', { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(3000)
  await page.screenshot({ path: 'screen_monitor.png', fullPage: true })
  await browser.close()
  console.log('screenshot saved: screen_monitor.png')
})().catch(err => {
  console.error(err)
  process.exit(1)
})
