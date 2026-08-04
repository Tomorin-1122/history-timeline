// verify_review_seg.js — 复习史段第一步 + 多选筛选 + 随机漫游范围专项验收（2026-08-05）
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
  await page.waitForTimeout(800);

  // 进复习视图
  await page.click('.tab[data-view="review"]');
  await page.waitForTimeout(800);

  // 1. 第一步史段：默认 ancient，分期 15 章 + 全部
  let perN = await page.$$eval('#rvPerBtns button.f', els => els.length);
  ok('默认史段=古代史，分期 16 项（全部+15 章）', perN === 16, perN + ' 项');
  const cntA = await page.textContent('#rvCount');
  ok('古代史计数 855', cntA.includes('855'), cntA);

  // 2. 切近代史史段 → 分期 12 项（全部+11 段）+ 计数 866
  await page.click('#rvSegBtns .rv-mode-btn[data-seg="modern"]');
  await page.waitForTimeout(300);
  perN = await page.$$eval('#rvPerBtns button.f', els => els.length);
  const cntM = await page.textContent('#rvCount');
  ok('切近代史史段 → 分期 12 项 + 计数 866', perN === 12 && cntM.includes('866'), perN + ' 项 / ' + cntM);

  // 3. 多选：门类政治+军事 → 并集计数
  await page.click('#rvTypeBtns button.f:text-is("政治")');
  await page.click('#rvTypeBtns button.f:text-is("军事")');
  await page.waitForTimeout(300);
  const typeOn = await page.$$eval('#rvTypeBtns button.f.on', els => els.map(b => b.textContent).join('/'));
  const cntPM = await page.textContent('#rvCount');
  const expPM = await page.evaluate(() => EVENTS_MODERN.filter(e => e.type === '政治' || e.type === '军事').length);
  ok('复习多选（政治+军事同亮 + 并集计数）', typeOn === '政治/军事' && cntPM.includes(String(expPM)), typeOn + ' / ' + cntPM + '（期望 ' + expPM + '）');

  // 4. 「全部」清空
  await page.click('#rvTypeBtns button.f:text-is("全部")');
  await page.waitForTimeout(300);
  ok('「全部」清空门类组', (await page.$$eval('#rvTypeBtns button.f.on', els => els.map(b => b.textContent).join('/'))) === '全部', '');

  // 5. 随机漫游：切 roam 模式 → 漫游范围出现；全随机 = 全库
  await page.click('#rvModes .rv-mode-btn[data-mode="roam"]');
  await page.waitForTimeout(300);
  const roamVisible = await page.evaluate(() => !document.getElementById('rvRoamScope').hidden);
  ok('roam 模式显示漫游范围（全随机/选史段随机）', roamVisible, '');
  const cntRoam = await page.textContent('#rvCount');
  const expAll = await page.evaluate(() => EVENTS.length + EVENTS_MODERN.length);
  ok('漫游全随机计数 = 全库 1717', cntRoam.includes(String(expAll)), cntRoam + '（期望 ' + expAll + '）');
  // 选史段随机 → 当前史段（modern 866）
  await page.click('#rvScopeBtns button.f[data-scope="seg"]');
  await page.waitForTimeout(300);
  const cntSeg = await page.textContent('#rvCount');
  ok('漫游选史段随机计数 = 近代史 866', cntSeg.includes('866'), cntSeg);
  // 切回古代史史段 + 选史段随机 → 855
  await page.click('#rvSegBtns .rv-mode-btn[data-seg="ancient"]');
  await page.waitForTimeout(300);
  const cntSegA = await page.textContent('#rvCount');
  ok('漫游选史段随机（古代史）= 855', cntSegA.includes('855'), cntSegA);

  // 6. 世界史占位 disabled
  const worldDisabled = await page.evaluate(() => { const b = document.querySelector('#rvSegBtns .rv-mode-btn[data-seg="world"]'); return b && b.disabled; });
  ok('世界史占位 disabled（规划中）', worldDisabled, '');

  // 7. 开始复习（针对训练，古代史，1 题）→ 卡片显示 + 答题写带前缀 key
  await page.click('#rvModes .rv-mode-btn[data-mode="train"]');
  await page.waitForTimeout(300);
  await page.evaluate(() => { const i = document.getElementById('rvNum'); i.value = '1'; i.dispatchEvent(new Event('input')); });
  await page.click('#rvStart');
  await page.waitForTimeout(600);
  const cardTitle = await page.textContent('#rvTitle');
  ok('开始复习出卡', !!cardTitle && cardTitle.length > 0, cardTitle.slice(0, 20));
  await page.click('#rvShow');
  await page.waitForTimeout(300);
  await page.click('#rvFail');  // 记错题
  await page.waitForTimeout(500);
  const keyOk = await page.evaluate(t => localStorage.getItem('ht-review-ancient-' + t), cardTitle.trim());
  ok('错题写入带史段前缀 key（ht-review-ancient-*）', keyOk === 'fail', keyOk);

  ok('无 JS 报错', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  await browser.close();
  console.log('\n===== ' + pass + ' 通过 / ' + fail + ' 失败 =====');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
