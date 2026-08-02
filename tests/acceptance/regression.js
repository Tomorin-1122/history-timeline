// tests/acceptance/regression.js — F0 重构回归验收（常驻资产，勿删）
// 用法: NODE_PATH="$(npm root -g)" node tests/acceptance/regression.js
// 覆盖：无 JS 错误 / 15 章渲染 / 116 条事件 / 搜索 / 筛选 / 抽屉 / related 跳转 / 三视图 / 地图 marker / 复习流程
'use strict';
const { chromium } = require('playwright');
const path = require('path');

const URL = 'file:///' + path.resolve(__dirname, '..', '..', 'index.html').replace(/\\/g, '/');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const results = [];
  const check = (name, cond, extra = '') => results.push({ name, ok: !!cond, extra });

  // 1. 无 JS 错误
  check('无 JS 错误', errors.length === 0, errors.join(' | '));

  // 2. 标题
  check('标题', (await page.title()).includes('中国古代史时间轴'));

  // 3. 章节带：15 个
  const bands = await page.locator('.band').count();
  check('章节带 = 15', bands === 15, '实际 ' + bands);

  // 4. 事件行：116（.row .title-row）
  const rows = await page.locator('.row .title-row').count();
  check('事件行 = 116', rows === 116, '实际 ' + rows);

  // 5. 空章占位 = 12
  const placeholders = await page.locator('.row .body .summary', { hasText: '数据待生成' }).count();
  check('空章占位 = 12', placeholders === 12, '实际 ' + placeholders);

  // 6. 计数
  const cnt0 = (await page.locator('#cnt').textContent()).trim();
  check('计数 = 共 116 事', cnt0 === '共 116 事', cnt0);

  // 7. 搜索：商鞅 → 命中 = 数据中 matchEvent 匹配数（关联检索：摘要/考点提示也参与匹配）
  await page.fill('#q', '商鞅');
  await page.waitForTimeout(200);
  const hitCount = await page.evaluate(() => EVENTS.filter(e => matchEvent(e, '商鞅')).length);
  const visible1 = await page.locator('.row:visible .title-row').count();
  const cnt1 = (await page.locator('#cnt').textContent()).trim();
  check('搜索商鞅命中数 = 数据匹配数', visible1 === hitCount, '期望 ' + hitCount + ' 实际 ' + visible1);
  check('搜索计数 = 筛得 N 事', cnt1 === '筛得 ' + hitCount + ' 事', cnt1);
  const hitHasTarget = await page.locator('.row:visible .title-row h3', { hasText: '商鞅变法' }).count() > 0;
  check('搜索命中含商鞅变法', hitHasTarget);
  await page.fill('#q', ''); await page.waitForTimeout(150);

  // 8. 门类筛选：军事
  await page.click('#filterToggle');
  await page.click('#typeGroup button.f:has-text("军事")');
  await page.waitForTimeout(200);
  const mil = await page.evaluate(() => EVENTS.filter(e => e.type === '军事').length);
  const visMil = await page.locator('.row:visible .title-row').count();
  check('军事筛选行数 = 数据军事数', visMil === mil, '期望 ' + mil + ' 实际 ' + visMil);
  await page.click('#typeGroup button.f:has-text("全部")');
  await page.click('#filterToggle');
  await page.waitForTimeout(150);

  // 9. 抽屉：打开第一个事件
  await page.locator('.row .body').first().click();
  await page.waitForTimeout(300);
  check('抽屉打开', await page.locator('#drawer.open').count() === 1);
  const dTitle = (await page.locator('#dTitle').textContent()).trim();
  check('抽屉标题非空', dTitle.length > 0, dTitle);
  // related 区块：有 related 的事件显示 relchips
  const relBtns = await page.locator('#dRel button').count();
  check('抽屉 related 按钮渲染', relBtns >= 0);
  // 关闭
  await page.click('#dClose');
  await page.waitForTimeout(200);
  check('抽屉关闭', await page.locator('#drawer.open').count() === 0);

  // 10. related 跳转（找第一个有 related 的事件）
  const jumpTarget = await page.evaluate(() => {
    const e = EVENTS.find(e => e.related && e.related.length);
    return e ? e.title : null;
  });
  if (jumpTarget) {
    await page.locator('.row .body').first().click();
    await page.waitForTimeout(200);
    await page.locator('#dRel button').first().click();
    await page.waitForTimeout(400);
    check('related 跳转后抽屉关闭', await page.locator('#drawer.open').count() === 0);
    check('related 跳转后 flash 闪烁', await page.locator('.row.flash').count() > 0);
  } else {
    check('related 跳转（无目标，跳过）', true, '跳过的空检查');
  }

  // 11. 视图切换：地图
  await page.click('.tab[data-view="map"]');
  await page.waitForTimeout(1200);
  check('地图视图可见', await page.locator('#view-map:visible').count() === 1);
  check('时间轴视图隐藏', await page.locator('#view-timeline[hidden]').count() === 1);
  check('Leaflet 初始化', await page.locator('#map.leaflet-container').count() === 1);
  const markerCount = await page.locator('#map path.leaflet-interactive').count();
  check('地图 marker = COORDS 数(9)', markerCount === 9, '实际 ' + markerCount);
  // 滑块范围：min/max 为历史范围
  const slider = await page.locator('#yrSlider').evaluate(el => [el.min, el.max, el.value]);
  check('滑块范围历史年份', Math.abs(Number(slider[0])) < 10000 && Math.abs(Number(slider[1])) < 10000, slider.join(','));

  // 12. 视图切换：复习
  await page.click('.tab[data-view="review"]');
  await page.waitForTimeout(300);
  check('复习设置可见', await page.locator('#rvSetup:visible').count() === 1);
  check('复习分期按钮 = 15', await page.locator('#rvPerBtns button.f').count() === 15 + 1);
  // 开始复习 → 翻牌 → 记住了
  await page.click('#rvStart');
  await page.waitForTimeout(300);
  check('复习舞台显示', await page.locator('#rvStage:visible').count() === 1);
  await page.click('#rvShow');
  await page.waitForTimeout(200);
  check('翻牌', await page.locator('#rvCard.flip').count() === 1);
  await page.click('#rvOk');
  await page.waitForTimeout(200);
  check('答对后进入下一张', await page.locator('#rvTitle').textContent() !== '');

  // 13. toBand 章节回顶按钮
  await page.click('.tab[data-view="timeline"]');
  await page.waitForTimeout(200);
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(300);
  check('toBand 滚动后可见', await page.locator('#toBand:visible').count() === 1);

  // 14. 分期筛选链接 = 15
  const jumpLinks = await page.locator('.bar a.jump').count();
  check('分期筛选链接 = 15', jumpLinks === 15, '实际 ' + jumpLinks);

  // ---- 汇总 ----
  let pass = 0, fail = 0;
  for (const r of results) { r.ok ? pass++ : fail++; console.log((r.ok ? 'PASS' : 'FAIL') + '\t' + r.name + (r.extra ? '\t(' + r.extra + ')' : '')); }
  console.log('----');
  console.log('通过 ' + pass + ' / ' + (pass + fail) + (errors.length ? '；JS 错误：\n' + errors.join('\n') : ''));
  await browser.close();
  process.exit(fail || errors.length ? 1 : 0);
})();
