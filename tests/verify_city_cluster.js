// verify_city_cluster.js — 近代史重灾城市 period 分堆专项验收（2026-08-05 老板定案）
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
  await page.waitForFunction(() => typeof EVENTS_MODERN !== 'undefined' && EVENTS_MODERN.length > 0, { timeout: 30000 });
  await page.waitForTimeout(800);

  // 进 modern 地图
  await page.click('#segRow .seg-btn[data-seg="modern"]');
  await page.waitForTimeout(400);
  await page.click('.tab[data-view="map"]');
  await page.waitForTimeout(2000);

  // 三城预期分堆（复用页面 inCity 逻辑）
  const exp = await page.evaluate(() => {
    const byCity = {};
    for (const e of EVENTS_MODERN) {
      const c = COORDS[e.title]; if (!c) continue;
      const city = inCity(c); if (!city) continue;
      (byCity[city] = byCity[city] || {});
      (byCity[city][e.period] = byCity[city][e.period] || []).push(e.title);
    }
    let nPeriod = 0, total = 0;
    for (const city of Object.keys(byCity)) { nPeriod += Object.keys(byCity[city]).length; for (const p of Object.values(byCity[city])) total += p.length; }
    return { byCity, nPeriod, total };
  });
  console.log('三城近代史事件合计:', exp.total, '个 /', exp.nPeriod, '个时段子簇');

  // zoom 到北京（城市级别，z7 视野含三城）
  await page.evaluate(() => mapObj.setView([34, 110], 7));
  await page.waitForTimeout(1200);
  const clusters = await page.evaluate(() => [...document.querySelectorAll('.city-cluster')].map(d => d.textContent));
  ok('三城出现 period 子簇（数量=三城有事件时段总数）', clusters.length === exp.nPeriod, clusters.length + '（期望 ' + exp.nPeriod + '）');
  ok('子簇短标格式（40-64·N）', clusters.every(t => /^\d{2}-\d{2}·\d+$/.test(t.replace(/\n/g, ''))), clusters.slice(0, 3).join(' | '));
  const totalN = await page.evaluate(() => {
    let s = 0; document.querySelectorAll('.city-cluster').forEach(d => { const m = d.textContent.match(/·(\d+)$/); if (m) s += +m[1]; }); return s;
  });
  ok('子簇数量合计 = 三城事件总数', totalN === exp.total, totalN + '（期望 ' + exp.total + '）');

  // 点击第一个子簇 → 聚焦该时段散点 + 恢复按钮
  await page.evaluate(() => { const d = document.querySelector('.city-cluster'); d && d.click(); });
  await page.waitForTimeout(1200);
  const focusState = await page.evaluate(() => ({ focus: cityPeriodFocus, back: !!document.querySelector('.city-back'), circles: document.querySelectorAll('.leaflet-overlay-pane path, .leaflet-overlay-pane circle').length }));
  ok('点击子簇 → cityPeriodFocus 设置', !!focusState.focus && !!focusState.focus.city && !!focusState.focus.period, JSON.stringify(focusState.focus));
  ok('聚焦态出现「× 全部时段」恢复按钮', focusState.back, '');
  const focusTitles = exp.byCity[focusState.focus.city] ? (exp.byCity[focusState.focus.city][focusState.focus.period] || []) : [];
  const visN = await page.evaluate(() => { const b = mapObj.getBounds(); let n = 0; plainMarkers.eachLayer(m => { if (m.getLatLng && b.contains(m.getLatLng())) n++; }); return n; });
  ok('聚焦时段散点显示（视野内 marker 含该时段事件）', focusTitles.length > 0 && visN >= focusTitles.length, focusState.focus.city + '·' + focusState.focus.period + ' 视野内=' + visN + '（聚焦期=' + focusTitles.length + '）');
  const otherP = Object.keys(exp.byCity[focusState.focus.city] || {}).find(p => p !== focusState.focus.period);
  if (otherP) {
    const otherN = exp.byCity[focusState.focus.city][otherP].length;
    ok('聚焦态视野内 marker 远小于全量（其他时段隐藏）', visN < otherN + focusTitles.length, '视野内=' + visN + '（若未隐藏北京全量将 ' + (otherN + focusTitles.length) + '+）');
  }

  // 点恢复按钮 → 子簇恢复
  await page.evaluate(() => { const b = document.querySelector('.city-back'); b && b.click(); });
  await page.waitForTimeout(1000);
  const afterBack = await page.evaluate(() => ({ focus: cityPeriodFocus, clusters: document.querySelectorAll('.city-cluster').length }));
  ok('点恢复按钮 → 聚焦清空 + 子簇恢复', afterBack.focus === null && afterBack.clusters === exp.nPeriod, 'focus=' + afterBack.focus + ' clusters=' + afterBack.clusters);

  // 低 zoom → 退回普通聚簇（无 city-cluster）
  await page.evaluate(() => mapObj.setZoom(4));
  await page.waitForTimeout(1000);
  const lowZoom = await page.evaluate(() => document.querySelectorAll('.city-cluster').length);
  ok('低 zoom（<6）无分堆子簇', lowZoom === 0, 'city-cluster=' + lowZoom);

  ok('无 JS 报错', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  await browser.close();
  console.log('\n===== ' + pass + ' 通过 / ' + fail + ' 失败 =====');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
