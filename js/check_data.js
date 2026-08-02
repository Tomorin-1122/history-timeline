// check_data.js — data.js 数据质量关卡（F2 回归资产，勿删）
// 用法: node js/check_data.js   退出码 0=通过 1=失败
'use strict';
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'data.js'), 'utf8');
const CHECK = `
const errs = [];
const titles = new Set(EVENTS.map(e => e.title));
const seen = new Set();
for (const e of EVENTS) {
  if (seen.has(e.title)) errs.push('重复 title: ' + e.title);
  seen.add(e.title);
  if (!['exact','approx','era','range'].includes(e.yearMode)) errs.push('bad yearMode: ' + e.title);
  if (e.yearMode === 'era' && e.year !== null) errs.push('era year!=null: ' + e.title);
  if ((e.yearMode === 'exact' || e.yearMode === 'approx') && typeof e.year !== 'number') errs.push('exact/approx year not int: ' + e.title);
  if (e.yearMode === 'range' && !Array.isArray(e.yearRange)) errs.push('range no yearRange: ' + e.title);
  if (e.ch === undefined || e.ch < 0 || e.ch >= CHAPTERS.length) errs.push('bad ch: ' + e.title);
  for (const r of e.related || []) { if (!titles.has(r)) errs.push('悬空 related: ' + e.title + ' -> ' + r); }
}
for (const t of Object.keys(COORDS)) {
  const c = COORDS[t];
  if (!Array.isArray(c) || c.length !== 2 || typeof c[0] !== 'number' || typeof c[1] !== 'number') errs.push('bad coords: ' + t);
  if (!titles.has(t)) errs.push('coords 指向不存在事件: ' + t);
}
const cov = [...new Set(EVENTS.map(e => e.ch))].sort((a,b)=>a-b).map(c => CHAPTERS[c].name);
const ys = [];
EVENTS.forEach(e => {
  if ((e.yearMode === 'exact' || e.yearMode === 'approx') && e.year != null) ys.push(e.year);
  if (e.yearMode === 'range' && e.yearRange) ys.push(e.yearRange[0], e.yearRange[1]);
});
console.log('EVENTS:', EVENTS.length);
console.log('章覆盖:', cov.join(' / '));
console.log('年份范围:', Math.min(...ys), '~', Math.max(...ys));
console.log('COORDS:', Object.keys(COORDS).length);
if (errs.length) { console.log('ERRORS:'); errs.forEach(x => console.log(' -', x)); process.exit(1); }
console.log('数据关卡: PASS');
`;

eval(src + '\n' + CHECK);
