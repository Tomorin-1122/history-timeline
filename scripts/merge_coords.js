// scripts/merge_coords.js — 民国/共和国坐标表并入主库 coords_resolved.json
// 1) 已有 key 保留主库值（不动已上线数据），仅补新 key
// 2) 被删 title 的 key 清理（袁世凯称帝 / 《青年杂志》创刊 → 主库无此 title）
// 3) 下册表「整风运动」key →「1957年整风运动」（1942 抗战整风的坐标在民国表，key 仍为「整风运动」）
// 用法: node scripts/merge_coords.js [--dry-run]
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const DRY = process.argv.includes('--dry-run');

const log = [];
const resolved = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'coords_resolved.json'), 'utf8'));
const minguo = JSON.parse(fs.readFileSync(path.join(ROOT, 'extract_workspace', '产物', '民国史坐标表.json'), 'utf8'));
const xiabce = JSON.parse(fs.readFileSync(path.join(ROOT, 'extract_workspace', '产物', '下册坐标表.json'), 'utf8'));

// 全库 title（含新 12 章，用于校验 key 有效性）
const src = fs.readFileSync(path.join(ROOT, 'js', 'data.js'), 'utf8');
eval(src + '\nObject.assign(global,{EVENTS,EVENTS_MODERN});');
const allTitles = new Set([...EVENTS.map(e => e.title), ...EVENTS_MODERN.map(e => e.title)]);

let added = 0, skipped = 0, removed = 0;
// 下册表 key 映射：整风运动 → 1957年整风运动（1957 整风已改名；1942 整风坐标在民国表）
const XB_MAP = { '整风运动': '1957年整风运动' };

for (const [tag, table, keyMap] of [['民国史', minguo, null], ['下册', xiabce, XB_MAP]]) {
  for (const [origTitle, coord] of Object.entries(table)) {
    const t = keyMap && keyMap[origTitle] ? keyMap[origTitle] : origTitle;
    if (!allTitles.has(t)) { log.push(`[${tag}] 清理无效 key: ${t}（主库无此事件）`); removed++; continue; }
    if (resolved[t] !== undefined) {
      if (resolved[t][0] !== coord[0] || resolved[t][1] !== coord[1]) skipped++; // 已有值保留主库
      continue;
    }
    resolved[t] = coord; added++;
  }
}
if (!DRY) fs.writeFileSync(path.join(ROOT, 'data', 'coords_resolved.json'), JSON.stringify(resolved, null, 1) + '\n', 'utf8');
console.log(log.join('\n'));
console.log(`合并完成: 新增 ${added} 条（值微差保留主库 ${skipped} 条），清理 ${removed} 条 → coords_resolved 共 ${Object.keys(resolved).length} 条`);
if (DRY) console.log('（--dry-run 预览，未写盘）');
