// check_years.js — 年份交叉核对（LLM 提取的 year vs 教材原文上下文年份）
// 用法: node scripts/check_years.js <pilot.json> <教材.md> [更多教材.md]
// 输出: 每条有年份事件 → 教材中事件名附近的年份表述，供人工比对（教材口径优先）
'use strict';
const fs = require('fs');

const pilotFile = process.argv[2];
if (!pilotFile) { console.error('用法: node scripts/check_years.js <pilot.json> <教材.md> [...]'); process.exit(1); }
const mdFiles = process.argv.slice(3);
if (!mdFiles.length) { console.error('缺少教材文件'); process.exit(1); }

const pilot = JSON.parse(fs.readFileSync(pilotFile, 'utf8'));
const joined = mdFiles.map(f => fs.readFileSync(f, 'utf8')).join('\n');

// 教材年份表述：前X年 / 公元前X年 / 约前X年 / X年
const yrRe = /(约?\s*(?:公元前|前))?\s*(\d{1,7})\s*年/g;

let n = 0;
for (const e of pilot) {
  if (e.yearMode === 'era') continue; // era 无具体年份，跳过
  const key = e.title.slice(0, 6);    // 事件名前 6 字在教材中定位
  const idx = joined.indexOf(key);
  if (idx < 0) { console.log(`[未找到] ${e.title}`); continue; }
  const ctx = joined.slice(Math.max(0, idx - 30), idx + 120);
  const years = [];
  let m;
  while ((m = yrRe.exec(ctx)) && years.length < 5) {
    years.push((m[1] ? m[1].trim() : '') + m[2] + '年');
  }
  const dataYear = e.yearMode === 'range'
    ? `[${e.yearRange[0]}~${e.yearRange[1]}]`
    : (e.yearMode === 'approx' ? `约${e.year}` : `${e.year}`);
  console.log(`${e.title}\t数据: ${dataYear}\t教材上下文: ${years.join(' ') || '(无年份)'}`);
  n++;
}
console.log('----');
console.log(`核对 ${n} 条有年份事件（era 跳过）`);
