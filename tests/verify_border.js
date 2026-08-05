// verify_border.js — 清代 1820 省界线层专项验收（2026-08-05 试水：hist 滑块 1644-1820 显示）
// 前置: node server.js 已启动（http://localhost:3099）
'use strict';
const { chromium } = require('playwright');
const URL = 'http://localhost:3099/';
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('✅', name, extra ? '— ' + extra : ''); }
  else { fail++; console.log('❌', name, extra ? '— ' + extra : ''); }
}
const setYr = (p, y) => p.evaluate(y => { yrSlider.value = y; yrSlider.dispatchEvent(new Event('input')); }, y);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Referer': 'https://timeline.yinyizhuan.cn/' });  // 天地图白名单（本地验证）
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof BORDER_QING1820 !== 'undefined' && BORDER_QING1820.features.length > 0, { timeout: 30000 });
  const nBorders = await page.evaluate(() => BORDER_QING1820.features.length);
  ok('borders.js 数据加载', nBorders > 0, nBorders + ' 省界线');

  await page.click('.tab[data-view="map"]');
  await page.waitForTimeout(2000);

  /* 范围外（明 1500）不显示 */
  await setYr(page, 1500);
  await page.waitForTimeout(1000);
  ok('滑块1500（范围外）隐藏', (await page.evaluate(() => borderShown)) === false, 'borderShown=false');

  /* 范围内（清 1700）显示 */
  await setYr(page, 1700);
  await page.waitForTimeout(1200);
  ok('滑块1700（1644-1820 内）显示', (await page.evaluate(() => borderShown)) === true, 'borderShown=true');
  const nPath = await page.evaluate(() => document.querySelectorAll('.leaflet-overlay-pane path').length);
  ok('省界 path 已渲染', nPath > 20, nPath + ' path');

  /* 全部年份模式隐藏 */
  await page.evaluate(() => yrAll.click());
  await page.waitForTimeout(1000);
  ok('全部年份隐藏', (await page.evaluate(() => borderShown)) === false, '');
  /* 滑块恢复（移除全部年份）→ 重新显示 */
  await setYr(page, 1750);
  await page.waitForTimeout(1000);
  ok('滑块 1750 恢复显示', (await page.evaluate(() => borderShown)) === true, '');

  /* 边界边界：1820 显示、1644 显示、1643 隐藏、1821 隐藏 */
  await setYr(page, 1644); await page.waitForTimeout(800);
  ok('下限 1644 显示', (await page.evaluate(() => borderShown)) === true, '');
  await setYr(page, 1820); await page.waitForTimeout(800);
  ok('上限 1820 显示', (await page.evaluate(() => borderShown)) === true, '');
  await setYr(page, 1643); await page.waitForTimeout(800);
  ok('1643（下限外）隐藏', (await page.evaluate(() => borderShown)) === false, '');
  await setYr(page, 1821); await page.waitForTimeout(800);
  ok('1821（上限外）隐藏', (await page.evaluate(() => borderShown)) === false, '');

  /* modern 模式不显示 */
  await page.click('#segRow .seg-btn[data-seg="modern"]');
  await page.waitForTimeout(500);
  await page.click('.tab[data-view="map"]');
  await page.waitForTimeout(1500);
  ok('近代史地图（modern）不显示', (await page.evaluate(() => borderShown)) === false, '');

  ok('无 JS 报错', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  await browser.close();
  console.log('\n===== ' + pass + ' 通过 / ' + fail + ' 失败 =====');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
