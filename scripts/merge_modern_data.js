// scripts/merge_modern_data.js — 民国/共和国数据并入主库前的数据修正（一次性迁移）
// 1) 删除与主库重复的 10 条（8 同名 + 2 异名，老板定案保留主库版）
// 2) 1957 整风运动改名「1957年整风运动」（1942 抗战整风保持「整风运动」，老板定案）
// 3) related 重定向：蔡元培就任北京大学校长 的《青年杂志》创刊 → 青年杂志创刊；
//    《关于正确处理人民内部矛盾的问题》发表 / 反右派斗争 的 整风运动 → 1957年整风运动
// 用法: node scripts/merge_modern_data.js [--dry-run]
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const DRY = process.argv.includes('--dry-run');

// 删除清单（民国第01章，保留主库版）
const DEL_TITLES = new Set([
  '二次革命', '二十一条', '新文化运动', '文学革命', '张勋复辟', '护法运动',
  '新民学会成立', '少年中国学会成立',   // 8 同名重复
  '袁世凯称帝', '《青年杂志》创刊',      // 2 异名重复（老板定案保留主库版）
]);

// 改名：共和02章 整风运动 → 1957年整风运动
const RENAME = { '整风运动': '1957年整风运动' };
// related 重定向（旧 → 新），逐条替换
const RELATED_FIX = {
  '《青年杂志》创刊': '青年杂志创刊',   // 蔡元培就任北京大学校长
  '整风运动': '1957年整风运动',         // 仅共和02章内指向 1957 整风的条目（按文件限定）
};

const log = [];
function report(tag, msg) { log.push(`[${tag}] ${msg}`); }

// ---- 民国第01章：删除 ----
{
  const f = path.join(ROOT, 'data', '民国第01章.json');
  const data = JSON.parse(fs.readFileSync(f, 'utf8'));
  const before = data.length;
  const del = data.filter(e => DEL_TITLES.has(e.title));
  const keep = data.filter(e => !DEL_TITLES.has(e.title));
  del.forEach(e => report('删', `${e.title}（民国第01章）`));
  // related 重定向（蔡元培就任北京大学校长）
  keep.forEach(e => {
    const beforeR = JSON.stringify(e.related);
    e.related = (e.related || []).map(r => RELATED_FIX[r] || r);
    if (JSON.stringify(e.related) !== beforeR) report('related改', `${e.title}: 引用重定向`);
  });
  if (!DRY) fs.writeFileSync(f, JSON.stringify(keep, null, 1) + '\n', 'utf8');
  report('结果', `民国第01章 ${before} → ${keep.length} 条`);
}

// ---- 共和02章：整风运动改名 + related 重定向 ----
{
  const f = path.join(ROOT, 'data', '下册第02章.json');
  const data = JSON.parse(fs.readFileSync(f, 'utf8'));
  data.forEach(e => {
    if (e.title === '整风运动') {
      report('改名', `下册第02章「整风运动」→「1957年整风运动」（title/wikiSlug）`);
      e.title = RENAME['整风运动'];
      e.wikiSlug = RENAME['整风运动'];
      e.summary = e.summary.replace(/整风运动/g, '1957年整风运动');
      e.examTip = e.examTip.replace(/整风运动/g, '1957年整风运动');
    }
    const beforeR = JSON.stringify(e.related);
    e.related = (e.related || []).map(r => r === '整风运动' ? '1957年整风运动' : r);
    if (JSON.stringify(e.related) !== beforeR) report('related改', `${e.title}: 整风运动 → 1957年整风运动`);
  });
  if (!DRY) fs.writeFileSync(f, JSON.stringify(data, null, 1) + '\n', 'utf8');
}

// ---- 全 12 章交叉检查：改名后仍无同名 ----
{
  const files = ['民国第01章','民国第02章','民国第03章','民国第04章','民国第05章','民国第06章','下册第01章','下册第02章','下册第03章','下册第04章','下册第05章','下册第06章'];
  const seen = new Map();
  for (const f of files) {
    const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f + '.json'), 'utf8'));
    for (const e of data) {
      if (seen.has(e.title)) report('警告', `跨章同名: ${e.title}（${f} vs ${seen.get(e.title)}）`);
      else seen.set(e.title, f);
    }
  }
  report('检查', `12 章共 ${seen.size} 个唯一 title`);
}

console.log(log.join('\n'));
if (DRY) console.log('\n（--dry-run 预览，未写盘）');
