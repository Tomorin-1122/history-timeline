// 三章原始数据体检：五代宋辽金西夏 / 明 / 清前期
const fs = require('fs');
const path = require('path');

const targets = ['五代宋辽金西夏', '明', '清前期'];
// 已接入的 12 章（含清洗过的），用于跨章查重和 related 校验
const cleanChapters = ['原始社会_pilot_20260802','夏商_pilot_20260802','西周_pilot_20260802','春秋_pilot_20260802','战国_pilot_20260801','秦_pilot_20260802','西汉_pilot_20260802','东汉','三国两晋南北朝','隋','唐','元代_pilot_20260802'];

const VALID_TYPES = new Set(['军事','制度','对外关系','政治','文化','民族关系','经济']);
const VALID_MODES = new Set(['exact','approx','range','era']);
const VALID_IMPORTANCE = new Set([1,2,3]);

function load(f) {
  const d = JSON.parse(fs.readFileSync(path.join('data', f + '.json'), 'utf8'));
  // 顶层是数字键对象 → 转数组
  return Object.values(d);
}

// 全部 title 索引（已接入章 + 三章）
const allTitles = new Set();
for (const f of [...cleanChapters, ...targets]) {
  for (const e of load(f)) allTitles.add(e.title);
}

// 重复检测：同名 title 出现在多个文件
const titleFiles = new Map();
for (const f of [...cleanChapters, ...targets]) {
  for (const e of load(f)) {
    if (!titleFiles.has(e.title)) titleFiles.set(e.title, []);
    titleFiles.get(e.title).push(f);
  }
}

for (const f of targets) {
  const arr = load(f);
  const issues = [];
  const typeCount = {};
  let dynBracket = [], locEmpty = [], relatedDangling = [], relatedAll = [], yearBad = [], eraBad = [], fieldMiss = [], dupTitles = [];

  for (const e of arr) {
    const t = e.title || '(无title)';

    // 1. 字段完整性（基准 19 字段）
    const need = ['title','year','yearMode','yearRange','era','eraSub','dynasty','period','type','importance','summary','cause','effect','examTip','people','location','tags','related','wikiSlug'];
    const miss = need.filter(k => !(k in e));
    if (miss.length) fieldMiss.push(t + ': 缺 ' + miss.join(','));

    // 2. type 枚举
    if (!VALID_TYPES.has(e.type)) typeCount[e.type] = (typeCount[e.type]||0)+1;

    // 3. dynasty 括号
    if (e.dynasty && /[（）()]/.test(e.dynasty)) dynBracket.push(t + ' → ' + e.dynasty);

    // 4. location 空
    if (!e.location || !String(e.location).trim()) locEmpty.push(t);

    // 5. related 悬空
    if (Array.isArray(e.related) && e.related.length) {
      relatedAll.push(...e.related);
      const dangling = e.related.filter(r => !allTitles.has(r));
      if (dangling.length) relatedDangling.push(t + ' → [' + dangling.join(', ') + ']');
    }

    // 6. year 合规
    if (!VALID_MODES.has(e.yearMode)) yearBad.push(t + ': yearMode=' + e.yearMode);
    if (e.yearMode === 'range' && (!Array.isArray(e.yearRange) || e.yearRange.length !== 2)) yearBad.push(t + ': range 但 yearRange 异常');
    if (e.yearMode !== 'range' && e.yearMode !== 'era' && typeof e.year !== 'number') yearBad.push(t + ': year 非数字=' + e.year);
    if (!VALID_IMPORTANCE.has(e.importance)) yearBad.push(t + ': importance=' + e.importance);

    // 7. era 模式（era 必填；eraSub 允许空——已清洗章节同此规范）
    if (e.yearMode === 'era' && !e.era) eraBad.push(t + ': era 缺 era');
    if (e.yearMode !== 'era' && e.era) eraBad.push(t + ': 非 era 但 era 非空');
  }

  // 8. 跨章重复 title（只查当前章自己的 title 是否与其它文件撞）
  const seen = new Set();
  for (const e of arr) {
    if (seen.has(e.title)) { dupTitles.push(e.title + ' 在本章出现多次'); continue; }
    seen.add(e.title);
    const files = titleFiles.get(e.title) || [];
    const others = files.filter(x => x !== f);
    if (others.length) dupTitles.push(e.title + ' 与 [' + others.join(', ') + '] 重复');
  }

  console.log('══════════ ' + f + '（' + arr.length + ' 条）══════════');
  console.log('▸ type 越界值:', Object.keys(typeCount).length ? JSON.stringify(typeCount) : '无 ✅');
  console.log('▸ dynasty 带括号:', dynBracket.length ? dynBracket.join(' | ') : '无 ✅');
  console.log('▸ location 为空:', locEmpty.length ? locEmpty.join(' | ') : '无 ✅');
  console.log('▸ related 悬空(' + relatedAll.length + ' 个引用):', relatedDangling.length ? relatedDangling.join(' | ') : '无 ✅');
  console.log('▸ year/importance 异常:', yearBad.length ? yearBad.join(' | ') : '无 ✅');
  console.log('▸ era 模式异常:', eraBad.length ? eraBad.join(' | ') : '无 ✅');
  console.log('▸ 缺字段:', fieldMiss.length ? fieldMiss.join(' | ') : '无 ✅');
  console.log('▸ 跨章/章内重复 title:', dupTitles.length ? dupTitles.slice(0, 20).join(' | ') + (dupTitles.length>20 ? ' ...共'+dupTitles.length+'处' : '') : '无 ✅');
  console.log();
}
