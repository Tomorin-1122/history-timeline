/* relation.js — 关系图谱视图（C1，2026-08-05 设计定稿，2026-08-05 实施）
   事件-事件 related 力导图：当前史段事件 + 跨史段关联（虚线异色）+ 人物按需展开。
   数据零成本：复用 related/people 字段；vis-network CDN（file:// 兼容，SRI 校验）。
   交互：单击事件=高亮邻居+展开人物+浮层；双击=打开详情抽屉（跨段节点自动切史段）；
        搜索复用 matchEvent；史段切换/布局/孤立开关均重建；CDN 失败降级提示不影响其他视图。
   排序键复用 sortKey（timeline.js），门类色复用 TYPE_COLORS（map.js）。 */
'use strict';

/* ---- 全库索引：title/person → 事件（跨史段定位；一次构建） ---- */
let REL_TITLE = {}, REL_PERSON = {};
function relIndex(){
  if (Object.keys(REL_TITLE).length) return;
  [[EVENTS,'ancient'],[EVENTS_MODERN,'modern'],[EVENTS_WORLD,'world']].forEach(([arr,base])=>{
    arr.forEach(ev=>{
      const seg = base==='world' ? (ev.ch<4 ? 'world-ancient' : 'world-modern') : base;
      (REL_TITLE[ev.title] = REL_TITLE[ev.title] || []).push({seg, ev});
      (ev.people || []).forEach(p=>{
        (REL_PERSON[p] = REL_PERSON[p] || []).push({seg, title: ev.title});
      });
    });
  });
}
/* 按 title+seg 取事件对象（跨段节点也命中——REL_TITLE 全库索引） */
function relEventOf(title, seg){
  const hit = (REL_TITLE[title] || []).find(x => x.seg === seg) || (REL_TITLE[title] || [])[0];
  return hit && hit.ev;
}

/* ---- 图谱状态 ---- */
let relNetwork = null;          /* vis.Network 实例 */
let relShowIso = false;         /* 孤立事件显示开关（默认隐藏防噪） */
let relBuiltSeg = null;         /* 已构建的史段（切 tab 回来不重建，保布局） */
let relClickTimer = null;       /* 单击/双击防抖 */
let relLabelsShown = false;     /* 当前 label 是否显示（zoom 阈值控制，中文 fillText 是 canvas 重绘最大成本） */
let relAnimOn = true;           /* 呼吸动画开关（卡顿保障：关=physics 静止） */
let relTabPaused = false;       /* 切 tab 暂停标记（视图不可见时 physics 关，省 CPU） */
const relIsolatedIds = [];      /* 孤立事件节点 id（hidden 动态控制用） */
const REL_LABEL_MIN_SCALE = 0.22;  /* zoom 超过此阈值才显示 label（fit 后约 0.12 隐藏，放大 2 倍后显示） */
const REL_PHY = { gravitationalConstant: -6000, springLength: 150, springConstant: 0.06, damping: 0.09, centralGravity: 0.6 };
/* 力导参数 2026-08-05 demo 调参定稿（老板验收）：斥力 -8000→-6000、弹簧 0.04→0.06、springLength 130→150、
   centralGravity 0.3→0.5→0.6（老板三轮反馈逐步加强向心力） */

/* ---- 小工具 ---- */
function relTypeColor(t){ return (typeof TYPE_COLORS !== 'undefined' && TYPE_COLORS[t]) || '#8a6d2c'; }
function relInk(){ return (getComputedStyle(document.body).getPropertyValue('--ink2') || '#5c554a').trim(); }
function relFont(){ return getComputedStyle(document.body).fontFamily || 'serif'; }
function evNodeId(title){ return 'e:' + curSeg + ':' + title; }
function extNodeId(seg, title){ return 'e:' + seg + ':' + title; }
function nodeTitleOf(id){ return id.slice(id.indexOf(':', 2) + 1); }  /* 跳过 'e:seg:' 前缀（indexOf 从索引 2 起找 seg 后冒号） */
function nodeSegOf(id){ return id.split(':')[1]; }

/* ---- 节点/边工厂（level=章索引：hierarchical UD 布局按行分层，跨段节点置最底一行） ---- */
function mkEventNode(id, e){
  const col = relTypeColor(e.type);
  return {
    id, label: e.title, shape: 'dot', size: 7 + e.importance * 2.5,
    level: e.ch,                                      /* hierarchical 层级=章节索引 */
    color: { background: col, border: '#00000022', highlight: { background: col, border: '#ffffff' } },
    font: { size: 11, color: relInk(), face: relFont() },
    /* 不设 title：vis 原生 tooltip 会 hover 在事件上方弹出气泡（老板反馈"两个标签"，只留点击浮层） */
  };
}
function mkExtNode(id, e, seg){ /* 跨史段目标：方形半透明灰，区别于当前段圆形 */
  const { CH } = segData();
  return {
    id, label: e.title, shape: 'square', size: 13,    /* 方形略大，一眼区分 */
    level: CH.length,                                 /* 置最底一行（超出当前段章索引） */
    color: { background: 'rgba(150,150,150,0.4)', border: '#888', highlight: { background: 'rgba(150,150,150,0.6)', border: '#ffffff' } },
    font: { size: 10, color: relInk(), face: relFont() },
    /* 不设 title（同上，去 tooltip） */
  };
}
function mkEdge(edges, keySet, from, to, cross){
  const k = from < to ? from + '|' + to : to + '|' + from;
  if (keySet.has(k)) return;
  keySet.add(k);
  edges.push({
    from, to, width: cross ? 1 : 0.6, dashes: cross ? [4, 3] : false,
    color: { color: cross ? '#b4713b99' : '#8a80724d', highlight: '#9e3d26' },
    smooth: { enabled: false },
  });
}

/* ---- 构建图谱（当前史段 + 跨段目标；孤立默认隐藏） ---- */
function buildRelation(){
  relIndex();
  const canvas = document.getElementById('relCanvas');
  canvas.innerHTML = '';                                   /* 清掉降级提示/旧画布 */
  const { EV, CH } = segData();
  const seg = curSeg;
  const evByTitle = {}; EV.forEach(e => { evByTitle[e.title] = e; });
  const targets = new Set();                                /* 同段被 related 指向的 title */
  EV.forEach(e => (e.related || []).forEach(t => { if (evByTitle[t]) targets.add(t); }));
  const isIso = t => !((evByTitle[t] && evByTitle[t].related && evByTitle[t].related.length) || targets.has(t));

  relIsolatedIds.length = 0;
  const nodes = [], edges = [], ids = new Set(), edgeKey = new Set();
  /* 章内时间序 push */
  const ordered = EV.slice().sort((a, b) => sortKey(a) - sortKey(b));
  /* 第一遍：收集全部节点 id（含孤立）——同段 related 目标无论先后都在 ids 中 */
  ordered.forEach(e => {
    const id = evNodeId(e.title);
    const node = mkEventNode(id, e);
    if (isIso(e.title)){ relIsolatedIds.push(id); node.hidden = !relShowIso; }  /* 孤立：hidden 动态控制 */
    nodes.push(node); ids.add(id);
  });
  /* 第二遍：建边——若早事件 related 指向晚事件（数据主导向），第一遍已入 ids，边不再被跳过
     （审查发现：原单遍遍历 `ids.has(tid)` 依赖时间序，早→晚的边全部永久丢失，实测 550 vs 1073） */
  ordered.forEach(e => {
    const id = evNodeId(e.title);
    (e.related || []).forEach(t => {
      if (evByTitle[t] && t !== e.title){                    /* 同段（排除自引用=跨段同名指示）：实线 */
        const tid = evNodeId(t);
        if (ids.has(tid)) mkEdge(edges, edgeKey, id, tid, false);
      } else {                                             /* 跨段（含同名自引用→REL_TITLE 定位另一史段）：目标建外部节点（方形）+ 虚线 */
        const hit = (REL_TITLE[t] || []).find(x => x.seg !== seg) || (REL_TITLE[t] || [])[0];
        if (hit && hit.seg !== seg){
          const xid = extNodeId(hit.seg, t);
          if (!ids.has(xid)){ nodes.push(mkExtNode(xid, hit.ev, hit.seg)); ids.add(xid); }
          mkEdge(edges, edgeKey, id, xid, true);
        }
      }
    });
  });
  /* level 验证（老板要求）：只打 min/max/去重层级数，不打印 855 个 level 列表（刷屏） */
  const lvls = nodes.map(n => n.level);
  if (lvls.length) console.log('[relation] level 分布: min=' + Math.min.apply(null, lvls) + ' max=' + Math.max.apply(null, lvls) + ' 去重层级数=' + new Set(lvls).size + ' 节点=' + nodes.length + ' 边=' + edges.length);
  /* 布局 = 纯异步力导（Obsidian Graph View 同款，老板 demo ② 验收定稿）：stabilization 关 → 秒出图不阻塞，
     physics 持续异步收敛（呼吸感）；不冻结（点击/搜索的 update 触发轻微扰动属正常呼吸，不再乱飞——
     remove+add 全量重建已删、hover 数据更新已禁，见经验 37-41） */
  const net = new vis.Network(canvas, { nodes, edges }, relOptions());
  relNetwork = net;
  relBuiltSeg = seg;
  relBind();
  /* 渐进 fit（60ms 初出 + 500/2000/4000ms 跟随散开过程，视口一直看到全图）——闭包捕获局部 net 防 rebuild 竞态 */
  [60, 500, 2000, 4000].forEach(d => setTimeout(() => { try { if (relNetwork === net) net.fit({ animation: true }); } catch (e) { /* 重建间隙 */ } }, d));
  relCount(nodes.length, edges.length);
}
/* 布局配置：纯异步力导（stabilization 关 → 不阻塞秒出图；physics 持续 = Obsidian 呼吸感）；
   keyboard 缩放键 + 工具条 ＋/－ 按钮；拖拽开启（老板 demo ② 验收：力导联动交互） */
function relOptions(){
  return {
    layout: { randomSeed: 1 },
    physics: { enabled: true, barnesHut: REL_PHY, stabilization: { enabled: false } },
    configure: { enabled: false },
    interaction: {
      hover: false,                                  /* 悬停高亮触发连续全量重绘 → 高分屏 DPI 下整图抖动（老板反馈 2026-08-05），禁掉 */
      zoomView: true, dragView: true,                /* 保留滚轮缩放与空白平移 */
      dragNodes: true,                               /* 拖拽节点：异步力导下为 Obsidian 同款联动交互（老板 demo ② 验收开启） */
      keyboard: { enabled: true, speed: { x: 40, y: 40, zoom: 0.06 } },
    },
    nodes: { borderWidth: 1, borderWidthSelected: 2, labelHighlightBold: false },
    edges: { smooth: { enabled: false } },
  };
}
/* ---- 卡顿保障：切 tab 暂停 / 呼吸开关（physics 开关，省 CPU 兜底） ---- */
function relSetPhysics(on){ if (relNetwork) relNetwork.setOptions({ physics: { enabled: on } }); }
function relPause(){ relTabPaused = true; if (relAnimOn) relSetPhysics(false); }   /* 切走视图：暂停呼吸 */
function relResume(){ relTabPaused = false; if (relAnimOn) relSetPhysics(true); }  /* 切回视图：恢复呼吸 */
window.relPause = relPause;
window.relResume = relResume;
/* 可见缩放按钮（工具条 ＋/－）：相对当前 scale 放大/缩小 25%，并平移保持视口中心。
   moveTo 不触发 vis 的 zoom 事件 → 动画后手动 relUpdateLabels（label 阈值显隐） */
function relZoomBy(factor){
  if (!relNetwork) return;
  const scale = relNetwork.getScale() * factor;
  const pos = relNetwork.getViewPosition();
  relNetwork.moveTo({ scale, position: pos, animation: { duration: 200, easingFunction: 'easeInOutQuad' } });
  setTimeout(relUpdateLabels, 350);   /* 等 moveTo 动画结束再更新 label 显隐 */
}

/* ---- 事件绑定（单击=高亮+浮层；双击=详情抽屉；hover=防抖放大置顶；防抖区分） ---- */
function relBind(){
  relNetwork.on('click', p => {
    if (!p.nodes.length){                                /* 点击空白：收起浮层 + 清高亮（防浮层遮挡画布点不到其他事件） */
      relCardEl().hidden = true;
      relClearHighlight();
      return;
    }
    clearTimeout(relClickTimer);
    relClickTimer = setTimeout(() => relHandleClick(p.nodes[0]), 260);
  });
  relNetwork.on('doubleClick', p => {
    clearTimeout(relClickTimer);
    if (p.nodes.length) relHandleDouble(p.nodes[0]);
  });
  /* zoom 阈值显隐 label：中文 fillText 是 canvas 重绘最大成本（855 个 label），初始 fit 后只画节点（快），
     放大到可读程度（scale>0.22）才显示文字——地图软件同款策略，缩放/平移流畅度大幅提升 */
  relNetwork.on('zoom', () => relUpdateLabels());
  relUpdateLabels();
  /* hover 用 vis 原生高亮 + tooltip（interaction.hover:true），**不监听 hoverNode/blurNode 做数据更新**——
     update size/font 会触发 _dataUpdated 全量重绘，真实浏览器（DPI/渲染时序差异）下节点边界变化 → hover/blur 交替 →
     "放大→退回→再放大"死循环（老板反馈 2026-08-05，headless 无法复现但真实环境存在） */
}
/* label 显隐：只 update font.size（不动 opacity/borderWidth，保留点击高亮状态）；跨阈值才更新一次 */
function relUpdateLabels(){
  if (!relNetwork) return;
  const show = relNetwork.getScale() >= REL_LABEL_MIN_SCALE;
  /* 以 DataSet 真实 font.size 为判据（不用内存标志——曾因 fit 触发 zoom 时 update 失败导致标志与数据脱节，
     后续调用永远提前 return，label 卡在显示态）。采样第一个有 label 的节点即可 */
  let cur = null;
  relNetwork.body.data.nodes.forEach(n => { if (cur === null && n.label) cur = n.font.size; });
  if (cur >= 1 === show) return;
  const upd = [];
  relNetwork.body.data.nodes.forEach(n => {
    /* 只改 font.size（label 显隐）；不带 color/face——带完整 font 对象的批量 update 会被 vis 拒掉（实测 855 项 update 后 font 不变），
       且省略可避免字体切换触发额外重绘 */
    if (n.label) upd.push({ id: n.id, font: { size: show ? 11 : 0.01 } });
  });
  if (upd.length) relNetwork.body.data.nodes.update(upd);
}
function relNeighbors(id){
  const s = new Set();
  relNetwork.body.data.edges.forEach(e => { if (e.from === id) s.add(e.to); if (e.to === id) s.add(e.from); });
  return s;
}
function relClearHighlight(){
  if (!relNetwork) return;
  const upd = [];
  relNetwork.body.data.nodes.forEach(n => upd.push({ id: n.id, opacity: 1, borderWidth: 1 }));
  relNetwork.body.data.nodes.update(upd);
}
function relHandleClick(id){
  if (id.startsWith('p:')) return relHighlightPerson(nodeTitleOf(id));
  const isExt = !id.startsWith('e:' + curSeg + ':');
  const nb = relNeighbors(id), upd = [];
  const f = FILTERS['rel'], ql = (f.q || '').toLowerCase().trim();
  const filt = relFilterActive();
  relNetwork.body.data.nodes.forEach(n => {
    if (n.id === id || nb.has(n.id)) upd.push({ id: n.id, opacity: 1, borderWidth: n.id === id ? 3 : 2 });
    /* 筛选激活时非邻居保持筛选透明（0.12），否则用点击态 0.15——两者共存不打架 */
    else upd.push({ id: n.id, opacity: filt && !relNodeMatches(n, ql, f) ? 0.12 : 0.15 });
  });
  relNetwork.body.data.nodes.update(upd);
  /* 人物不再 add 图谱节点（855 节点下 add 触发全量重建 → 点击后卡死/点不了其他节点，老板反馈）；
     改为浮层卡片内显示人物 chips，点击 chip 高亮该人物参与的事件（relShowCard 内处理） */
  relShowCard(id, isExt);
}
function relHighlightPerson(name){
  const list = REL_PERSON[name] || [];
  const evIds = new Set(list.map(x => extNodeId(x.seg, x.title)));
  const upd = []; let first = null;
  relNetwork.body.data.nodes.forEach(n => {
    if (n.id.startsWith('e:') && evIds.has(n.id)){ upd.push({ id: n.id, opacity: 1, borderWidth: 3 }); if (!first) first = n.id; }
    else if (n.id.startsWith('e:')) upd.push({ id: n.id, opacity: 0.15 });
    else upd.push({ id: n.id, opacity: 0.25 });
  });
  relNetwork.body.data.nodes.update(upd);
  if (first) relNetwork.focus(first, { scale: 1.4, animation: { duration: 400, easingFunction: 'easeInOutQuad' } });
  relCardText(name + ' 参与 ' + list.length + ' 场事件（含跨史段）', '', list.map(x => x.title));
}
function relHandleDouble(id){
  if (id.startsWith('p:')) return;
  const seg = nodeSegOf(id), title = nodeTitleOf(id);
  if (seg === curSeg){
    const idx = segData().EV.findIndex(e => e.title === title);
    if (idx >= 0) openDrawer(idx);
  } else {
    relShowCard(id, true);
    switchSegTo(seg, title);   /* 跨段事件双击：切史段并打开详情 */
  }
}
function switchSegTo(seg, title){
  if (seg === curSeg) return;
  if (typeof switchSeg === 'function') switchSeg(seg);
  setTimeout(() => {
    const idx = segData().EV.findIndex(e => e.title === title);
    if (idx >= 0) openDrawer(idx);
  }, 120);
}

/* ---- 底部浮层卡片（复用卡片样式；textContent 防注入） ---- */
function relCardEl(){ return document.getElementById('relCard'); }
function relCardText(title, year, chips){
  const card = relCardEl(); card.innerHTML = '';
  const head = document.createElement('div'); head.className = 'rc-head';
  const b = document.createElement('b'); b.textContent = title; head.appendChild(b);
  const x = document.createElement('button'); x.className = 'rc-x'; x.textContent = '×'; x.title = '收起';
  x.addEventListener('click', () => { card.hidden = true; relClearHighlight(); });
  head.appendChild(x); card.appendChild(head);
  if (year){ const y = document.createElement('div'); y.className = 'rc-year'; y.textContent = year; card.appendChild(y); }
  if (chips && chips.length){
    const r = document.createElement('div'); r.className = 'rc-rel';
    chips.forEach(t => {
      const c = document.createElement('span'); c.className = 'rc-chip'; c.textContent = t;
      c.addEventListener('click', () => relJumpTo(t));
      r.appendChild(c);
    });
    card.appendChild(r);
  }
  const foot = document.createElement('div'); foot.className = 'rc-foot';
  foot.textContent = '单击节点高亮关联 · 双击打开详情';
  card.appendChild(foot);
  card.hidden = false;
}
function relShowCard(id, isExt){
  const seg = nodeSegOf(id), title = nodeTitleOf(id);
  const hit = (REL_TITLE[title] || []).find(x => x.seg === seg) || (REL_TITLE[title] || [])[0];
  if (!hit) return;
  const e = hit.ev;
  const card = relCardEl(); card.innerHTML = '';
  const head = document.createElement('div'); head.className = 'rc-head';
  const b = document.createElement('b'); b.textContent = e.title; head.appendChild(b);
  const x = document.createElement('button'); x.className = 'rc-x'; x.textContent = '×'; x.title = '收起';
  x.addEventListener('click', () => { card.hidden = true; relClearHighlight(); });
  head.appendChild(x); card.appendChild(head);
  const yr = document.createElement('div'); yr.className = 'rc-year';
  yr.textContent = fmtShort(e) + (isExt ? (' · ' + segName(seg)) : '');
  card.appendChild(yr);
  const sum = document.createElement('div'); sum.className = 'rc-sum'; sum.textContent = e.summary || '';
  card.appendChild(sum);
  if (e.examTip){ const tip = document.createElement('div'); tip.className = 'rc-tip'; tip.textContent = '备考钩：' + e.examTip; card.appendChild(tip); }
  /* 人物 chips（点击高亮该人物参与的全部事件，跨史段全查）——不再 add 人物图节点（性能，见 relHandleClick） */
  if (e.people && e.people.length){
    const pr = document.createElement('div'); pr.className = 'rc-rel'; pr.textContent = '人物：';
    e.people.forEach(p => {
      const c = document.createElement('span'); c.className = 'rc-chip rc-chip-ppl'; c.textContent = p;
      c.addEventListener('click', () => relHighlightPerson(p));
      pr.appendChild(c);
    });
    card.appendChild(pr);
  }
  if (e.related && e.related.length){
    const r = document.createElement('div'); r.className = 'rc-rel'; r.textContent = '关联：';
    e.related.forEach(t => {
      if (t === e.title) return;   /* 跨段同名自引用：虚线边已画，chip 不重复显示 */
      const c = document.createElement('span'); c.className = 'rc-chip'; c.textContent = t;
      c.addEventListener('click', () => relJumpTo(t));
      r.appendChild(c);
    });
    card.appendChild(r);
  }
  const foot = document.createElement('div'); foot.className = 'rc-foot';
  foot.textContent = isExt ? '该事件属于「' + segName(seg) + '」，双击或点关联可切史段查看' : '双击打开详情抽屉';
  card.appendChild(foot);
  card.hidden = false;
}
function relJumpTo(t){
  const id = evNodeId(t);
  if (relNetwork && relNetwork.body.data.nodes.get(id)){
    relNetwork.focus(id, { scale: 1.5, animation: { duration: 300, easingFunction: 'easeInOutQuad' } });
    relHandleClick(id);
  } else {
    const hit = (REL_TITLE[t] || [])[0];
    if (hit) switchSegTo(hit.seg, t);
  }
}

/* ---- 搜索/筛选：顶栏 type/imp 多选 + 搜索词 q 组合作用于图谱（2026-08-05 老板检查筛选栏逻辑后统一——
   关系视图下顶栏门类/重要度筛选不再"点了没反应"，与搜索一样高亮匹配/降透明不匹配；ch 无 UI 入口不参与） ---- */
function relFilterActive(){
  const f = FILTERS['rel'];
  return !!(f && (f.q || f.type.size || f.imp.size));
}
/* 节点是否命中筛选（当前段与跨段节点都从全库索引取事件对象） */
function relNodeMatches(n, ql, f){
  const title = nodeTitleOf(n.id), seg = nodeSegOf(n.id);
  const e = relEventOf(title, seg);
  if (!e) return false;
  if (f.type.size && !f.type.has(e.type)) return false;
  if (f.imp.size && !f.imp.has(e.importance)) return false;
  if (ql && !matchEvent(e, ql)) return false;
  return true;
}
function relApplyFilters(){
  if (!relNetwork) return;
  const f = FILTERS['rel'];
  const ql = (f.q || '').toLowerCase().trim();
  const active = relFilterActive();
  const hitIds = [], upd = [];
  relNetwork.body.data.nodes.forEach(n => {
    if (!active){ upd.push({ id: n.id, opacity: 1, borderWidth: 1 }); return; }
    if (relNodeMatches(n, ql, f)){ upd.push({ id: n.id, opacity: 1, borderWidth: 3 }); if (n.id.startsWith('e:' + curSeg + ':')) hitIds.push(n.id); }
    else upd.push({ id: n.id, opacity: 0.12 });
  });
  relNetwork.body.data.nodes.update(upd);
  if (hitIds.length){
    relNetwork.selectNodes(hitIds.slice(0, 60), true);
    relNetwork.focus(hitIds[0], { scale: 1.2, animation: { duration: 400, easingFunction: 'easeInOutQuad' } });
  } else {
    relNetwork.unselectAll();
  }
}
/* relSearch 兼容保留（测试钩子 window.__rel.search 用）：写 FILTERS.rel.q 后统一走 relApplyFilters */
function relSearch(q){
  if (typeof FILTERS !== 'undefined' && FILTERS['rel']) FILTERS['rel'].q = q || '';
  relApplyFilters();
}
window.relApplyFilters = relApplyFilters;   /* timeline.js applyFilter 钩子（typeof 检查调用） */

/* ---- 加载 vis-network：本地化（js/vendor/vis-network.min.js，688KB 同源秒开）——彻底摆脱 jsdelivr CDN
   间歇挂起问题（2026-08-05 实测：同步 script 挂起阻塞整页解析；CDN 动态加载也时好时坏）。
   本地文件加载极快且离线可用；保留 onerror 降级兜底（文件缺失时提示） ---- */
const REL_LIB_URL = 'js/vendor/vis-network.min.js';
let relLibPromise = null;
function relLoadLib(){
  if (window.vis && window.vis.Network) return Promise.resolve();
  if (relLibPromise) return relLibPromise;
  relLibPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = REL_LIB_URL;   /* 相对路径：http(s) 服务与 file:// 直开均可用 */
    s.onload = () => { clearTimeout(relLibTimer); window.vis && window.vis.Network ? resolve() : reject(new Error('vis 未定义')); };
    s.onerror = () => { clearTimeout(relLibTimer); reject(new Error('本地文件缺失')); };
    document.head.appendChild(s);
    /* 兜底超时（本地加载一般 <100ms，10s 防极端卡死） */
    var relLibTimer = setTimeout(() => reject(new Error('图谱组件加载超时')), 10000);
  }).catch(err => { relLibPromise = null; throw err; });   /* 失败置空允许下次重试 */
  return relLibPromise;
}
function relFallback(msg){
  const canvas = document.getElementById('relCanvas'); if (!canvas) return;
  if (relNetwork){ relNetwork.destroy(); relNetwork = null; }
  relBuiltSeg = null;
  canvas.innerHTML = '<div class="rel-fallback">' + msg + ' 时间轴 / 地图 / 复习不受影响。</div>';
}

/* ---- 入口（app.js switchView('relation') 调用；CDN 失败降级） ---- */
function initRelation(){
  const canvas = document.getElementById('relCanvas');
  if (!canvas) return;
  const sel = document.getElementById('relSeg'); if (sel && sel.value !== curSeg) sel.value = curSeg;  /* 顶栏切史段后同步下拉 */
  relLoadLib()
    .then(() => {
      if (relNetwork && relBuiltSeg === curSeg){ relNetwork.redraw(); relNetwork.fit(); relApplyFilters(); return; }  /* 切 tab 回来不重建，保布局 */
      if (relNetwork){ relNetwork.destroy(); relNetwork = null; }
      try { buildRelation(); setTimeout(relApplyFilters, 50); }   /* 重建后重放顶栏筛选（type/imp/q） */
      catch (err){ relFallback('图谱构建失败：' + err.message); }
    })
    .catch(err => relFallback('图谱组件加载失败（' + err.message + '），请联网后刷新。'));
}
window.initRelation = initRelation;   /* 供 app.js switchView 调用（typeof 检查） */
function relCount(n, e){
  const c = document.getElementById('relCount');
  if (c) c.textContent = n + ' 节点 · ' + e + ' 关联';
}

/* ---- 图例（门类色 + 跨段说明） ---- */
(function relLegend(){
  const g = document.getElementById('relLegend'); if (!g) return;
  g.innerHTML = '';
  const order = ['政治', '军事', '经济', '文化', '制度', '民族关系', '对外关系'];
  order.forEach(t => {
    const s = document.createElement('span'); s.className = 'rel-lg';
    const i = document.createElement('i'); i.style.background = relTypeColor(t); i.style.display = 'inline-block';
    i.style.width = '9px'; i.style.height = '9px'; i.style.borderRadius = '50%'; i.style.marginRight = '4px';
    s.appendChild(i); s.appendChild(document.createTextNode(t));
    g.appendChild(s);
  });
  const ext = document.createElement('span'); ext.className = 'rel-lg rel-lg-ext';
  const i2 = document.createElement('i'); i2.style.display = 'inline-block'; i2.style.width = '9px'; i2.style.height = '9px';
  i2.style.background = '#b4713b88'; i2.style.marginRight = '4px';
  ext.appendChild(i2); ext.appendChild(document.createTextNode('跨史段'));
  g.appendChild(ext);
})();

/* ---- 史段下拉切换（关系视图内直接切，不离开图谱视图；与顶栏 seg-btn 行为一致但轻量） ---- */
function switchRelSeg(seg){
  if (seg === curSeg) return;
  if (typeof rvState !== 'undefined' && rvState && !confirm('复习进行中，切换史段将终止本轮并回到设置界面。')){
    const sel = document.getElementById('relSeg'); if (sel) sel.value = curSeg;
    return;
  }
  curSeg = seg;
  const segRow = document.getElementById('segRow');
  if (segRow) segRow.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('on', b.dataset.seg === seg));
  document.body.classList.remove('seg-modern', 'seg-world-ancient', 'seg-world-modern');
  if (seg !== 'ancient') document.body.classList.add('seg-' + seg);
  if (typeof renderPerLinks === 'function') renderPerLinks();
  /* 只重建图谱（不重渲染时间轴/不切视图）；重建后重放筛选 */
  if (relNetwork){ relNetwork.destroy(); relNetwork = null; }
  relBuiltSeg = null;
  try { buildRelation(); } catch (e) { relFallback('图谱构建失败：' + e.message); }
  setTimeout(relApplyFilters, 50);
}
window.switchRelSeg = switchRelSeg;

/* ---- 工具条事件（史段下拉/孤立开关/搜索；顶栏搜索联动；布局按钮已删除——力导唯一视图） ---- */
(function relUI(){
  const q = document.getElementById('relQ');
  /* 史段下拉：切图谱不切视图 */
  document.getElementById('relSeg').addEventListener('change', function(){
    switchRelSeg(this.value);
  });
  /* 工具条搜索：写 FILTERS.rel.q（切走再切回顶栏恢复搜索词）+ 同步顶栏输入框 + 驱动图谱 */
  q.addEventListener('input', () => {
    if (typeof FILTERS !== 'undefined' && FILTERS['rel']) FILTERS['rel'].q = q.value.trim();
    const tq = document.getElementById('q');
    if (tq && tq.value !== q.value) tq.value = q.value;
    relApplyFilters();
  });
  document.getElementById('relIso').addEventListener('click', function(){
    relShowIso = !relShowIso;
    this.textContent = '孤立：' + (relShowIso ? '显示' : '隐藏');
    this.classList.toggle('on', relShowIso);
    if (relNetwork){ relNetwork.destroy(); relNetwork = null; }
    buildRelation();
    setTimeout(relApplyFilters, 50);   /* rebuild 后重放筛选 */
  });
  /* 呼吸开关：开=physics 持续（异步力导呼吸感）；关=physics 静止（低配机卡顿保障，仍可缩放/拖拽/平移） */
  document.getElementById('relAnim').addEventListener('click', function(){
    relAnimOn = !relAnimOn;
    this.textContent = '呼吸：' + (relAnimOn ? '开' : '关');
    this.classList.toggle('on', relAnimOn);
    if (!relTabPaused) relSetPhysics(relAnimOn);
  });
  /* 可见缩放按钮（＋/－）；键盘 = / - 由 interaction.keyboard 处理 */
  document.getElementById('relZoomIn').addEventListener('click', () => relZoomBy(1.25));
  document.getElementById('relZoomOut').addEventListener('click', () => relZoomBy(0.8));
  /* 顶栏搜索：关系视图可见时同步驱动图谱（与工具条搜索一致；timeline.js 已写 FILTERS.rel.q） */
  document.getElementById('q').addEventListener('input', ev => {
    if (!document.getElementById('view-relation').hidden){
      document.getElementById('relQ').value = ev.target.value;
      relApplyFilters();
    }
  });
})();

/* 测试钩子（tests/verify_relation.js 用，只读内部状态；生产无副作用） */
window.__rel = {
  get net(){ return relNetwork; },
  click: relHandleClick,
  dbl: relHandleDouble,
  search: relSearch,
  labels: relUpdateLabels,
  labelsShown: () => relLabelsShown,
};
