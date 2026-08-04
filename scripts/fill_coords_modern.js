// scripts/fill_coords_modern.js — 按坐标补全清单反查坐标，补进 coords_modern.json
// 逻辑：清单每行「今XX键 | 代表事件 | location」→ 在 coords_resolved 按代表事件 title 查坐标
//   命中 → 今XX键 + 坐标写入 coords_modern（键已存在且值不同 → 记日志保留原值）
//   未命中 → 输出待核验清单（留老板核验）
// 用法: node scripts/fill_coords_modern.js [--dry-run]
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const DRY = process.argv.includes('--dry-run');

const modern = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'coords_modern.json'), 'utf8'));
const resolved = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'coords_resolved.json'), 'utf8'));
const listMd = fs.readFileSync(path.join(ROOT, 'extract_workspace', '产物', '坐标补全清单.md'), 'utf8');

// 解析清单表格行：| 今XX | 代表事件 | location |（注意 Windows 行尾 \r，勿用 $ 锚点）
const rows = [];
for (const line of listMd.split('\n')) {
  const m = line.match(/^\|\s*(今[^|]+?)\s*\|\s*([^|]+?)\s*\|\s*(.*)/);
  if (m) rows.push({ key: m[1].trim(), event: m[2].trim(), loc: m[3].replace(/\|?\s*\r?$/, '').trim() });
}

const log = [];
let hit = 0, miss = 0, exists = 0;
const missList = [];
for (const r of rows) {
  let coord = resolved[r.event];
  // 未精确命中 → 模糊匹配（title 包含代表事件词，去掉标点）
  if (!coord) {
    const kw = r.event.replace(/[《》〈〉「」『』·]/g, '');
    const found = Object.entries(resolved).find(([t]) => t.includes(kw));
    if (found) coord = found[1];
  }
  if (!coord) { miss++; missList.push(r); continue; }
  if (modern[r.key] !== undefined) {
    if (modern[r.key][0] !== coord[0] || modern[r.key][1] !== coord[1]) log.push(`[已有不同] ${r.key}: 原(${modern[r.key]}) vs 反查(${coord})，保留原值`);
    exists++; continue;
  }
  modern[r.key] = coord; hit++;
}
if (!DRY) fs.writeFileSync(path.join(ROOT, 'data', 'coords_modern.json'), JSON.stringify(modern, null, 1) + '\n', 'utf8');

console.log(log.join('\n'));
console.log(`反查结果: 命中补键 ${hit} 条，已有 ${exists} 条，未命中 ${miss} 条（共 ${rows.length} 条今址键）`);
if (missList.length) {
  console.log(`\n=== 待核验清单（${missList.length} 条，坐标未反查到，需人工核实） ===`);
  missList.forEach(r => console.log(`  ${r.key} | ${r.event} | ${r.loc}`));
}
if (DRY) console.log('\n（--dry-run 预览，未写盘）');
