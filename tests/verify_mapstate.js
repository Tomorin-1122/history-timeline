const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:3099', { waitUntil: 'commit' });
  await page.waitForFunction(() => typeof EVENTS !== 'undefined', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await page.evaluate(() => { const b = document.querySelector('button[data-view="map"]'); if (b) b.click(); });
  await page.waitForTimeout(3000);
  const cnt = async ch => {
    await page.evaluate(c => { const a = document.querySelector(`[data-ch="${c}"]`); if (a) a.click(); }, ch);
    await page.waitForTimeout(2000);
    return page.evaluate(() => ({
      paths: document.querySelectorAll('.leaflet-overlay-pane path').length,
      circles: document.querySelectorAll('.leaflet-overlay-pane circle').length,
    }));
  };
  console.log('全部章:', JSON.stringify(await cnt(-1)));
  console.log('明章13:', JSON.stringify(await cnt(13)));
  console.log('清章14:', JSON.stringify(await cnt(14)));
  await browser.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
