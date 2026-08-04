// verify_modern.js — 近代史时间轴界面验收（2026-08-04）
// 用: node verify_modern.js （前置: node server.js 已启动）
'use strict';
const { chromium } = require('playwright');

const URL = 'http://localhost:3099/';
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('✅', name, extra ? '— ' + extra : ''); }
  else { fail++; console.log('❌', name, extra ? '— ' + extra : ''); }
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push('PAGEERROR: ' + e.message));
  page.on('requestfailed', r => {
    const u = r.url();
    if (!/leaflet|jsdelivr|fonts\.google|127\.0\.0\.1|localhost/.test(u) || !/\.(js|css|woff2?)$/.test(u)) return;
    pageErrors.push('requestfailed: ' + u);
  });

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof EVENTS !== 'undefined' && EVENTS.length > 0, { timeout: 30000 });

  // 切到中国近现代史
  await page.click('.seg-btn[data-seg="modern"]');
  await page.waitForTimeout(400);

  ok('modern 顶栏计数', (await page.textContent('#cnt')).includes('301'), await page.textContent('#cnt'));

  // 11 段 band
  const bands = await page.$$eval('#main .band', els => els.map(e => e.querySelector('h2').textContent));
  ok('modern 11 段 band', bands.length === 11, bands.length + ' 段: ' + bands.slice(0, 4).join('|') + '…');
  ok('段1 命名', bands[0] === '外国武装侵略和国内农民战争', bands[0]);

  // 分期链接 11 段 + 全部
  const links = await page.$$eval('#perGroup a.jump', els => els.map(e => e.textContent));
  ok('分期链接 11+1', links.length === 12 && links[0] === '全部', links.length + ' 个');

  // 空段占位（段4=土地革命战争时期 无数据 → 数据待生成）
  const emptyRows = await page.$$eval('#main .row', els => els.filter(e => e.textContent.includes('数据待生成')).length);
  ok('空段占位 7 个', emptyRows === 7, emptyRows + ' 个');

  // 段0 首事件 = 1838 黄爵滋上书（复合时间排序：1838-6）
  const firstRow = await page.$$eval('#main .row', els => {
    const rows = els.filter(e => e.querySelector('.year') && !e.textContent.includes('数据待生成'));
    return rows.length ? { y: rows[0].querySelector('.year').textContent.trim(), t: rows[0].querySelector('h3').textContent } : null;
  });
  ok('段0 首事件(1838年6月)', firstRow && firstRow.y.includes('1838年6月') && firstRow.t.includes('黄爵滋'), JSON.stringify(firstRow));

  // 段3 首事件 = 1912-2-15 袁世凯当选（1912 边界：段2 末应为清帝退位 2-12）
  const seg2Last = await page.$$eval('#main .row', els => {
    const rows = els.filter(e => e.querySelector('.year') && !e.textContent.includes('数据待生成'));
    // 段2 结束标志：清帝退位（1912-2-12）应在袁世凯当选（2-15）之前
    const titles = rows.map(r => r.querySelector('h3').textContent);
    return { tui: titles.indexOf('清帝退位'), yuan: titles.indexOf('袁世凯当选临时大总统') };
  });
  ok('1912 边界：清帝退位(段2末)先于袁世凯当选(段3首)', seg2Last.tui >= 0 && seg2Last.yuan > seg2Last.tui, JSON.stringify(seg2Last));

  // 五四运动在段3（北洋政府时期）
  const may4 = await page.$$eval('#main .row', els => els.some(e => e.textContent.includes('五四运动')));
  ok('五四运动渲染', may4);

  // 筛选：展开面板 → 军事
  await page.click('#filterToggle');
  await page.waitForTimeout(200);
  await page.click('#filters button.f:has-text("军事")');
  await page.waitForTimeout(300);
  const cntF = await page.textContent('#cnt');
  ok('筛选军事计数', /筛得 \d+ 事/.test(cntF), cntF);
  // 取消筛选
  await page.click('#filters button.f:has-text("军事")');
  await page.click('#filterToggle');
  await page.waitForTimeout(200);

  // 近代史地图：切地图视图 → 自动选近现代史 + 地图初始化
  await page.click('.tab[data-view="map"]');
  await page.waitForTimeout(800);
  const selVal = await page.$eval('#rangeSel', s => s.value);
  const sliderR = await page.$eval('#yrSlider', s => s.min + '~' + s.max);
  const mapMarkers = await page.evaluate(() => document.querySelectorAll('#map .leaflet-interactive, #map .marker-cluster').length);
  ok('近代史地图自动选中', selVal === 'modern', 'rangeSel=' + selVal);
  ok('近代史滑块范围 1838~2012', sliderR === '1838~2012', sliderR);
  ok('近代史地图有 marker', mapMarkers > 0, mapMarkers + ' 个');
  await page.click('.tab[data-view="timeline"]');

  // 切回古代史 → 15 bands 恢复
  await page.click('#segRow .seg-btn[data-seg="ancient"]');
  await page.waitForTimeout(400);
  const bandsA = await page.$$eval('#main .band', els => els.length);
  ok('切回古代史 15 bands', bandsA === 15, bandsA + ' bands');
  ok('古代史计数', (await page.textContent('#cnt')).includes('851'), await page.textContent('#cnt'));
  await page.click('.tab[data-view="map"]');
  await page.waitForTimeout(400);
  const selVal2 = await page.$eval('#rangeSel', s => s.value);
  ok('古代史进地图保持 hist', selVal2 === 'hist', 'rangeSel=' + selVal2);

  ok('无 JS 报错', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

  await browser.close();
  console.log(`\n===== ${pass} 通过 / ${fail} 失败 =====`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
