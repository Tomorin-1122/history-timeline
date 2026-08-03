// 生成"未入地图事件核验报告" Markdown（供老板手动核验）
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');
const events = JSON.parse(src.match(/const EVENTS=(\[.*?\]);\s*\n\nconst CHAPTERS/s)[1]);
const coords = JSON.parse(src.match(/const COORDS=(\{.*?\});\s*$/s)[1]);
const chs = ['原始社会','夏商','西周','春秋','战国','秦','西汉','东汉','三国两晋南北朝','隋','唐','五代宋辽夏金','元','明','清'];

function catOf(e) {
  const loc = e.location || '';
  if (!loc.trim()) return ['A', '无 location（制度/思想/著作/政策类）', '✅ 合理留空（本无地点）'];
  if (/^[国界区]/.test(loc)) return ['B', '区域性开头', '✅ 合理留空'];
  const t = String(loc).match(/（(.+?)）/);
  if (!t) return ['C', '无括号今址（"全国"等）', '✅ 合理留空（全国性政策）'];
  return ['D', '多地点/大区域', '⚠️ 视情况：有代表点可补，否则留空'];
}
const CAT_INFO = {
  A: '无 location：制度/思想/著作/政策类，本无单一地点，地图外通过列表/复习模式查看。建议保持现状。',
  B: '区域性 location（以"国/界/区"开头）。建议保持现状。',
  C: 'location 无括号今址（如"全国"），多为全国性政策。建议保持现状。',
  D: '多地点或大区域（含"今XXX"括号）。此类可分两种：有明确代表点的可取代表点补坐标（如靖难之役→南京）；纯大区域（如"今河北、山西北部"）留空。**请老板逐条核验，标注"可补"或"留空"。**',
};

const noC = events.filter(e => !coords[e.title]);
const lines = [];
lines.push('# 未入地图事件核验报告');
lines.push('');
lines.push('> 生成时间：2026-08-03｜全库 851 条，有坐标 589 条（上地图），**无坐标 262 条**（本报告全部列出）');
lines.push('');
lines.push('## 一、分类统计');
lines.push('');
const byCat = {};
for (const e of noC) { const [k] = catOf(e); byCat[k] = (byCat[k] || 0) + 1; }
for (const [k, n] of Object.entries(byCat)) {
  lines.push(`- **${k} 类（${n} 条）**：${CAT_INFO[k].split('。')[0]}`);
}
lines.push('');
lines.push('### 各类核验建议');
for (const k of ['A','B','C','D']) { lines.push(`- **${k}**：${CAT_INFO[k]}`); }
lines.push('');
lines.push('## 二、逐条清单（按章）');
lines.push('');
for (let ci = 0; ci < chs.length; ci++) {
  const arr = noC.filter(e => e.ch === ci);
  if (!arr.length) continue;
  lines.push(`### ${chs[ci]}（${arr.length} 条）`);
  lines.push('');
  lines.push('| # | 事件 | location | 类别 | 核验意见（老板填） |');
  lines.push('|---|------|---------|:---:|------|');
  arr.forEach((e, i) => {
    const [k, name] = catOf(e);
    const loc = e.location || '—';
    lines.push(`| ${i + 1} | ${e.title} | ${loc} | ${k} | |`);
  });
  lines.push('');
}
lines.push('## 三、核验后处理');
lines.push('');
lines.push('老板逐条标注后：');
lines.push('1. 标注"可补"的（主要 D 类有代表点的）→ 我补 coords_resolved 坐标并跑校验');
lines.push('2. 标注"留空"的 → 维持现状');
lines.push('3. 意见填写在表格"核验意见"列，或直接在回复里给条目清单');
fs.writeFileSync(path.join(__dirname, '..', 'docs', '未入地图事件核验报告_20260803.md'), lines.join('\n'), 'utf8');
console.log('报告已生成: docs/未入地图事件核验报告_20260803.md (' + lines.length + ' 行, ' + noC.length + ' 条)');
