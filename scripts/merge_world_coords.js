// scripts/merge_world_coords.js — 世界史坐标表并入主库 coords_resolved.json
// 1) 已有 key 保留主库值（不动已上线数据），仅补新 key
// 2) 无效 key（主库无此 title）清理
// 用法: node scripts/merge_world_coords.js [--dry-run]
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const DRY = process.argv.includes('--dry-run');

const log = [];
const resolved = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'coords_resolved.json'), 'utf8'));
const world = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', '世界史坐标表.json'), 'utf8'));

// 全库 title（含世界史，用于校验 key 有效性）
const src = fs.readFileSync(path.join(ROOT, 'js', 'data.js'), 'utf8');
eval(src + '\nObject.assign(global,{EVENTS,EVENTS_MODERN,EVENTS_WORLD});');
const allTitles = new Set([...EVENTS.map(e => e.title), ...EVENTS_MODERN.map(e => e.title), ...EVENTS_WORLD.map(e => e.title)]);

let added = 0, skipped = 0, removed = 0;
for (const [title, coord] of Object.entries(world)) {
  if (!allTitles.has(title)) { log.push(`清理无效 key: ${title}（主库无此事件）`); removed++; continue; }
  if (resolved[title] !== undefined) {
    if (resolved[title][0] !== coord[0] || resolved[title][1] !== coord[1]) skipped++; // 已有值保留主库
    continue;
  }
  resolved[title] = coord; added++;
}
if (!DRY) fs.writeFileSync(path.join(ROOT, 'data', 'coords_resolved.json'), JSON.stringify(resolved, null, 1) + '\n', 'utf8');
console.log(log.join('\n'));
console.log(`合并完成: 新增 ${added} 条（值微差保留主库 ${skipped} 条），清理 ${removed} 条 → coords_resolved 共 ${Object.keys(resolved).length} 条`);
if (DRY) console.log('（--dry-run 预览，未写盘）');
