// verify_sort_rules.js — 近代史排序规则验收（2026-08-04）
// ① 同月有 day 按日期先后 ② 无 day 的同月事件排该月开头 ③ 无 month 的同年事件排该年开头；古代史不动
'use strict';
const { chromium } = require('playwright');
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('✅', name, extra ? '— ' + extra : ''); }
  else { fail++; console.log('❌', name, extra ? '— ' + extra : ''); }
}
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:3099/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof EVENTS !== 'undefined' && EVENTS.length > 0, { timeout: 30000 });
  await page.click('#segRow .seg-btn[data-seg="modern"]');
  await page.waitForTimeout(600);

  const rows = await page.$$eval('#main .row', els =>
    els.filter(e => e.querySelector('.year') && !e.textContent.includes('数据待生成'))
       .map(r => ({ y: r.querySelector('.year').textContent.trim(), t: r.querySelector('h3').textContent })));

  const idx = t => rows.findIndex(r => r.t === t);
  const before = (a, b) => { const i = idx(a), j = idx(b); return i >= 0 && j >= 0 && i < j; };

  // 规则①：同月有 day 按日期先后（台南陷落 10-21 在 嘉义/曾文溪 之后）
  ok('同月有day按日期（台南陷落后于嘉义/曾文溪）',
    before('嘉义之战', '台南陷落') && before('曾文溪之战', '台南陷落'),
    '嘉义(' + idx('嘉义之战') + ') < 台南(' + idx('台南陷落') + ')');
  // 规则②：无 day 同月排该月开头（1841年1月：大角沙角无day 先于 英军强占香港 1-26）
  ok('无day同月排月首（大角沙角先于英军占港）', before('大角沙角之战', '英军强占香港'),
    '大角沙角(' + idx('大角沙角之战') + ') < 英军占港(' + idx('英军强占香港') + ')');
  // 规则③：无 month 同年排年首（1895 戊戌变法运动 先于 马关条约 4-17）
  ok('无month同年排年首（戊戌变法运动先于马关条约）', before('戊戌变法运动', '《马关条约》签订'),
    '戊戌变法(' + idx('戊戌变法运动') + ') < 马关(' + idx('《马关条约》签订') + ')');
  // 规则③b：1895 无月 台湾军民抗日斗争 也排 4 月前
  ok('1895无月事件排年首（台湾抗日先于马关）', before('台湾军民抗日斗争', '《马关条约》签订'),
    '台湾抗日(' + idx('台湾军民抗日斗争') + ') < 马关(' + idx('《马关条约》签订') + ')');

  // 古代史不动：切回 ancient，确认 15 bands/851 及月显示未变
  await page.click('#segRow .seg-btn[data-seg="ancient"]');
  await page.waitForTimeout(600);
  const bandsA = await page.$$eval('#main .band', els => els.length);
  const cntA = await page.textContent('#cnt');
  const chen = await page.$$eval('#main .row', els => els.map(r => ({
    y: r.querySelector('.year') ? r.querySelector('.year').textContent.trim() : '',
    t: r.querySelector('h3') ? r.querySelector('h3').textContent : ''
  })).find(x => x.t.includes('陈胜吴广起义')));
  ok('古代史 15 bands / 851', bandsA === 15 && cntA.includes('851'), bandsA + ' / ' + cntA.trim());
  ok('古代史月显示未变（前 209年7月）', chen && chen.y === '前 209年7月', JSON.stringify(chen));

  ok('无 JS 报错', errs.length === 0, errs.slice(0, 2).join(' | '));
  await browser.close();
  console.log(`\n===== ${pass} 通过 / ${fail} 失败 =====`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
