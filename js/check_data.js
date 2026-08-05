// check_data.js — data.js 数据质量关卡（F2 回归资产，勿删）
// 用法: node js/check_data.js   退出码 0=通过 1=失败
'use strict';
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'data.js'), 'utf8');
const CHECK = `
const errs = [];
const warns = [];
const allTitles = new Set([...EVENTS.map(e => e.title), ...EVENTS_MODERN.map(e => e.title), ...EVENTS_WORLD.map(e => e.title)]);
const seen = new Set();
for (const e of EVENTS) {
  if (seen.has(e.title)) errs.push('重复 title(古代史): ' + e.title);
  seen.add(e.title);
  if (!['exact','approx','era','range'].includes(e.yearMode)) errs.push('bad yearMode: ' + e.title);
  if (e.yearMode === 'era' && e.year !== null) errs.push('era year!=null: ' + e.title);
  if (e.yearMode === 'era' && !e.era) warns.push('era 缺 era/eraSub（Q4 待回填）: ' + e.title);
  if ((e.yearMode === 'exact' || e.yearMode === 'approx') && typeof e.year !== 'number') errs.push('exact/approx year not int: ' + e.title);
  if (e.yearMode === 'range' && !Array.isArray(e.yearRange)) errs.push('range no yearRange: ' + e.title);
  if (e.month != null && (e.month < 1 || e.month > 12 || !Number.isInteger(e.month))) errs.push('bad month: ' + e.title + ' (' + e.month + ')');
  if (e.ch === undefined || e.ch < 0 || e.ch >= CHAPTERS.length) errs.push('bad ch: ' + e.title);
  for (const r of e.related || []) { if (!allTitles.has(r)) errs.push('悬空 related: ' + e.title + ' -> ' + r); }
}
/* 近现代史：year 必须可落座、ch 0-10、period 与段名一致、month/day 合法、related/坐标跨库检查 */
const seenM = new Set();
for (const e of EVENTS_MODERN) {
  if (seenM.has(e.title)) errs.push('重复 title(近代史): ' + e.title);
  seenM.add(e.title);
  if (typeof e.year !== 'number') errs.push('近代史缺 year(不可落座): ' + e.title);
  if (e.ch === undefined || e.ch < 0 || e.ch >= CHAPTERS_MODERN.length) errs.push('bad ch(近代史): ' + e.title);
  if (e.period !== CHAPTERS_MODERN[e.ch].name) errs.push('period 与段名不一致: ' + e.title + ' (' + e.period + ' vs ' + CHAPTERS_MODERN[e.ch].name + ')');
  if (e.month != null && (e.month < 1 || e.month > 12 || !Number.isInteger(e.month))) errs.push('bad month(近代史): ' + e.title + ' (' + e.month + ')');
  if (e.day != null && (e.day < 1 || e.day > 31 || !Number.isInteger(e.day))) errs.push('bad day(近代史): ' + e.title + ' (' + e.day + ')');
  for (const r of e.related || []) { if (!allTitles.has(r)) errs.push('悬空 related(近代史): ' + e.title + ' -> ' + r); }
}
/* 世界史：year 可落座、ch 0-7、period 与段名一致、month/day 合法、related/坐标跨库检查 */
const seenW = new Set();
for (const e of EVENTS_WORLD) {
  if (seenW.has(e.title)) errs.push('重复 title(世界史): ' + e.title);
  seenW.add(e.title);
  if (e.ch === undefined || e.ch < 0 || e.ch >= CHAPTERS_WORLD.length) errs.push('bad ch(世界史): ' + e.title + ' (' + e.ch + ')');
  if (e.period !== CHAPTERS_WORLD[e.ch].name) errs.push('period 与段名不一致(世界史): ' + e.title + ' (' + e.period + ' vs ' + CHAPTERS_WORLD[e.ch].name + ')');
  if (e.month != null && (e.month < 1 || e.month > 12 || !Number.isInteger(e.month))) errs.push('bad month(世界史): ' + e.title + ' (' + e.month + ')');
  if (e.day != null && (e.day < 1 || e.day > 31 || !Number.isInteger(e.day))) errs.push('bad day(世界史): ' + e.title + ' (' + e.day + ')');
  for (const r of e.related || []) { if (!allTitles.has(r)) errs.push('悬空 related(世界史): ' + e.title + ' -> ' + r); }
}
for (const t of Object.keys(COORDS)) {
  const c = COORDS[t];
  if (!Array.isArray(c) || c.length !== 2 || typeof c[0] !== 'number' || typeof c[1] !== 'number') errs.push('bad coords: ' + t);
  if (!allTitles.has(t)) errs.push('coords 指向不存在事件: ' + t);
}
const cov = [...new Set(EVENTS.map(e => e.ch))].sort((a,b)=>a-b).map(c => CHAPTERS[c].name);
const covM = [...new Set(EVENTS_MODERN.map(e => e.ch))].sort((a,b)=>a-b).map(c => CHAPTERS_MODERN[c].name);
const covW = [...new Set(EVENTS_WORLD.map(e => e.ch))].sort((a,b)=>a-b).map(c => CHAPTERS_WORLD[c].name);
const ys = [];
EVENTS.forEach(e => {
  if ((e.yearMode === 'exact' || e.yearMode === 'approx') && e.year != null) ys.push(e.year);
  if (e.yearMode === 'range' && e.yearRange) ys.push(e.yearRange[0], e.yearRange[1]);
});
const ysM = EVENTS_MODERN.map(e => e.year);
console.log('EVENTS:', EVENTS.length);
console.log('EVENTS_MODERN:', EVENTS_MODERN.length);
console.log('EVENTS_WORLD:', EVENTS_WORLD.length);
console.log('章覆盖:', cov.join(' / '));
console.log('近现代分段:', covM.join(' / '));
console.log('世界史分段:', covW.join(' / '));
console.log('年份范围:', Math.min(...ys), '~', Math.max(...ys), '（近代史', Math.min(...ysM), '~', Math.max(...ysM), '）');
console.log('COORDS:', Object.keys(COORDS).length);
if (warns.length) { console.log('WARN (' + warns.length + ' 条，待复核 Q4）:'); warns.slice(0, 10).forEach(x => console.log('  -', x)); }
if (errs.length) { console.log('ERRORS:'); errs.forEach(x => console.log(' -', x)); process.exit(1); }
console.log('数据关卡: PASS');
`;

eval(src + '\n' + CHECK);
