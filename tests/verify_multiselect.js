// verify_multiselect.js — 多选筛选 + 上下文隔离专项验收（2026-08-05 老板定案）
// 前置: node server.js 已启动（http://localhost:3099）
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
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof EVENTS !== 'undefined' && EVENTS.length > 0, { timeout: 30000 });
  await page.waitForTimeout(600);

  const cnt = async () => (await page.textContent('#cnt')).trim();
  const chipsN = async () => (await page.$$eval('#chips .chip', els => els.length));
  const onBtns = async gid => (await page.$$eval('#' + gid + ' button.f.on', els => els.map(b => b.textContent)));

  /* 1. 时间轴多选：政治 + 军事 同亮、chips 2、计数 = 并集 */
  await page.click('#filterToggle');  // 展开筛选面板
  await page.waitForTimeout(300);
  await page.click('#typeGroup button.f:text-is("政治")');
  await page.click('#typeGroup button.f:text-is("军事")');
  await page.waitForTimeout(300);
  const typesOn = await onBtns('typeGroup');
  const cntPM = await cnt();
  const expectPM = await page.evaluate(() => EVENTS.filter(e => e.type === '政治' || e.type === '军事').length);
  ok('门类多选（政治+军事同亮）', typesOn.join('/') === '政治/军事', typesOn.join('/'));
  ok('多选并集计数', cntPM.includes(String(expectPM)), cntPM + '（期望筛得 ' + expectPM + ' 事）');
  ok('chips 显示 2 项', (await chipsN()) === 2, (await chipsN()) + ' 项');

  /* 2. 等第多选：★★★ + ★★ */
  await page.click('#impGroup button.f:text-is("★★★")');
  await page.click('#impGroup button.f:text-is("★★")');
  await page.waitForTimeout(300);
  const impOn = await onBtns('impGroup');
  ok('等第多选（★★★+★★同亮）', impOn.join('/') === '★★★/★★', impOn.join('/'));
  const expectImp = await page.evaluate(() => EVENTS.filter(e => (e.type === '政治' || e.type === '军事') && (e.importance === 3 || e.importance === 2)).length);
  ok('异类叠加（门类∩等第）', (await cnt()).includes(String(expectImp)), await cnt());

  /* 3. 搜索叠加：q=起义 */
  await page.fill('#q', '起义');
  await page.waitForTimeout(300);
  const expectQ = await page.evaluate(() => EVENTS.filter(e => (e.type === '政治' || e.type === '军事') && (e.importance === 3 || e.importance === 2) && JSON.stringify(e.summary).includes('起义')).length);
  ok('三重叠加（门类∩等第∩搜索）', (await cnt()).includes(String(expectQ)), await cnt() + '（期望 ' + expectQ + '）');

  /* 4. 隔离-史段：切 modern 时间轴（应空），切回 ancient（应恢复） */
  await page.click('#segRow .seg-btn[data-seg="modern"]');
  await page.waitForTimeout(400);
  ok('切 modern 时间轴隔离（筛选空）', (await onBtns('typeGroup')).join('/') === '全部' && (await chipsN()) === 0 && (await page.$eval('#q', i => i.value)) === '', (await onBtns('typeGroup')).join('/') || '空');
  ok('modern 计数恢复全量', (await cnt()).includes('866'), await cnt());
  await page.click('#segRow .seg-btn[data-seg="ancient"]');
  await page.waitForTimeout(400);
  ok('切回 ancient 恢复筛选记忆', (await onBtns('typeGroup')).join('/') === '政治/军事' && (await page.$eval('#q', i => i.value)) === '起义', (await onBtns('typeGroup')).join('/') + ' q=' + (await page.$eval('#q', i => i.value)));

  /* 5. 隔离-视图：进地图 hist（应空），点明章过滤，切 pre 隔离，切回 hist 恢复 */
  await page.click('.tab[data-view="map"]');
  await page.waitForTimeout(1500);
  ok('地图 hist 与时间轴隔离（筛选空）', (await onBtns('typeGroup')).join('/') === '全部' && (await page.$eval('#q', i => i.value)) === '', (await onBtns('typeGroup')).join('/') || '空');
  await page.evaluate(() => { const a = document.querySelector('#perGroup a.jump[data-ch="13"]'); if (a) a.click(); });  // 明
  await page.waitForTimeout(800);
  const selHist = await page.$eval('#rangeSel', s => s.value);
  const mingOn = await page.evaluate(() => document.querySelector('#perGroup a.jump[data-ch="13"]').classList.contains('on'));
  ok('地图章多选（明章高亮 + 保持 hist）', selHist === 'hist' && mingOn, 'rangeSel=' + selHist + ' 明on=' + mingOn);
  await page.evaluate(() => { const a = document.querySelector('#perGroup a.jump[data-ch="0"]'); if (a) a.click(); });  // 原始社会章 → 自动进 pre
  await page.waitForTimeout(800);
  const selPre = await page.$eval('#rangeSel', s => s.value);
  const preOn = await page.evaluate(() => document.querySelector('#perGroup a.jump[data-ch="0"]').classList.contains('on'));
  ok('点原始社会章自动进 pre（map-pre 上下文隔离）', selPre === 'pre' && preOn, 'rangeSel=' + selPre);
  await page.selectOption('#rangeSel', 'hist');  // 下拉切回 hist → 恢复明章记忆
  await page.waitForTimeout(800);
  const mingOn2 = await page.evaluate(() => document.querySelector('#perGroup a.jump[data-ch="13"]').classList.contains('on'));
  const mingOff = await page.evaluate(() => !document.querySelector('#perGroup a.jump[data-ch="0"]').classList.contains('on'));
  ok('切回 hist 恢复明章记忆（pre 的原始社会不串扰）', mingOn2 && mingOff, '明on=' + mingOn2 + ' 原始社会on=' + !mingOff);

  /* 6. 「全部」按钮清空该组（地图上下文 q 为空 → chips 0） */
  await page.click('#typeGroup button.f:text-is("全部")');
  await page.waitForTimeout(300);
  ok('「全部」按钮清空门类组', (await onBtns('typeGroup')).join('/') === '全部' && (await chipsN()) === 0, (await chipsN()) + ' chip');

  /* 7. 返回时间轴：ancient 的时间轴筛选不受地图操作影响 */
  await page.click('.tab[data-view="timeline"]');
  await page.waitForTimeout(400);
  ok('回时间轴 ancient 筛选仍记忆（政治/军事+起义）', (await onBtns('typeGroup')).join('/') === '政治/军事' && (await page.$eval('#q', i => i.value)) === '起义', (await onBtns('typeGroup')).join('/'));

  ok('无 JS 报错', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  await browser.close();
  console.log('\n===== ' + pass + ' 通过 / ' + fail + ' 失败 =====');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
