// audit_years.js — 年份数据质量审计（重点：上万史前年份、era/approx/range 合理性）
// 用法: node scripts/audit_years.js   （读 js/data.js）
'use strict';
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');
eval(src + '\n' + `
// 1. 上万年份事件（史前"距今X万年"）
const big = EVENTS.filter(e => (e.year != null && Math.abs(e.year) >= 10000) || (e.yearRange && Math.abs(e.yearRange[0]) >= 10000));
console.log('=== |year|>=10000 的事件（' + big.length + ' 条）===');
big.forEach(e => {
  const v = e.yearMode === 'range' ? '[' + e.yearRange + ']' : (e.year != null ? e.year : 'null');
  console.log('  ' + e.title + '  ' + e.yearMode + '  ' + v + '  | era="' + (e.era || '') + '" eraSub="' + (e.eraSub || '') + '"');
});

// 2. 按章统计年份模式分布
console.log('\\n=== 按章 yearMode 分布 ===');
const per = {};
EVENTS.forEach(e => { (per[e.ch] = per[e.ch] || {}); per[e.ch][e.yearMode] = (per[e.ch][e.yearMode] || 0) + 1; });
Object.keys(per).sort((a,b)=>a-b).forEach(ch => {
  const c = CHAPTERS[ch];
  console.log('  ' + c.no + ' ' + c.name + ': ' + Object.entries(per[ch]).map(([k,v])=>k+'='+v).join(' '));
});

// 3. era 事件（year 应为 null；era/eraSub 缺失清单）
console.log('\\n=== era 事件缺 era/eraSub（' + EVENTS.filter(e=>e.yearMode==='era'&&!e.era).length + ' 条）===');
EVENTS.filter(e => e.yearMode === 'era' && !e.era).forEach(e => console.log('  ' + e.title));

// 4. 朝代年份合理性粗查：period 与 year 负正号
console.log('\\n=== 公元后正年份事件（' + EVENTS.filter(e=>e.year!=null&&e.year>0).length + ' 条）===');
EVENTS.filter(e => e.year != null && e.year > 0).forEach(e => console.log('  ' + e.title + ' ' + e.year + ' (' + e.period + '/' + e.dynasty + ')'));
`);
