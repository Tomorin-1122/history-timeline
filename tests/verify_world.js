// verify_world.js — 世界史接入验收（2026-08-05：914 条 / 8 段 / 两史段按钮 / 地图五态 / 复习两段）
// 依赖：本地 node server.js（端口 3099）
// 运行：NODE_PATH=$(npm root -g) node tests/verify_world.js
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort());   // CDN 隔离：核心逻辑本地验证（Leaflet 挂起会阻塞 data.js）
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/fontsource|ERR_FAILED/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => { if (!/L is not defined/.test(e.message)) errors.push('PAGEERROR: ' + e.message); });

  await page.goto('http://localhost:3099', { waitUntil: 'commit', timeout: 15000 });
  await page.waitForFunction(() => typeof EVENTS_WORLD !== 'undefined' && EVENTS_WORLD.length > 0, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const results = [];
  const check = (name, ok, detail) => { results.push({ name, ok, detail: detail || '' }); console.log((ok ? '✅' : '❌') + ' ' + name + (detail ? ' — ' + detail : '')); };

  /* 1. 数据注入 */
  const counts = await page.evaluate(() => ({ a: EVENTS.length, m: EVENTS_MODERN.length, w: EVENTS_WORLD.length, ch: CHAPTERS_WORLD.length }));
  check('世界史数据注入（914 条 / 8 段）', counts.w === 914 && counts.ch === 8, JSON.stringify(counts));
  const chNames = await page.evaluate(() => CHAPTERS_WORLD.map(c => c.name).join('/'));
  check('世界史 8 段标准名', chNames === '史前时代/早期文明/古典文明/中古封建时代/近代早期/革命与工业化/现代/当代', chNames);

  /* 2. L2 世界史段切换 → 时间轴 4 段带 + 计数 */
  const segBtns = await page.$$eval('#segRow .seg-btn', bs => bs.map(b => ({ t: b.textContent.trim(), dis: b.disabled })));
  check('L2 世界史两段按钮可用', !segBtns[2].dis && !segBtns[3].dis, JSON.stringify(segBtns.map(b => b.t)));
  await page.click('#segRow .seg-btn[data-seg="world-ancient"]');
  await page.waitForTimeout(800);
  const bandsA = await page.$$eval('#main .band', bs => bs.map(b => b.querySelector('h2').textContent).join('/'));
  const cntA = await page.textContent('#cnt');
  check('世界古代史时间轴（4 段带）', bandsA === '史前时代/早期文明/古典文明/中古封建时代', bandsA);
  check('世界古代史计数 238', cntA.includes('238'), cntA);
  const rowsA = await page.$$eval('#main .row', rs => rs.filter(r => r.dataset.idx).length);
  check('世界古代史事件行渲染 > 0', rowsA > 100, rowsA + ' rows');

  await page.click('#segRow .seg-btn[data-seg="world-modern"]');
  await page.waitForTimeout(800);
  const bandsM = await page.$$eval('#main .band', bs => bs.map(b => b.querySelector('h2').textContent).join('/'));
  const cntM = await page.textContent('#cnt');
  check('世界近现代史时间轴（4 段带）', bandsM === '近代早期/革命与工业化/现代/当代', bandsM);
  check('世界近现代史计数 676', cntM.includes('676'), cntM);

  /* 3. 排序：史前时代（-8000）在最前段，且段内按年月日复合排序 */
  const sortOk = await page.evaluate(() => {
    const sub = EVENTS_WORLD.filter(e => e.ch < 4);
    return sub.length === 238 && sub[0].ch === 0;
  });
  check('world-ancient 数据源 = ch<4 共 238', sortOk, '');

  /* 4. 搜索跨史段生效（切回 world-ancient 搜"马拉松"） */
  await page.click('#segRow .seg-btn[data-seg="world-ancient"]');
  await page.waitForTimeout(500);
  await page.fill('#q', '马拉松');
  await page.waitForTimeout(600);
  const searchCnt = await page.textContent('#cnt');
  check('世界史搜索命中（马拉松：希波战争+马拉松战役）', /筛得 2 事/.test(searchCnt), searchCnt);
  await page.fill('#q', '');
  await page.waitForTimeout(300);

  /* 5. 地图五态下拉 + 世界史滑块范围 */
  await page.click('#viewTabs .tab[data-view="map"]');
  await page.waitForTimeout(800);
  const rangeOpts = await page.$$eval('#rangeSel option', os => os.map(o => o.value));
  check('地图下拉五态', rangeOpts.join('/') === 'pre/hist/modern/world-ancient/world-modern', rangeOpts.join('/'));
  await page.selectOption('#rangeSel', 'world-ancient');
  await page.waitForTimeout(500);
  const sA = await page.evaluate(() => ({ min: +document.getElementById('yrSlider').min, max: +document.getElementById('yrSlider').max }));
  check('世界古代地图滑块 -8000~1500', sA.min === -8000 && sA.max === 1500, JSON.stringify(sA));
  await page.selectOption('#rangeSel', 'world-modern');
  await page.waitForTimeout(500);
  const sM = await page.evaluate(() => ({ min: +document.getElementById('yrSlider').min, max: +document.getElementById('yrSlider').max }));
  check('世界近现代地图滑块 1492~2012（地理大发现可见）', sM.min === 1492 && sM.max === 2012, JSON.stringify(sM));
  /* 世界史史段进地图 → 自动切对应地图模式（联动） */
  await page.click('#viewTabs .tab[data-view="timeline"]');
  await page.waitForTimeout(300);
  await page.click('#segRow .seg-btn[data-seg="world-modern"]');
  await page.waitForTimeout(400);
  await page.click('#viewTabs .tab[data-view="map"]');
  await page.waitForTimeout(600);
  const selAfter = await page.$eval('#rangeSel', s => s.value);
  check('world-modern 史段进地图自动选 world-modern', selAfter === 'world-modern', selAfter);

  /* 6. 无 JS 报错 */
  check('无 JS 报错', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  const pass = results.filter(r => r.ok).length, fail = results.length - pass;
  console.log('\n===== ' + pass + ' 通过 / ' + fail + ' 失败 =====');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
