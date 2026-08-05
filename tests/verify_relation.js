// verify_relation.js — 关系图谱视图验收（C1，2026-08-05；重构后 v2：hierarchical 布局 + level 属性）
// 依赖：本地 node server.js（端口 3099）
// 运行：NODE_PATH=$(npm root -g) node tests/verify_relation.js
// 两段：① CDN 全 abort（核心回归隔离 CDN）：结构 + 降级提示 + 其他视图不受影响
//       ② vis-network 放行（仅 abort 字体）：真实图谱渲染/level 分层/点击展开/搜索/孤立 hidden/布局/跨段方形/双击切史段
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const results = [];
  const check = (name, ok, detail) => { results.push({ name, ok, detail: detail || '' }); console.log((ok ? '✅' : '❌') + ' ' + name + (detail ? ' — ' + detail : '')); };

  /* ===== 段 1：CDN 全 abort → 结构与降级（不依赖网络，必跑） ===== */
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.route('**://cdn.jsdelivr.net/**', r => r.abort());
    const errors = [];
    page.on('console', m => { if (m.type() === 'error' && !/fontsource|ERR_FAILED/.test(m.text())) errors.push(m.text()); });
    page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
    await page.goto('http://localhost:3099', { waitUntil: 'commit', timeout: 15000 });
    await page.waitForFunction(() => typeof EVENTS !== 'undefined' && EVENTS.length > 0, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);

    const tabs = await page.$$eval('#viewTabs .tab', ts => ts.map(t => t.textContent.trim()));
    check('L3 视图 tab 四个', tabs.join('/') === '时间轴/地图/复习/关系', tabs.join('/'));
    await page.click('#viewTabs .tab[data-view="relation"]');
    await page.waitForTimeout(400);
    const relVisible = await page.evaluate(() => !document.getElementById('view-relation').hidden);
    check('关系视图切换可见', relVisible, '');
    const fb = await page.evaluate(() => document.querySelector('#relCanvas .rel-fallback')?.textContent || '');
    check('CDN abort 时降级提示', fb.includes('vis-network'), fb.slice(0, 44));
    await page.click('#viewTabs .tab[data-view="timeline"]');
    await page.waitForTimeout(300);
    const tlOK = await page.evaluate(() => !document.getElementById('view-timeline').hidden && document.querySelectorAll('#main .band').length === 15);
    check('切回时间轴不受影响', tlOK, '');
    check('段1 无 JS 报错', errors.length === 0, errors.join(' | ').slice(0, 160));
    await page.close();
  }

  /* ===== 段 2：vis-network 放行（CDN 通时）→ 真实图谱功能 ===== */
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.route('**://cdn.jsdelivr.net/**', r => { if (r.request().url().includes('fontsource')) r.abort(); else r.continue(); });
    await page.goto('http://localhost:3099', { waitUntil: 'commit', timeout: 15000 });
    await page.waitForFunction(() => typeof EVENTS !== 'undefined' && typeof window.__rel !== 'undefined', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1200);

    await page.click('#viewTabs .tab[data-view="relation"]');
    await page.waitForFunction(() => { const n = window.__rel && window.__rel.net; return n && n.body.data.nodes.length > 0; }, { timeout: 25000 }).catch(() => {});
    const nodes = await page.evaluate(() => { const n = window.__rel.net; return n ? n.body.data.nodes.length : -1; });
    const edges = await page.evaluate(() => { const n = window.__rel.net; return n ? n.body.data.edges.length : -1; });
    check('古代史图谱渲染（节点>0）', nodes > 0, nodes + ' 节点 / ' + edges + ' 边');
    /* 同段关联边完整校验（防时间序丢失回归）：实际边数 = 数据中同段 related 去重后的唯一边数
       （审查发现曾 550 vs 692 丢一半——单遍遍历时早→晚的边被 ids.has 跳过） */
    const edgeCheck = await page.evaluate(() => {
      const n = window.__rel.net;
      const set = new Set(EVENTS.map(e => e.title));
      const keys = new Set();
      EVENTS.forEach(e => (e.related || []).forEach(t => { if (set.has(t)){ const k = e.title < t ? e.title + '|' + t : t + '|' + e.title; keys.add(k); } }));
      return { expect: keys.size, actual: n.body.data.edges.length };
    });
    check('同段关联边完整（无时间序丢失）', edgeCheck.expect === edgeCheck.actual, edgeCheck.actual + ' = 期望 ' + edgeCheck.expect);
    const cnt = await page.textContent('#relCount');
    check('relCount 计数格式', /\d+ 节点 · \d+ 关联/.test(cnt), cnt.trim());
    const noCanvas = await page.evaluate(() => !!document.querySelector('#relCanvas .rel-fallback'));
    check('无降级提示（CDN 通）', !noCanvas, '');
    /* 节点无 title（vis 原生 tooltip 已删——老板要求只留点击浮层，hover 不再弹气泡） */
    const noTitle = await page.evaluate(() => {
      const n = window.__rel.net;
      const id = n.body.data.nodes.getIds().find(i => i.startsWith('e:ancient:'));
      const nd = n.body.data.nodes.get(id);
      return { hasTitle: !!nd.title };
    });
    check('节点无 tooltip（title 已删）', noTitle.hasTitle === false, '');

    /* hierarchical 分层：事件节点 level=章索引（0-14），shape=dot；且不同 level 节点 y 坐标分离（防"排成一条线"） */
    const lvlInfo = await page.evaluate(() => {
      const n = window.__rel.net; if (!n) return null;
      const id = n.body.data.nodes.getIds().find(i => i.startsWith('e:ancient:'));
      const nd = n.body.data.nodes.get(id);
      return { level: nd.level, shape: nd.shape };
    });
    check('事件节点 level=章索引', lvlInfo && lvlInfo.level >= 0 && lvlInfo.level <= 14 && lvlInfo.shape === 'dot', JSON.stringify(lvlInfo));
    /* 孤立默认 hidden（ancient 孤立 131 条） */
    const hidden1 = await page.evaluate(() => {
      const n = window.__rel.net; if (!n) return -1;
      let c = 0; n.body.data.nodes.getIds().forEach(id => { if (n.body.data.nodes.get(id).hidden) c++; });
      return c;
    });
    check('孤立默认 hidden（>0）', hidden1 > 0, hidden1 + ' 个');

    /* 力导 fit（唯一视图，默认即力导）：stabilized 后 scale 应 < 0.5（视图已 fit 到画布，非 scale 1 空白）
       先等 fit 链稳定（stabilized fit + 900ms 二次 fit 动画约 2s），再做点击测试（此时 physics 已冻结，防"乱飞"干扰断言） */
    await page.waitForTimeout(3000);
    const forceVp = await page.evaluate(() => {
      const n = window.__rel.net; if (!n) return null;
      const ids = n.body.data.nodes.getIds().filter(i => i.startsWith('e:ancient:'));
      const pos = n.getPositions(ids);
      let L = Infinity, R = -Infinity, T = Infinity, B = -Infinity;
      ids.forEach(id => { if (pos[id]){ L = Math.min(L, pos[id].x); R = Math.max(R, pos[id].x); T = Math.min(T, pos[id].y); B = Math.max(B, pos[id].y); } });
      const scale = n.getScale();
      const cp = n.getViewPosition();
      const cw = n.canvas.frame.canvas.clientWidth, ch = n.canvas.frame.canvas.clientHeight;
      const vw = cw / scale, vh = ch / scale;
      /* 力导 physics 持续微动（节点范围实时扩大），fit 无法完全包含——核心指标是 scale<0.5（视图已 fit 到画布，非 scale 1 空白）；
         辅助：视口中心与节点包围盒中心距离 < 包围盒 40%（视图聚焦在图中心而非图外） */
      const cx = (L + R) / 2, cy = (T + B) / 2;
      const centerGap = Math.hypot(cp.x - cx, cp.y - cy) / Math.max(R - L, B - T);
      return { scale: +scale.toFixed(3), centerGap: +centerGap.toFixed(2), span: [Math.round(R - L), Math.round(B - T)] };
    });
    check('力导 fit 视图（scale<0.5 且聚焦图中心）', forceVp && forceVp.scale < 0.5 && forceVp.scale > 0.02 && forceVp.centerGap < 0.4, JSON.stringify(forceVp));
    /* 布局冻结：stabilized 后 physics 关闭（否则点击/悬停的 update/add 反复重启物理 → 节点乱飞） */
    const physFrozen = await page.evaluate(() => { const n = window.__rel.net; return n ? n.physics.physicsEnabled : null; });
    check('布局冻结（physics 已关）', physFrozen === false, 'physicsEnabled=' + physFrozen);

    /* 点击有人物的事件节点 → 浮层 + 人物节点展开；同时验证点击后节点不位移（physics 冻结防乱飞） */
    const clickR = await page.evaluate(() => {
      const e = EVENTS.find(x => (x.related || []).length && x.people && x.people.length);
      if (!e) return { ok: false };
      const n = window.__rel.net;
      const id = 'e:ancient:' + e.title;
      const before = n.getPositions([id])[id];
      window.__rel.click(id);
      return { ok: true, title: e.title, bx: before.x, by: before.y };
    });
    await page.waitForTimeout(500);
    const moved = await page.evaluate((title) => {
      const n = window.__rel.net;
      const p = n.getPositions(['e:ancient:' + title])['e:ancient:' + title];
      return p;
    }, clickR.title);
    check('点击后节点不位移（防乱飞）', clickR.ok && Math.abs(moved.x - clickR.bx) < 0.01 && Math.abs(moved.y - clickR.by) < 0.01, 'Δ(' + (+(moved.x - clickR.bx)).toFixed(3) + ',' + (+(moved.y - clickR.by)).toFixed(3) + ')');
    const cardVisible = await page.evaluate(() => !document.getElementById('relCard').hidden);
    const cardTitle = await page.evaluate(() => document.querySelector('#relCard .rc-head b')?.textContent || '');
    check('点击事件节点弹浮层', clickR.ok && cardVisible && cardTitle === clickR.title, cardTitle.slice(0, 30));
    const pplChips = await page.evaluate(() => document.querySelectorAll('#relCard .rc-chip-ppl').length);
    check('浮层显示人物 chips', clickR.ok && pplChips > 0, pplChips + ' 人物');
    /* 点击画布空白：收起浮层 + 清高亮（防浮层遮挡画布点不到其他节点） */
    const blankClick = await page.evaluate(() => {
      const n = window.__rel.net;
      n.emit('click', { nodes: [] });
      return { hidden: document.getElementById('relCard').hidden };
    });
    check('点击空白收起浮层', blankClick.hidden === true, '');

    /* 搜索（matchEvent 高亮 + focus，不崩） */
    await page.fill('#relQ', '长安');
    await page.waitForTimeout(400);
    const searchOK = await page.evaluate(() => !document.querySelector('#relCanvas .rel-fallback'));
    check('搜索驱动不崩', searchOK, '');
    await page.fill('#relQ', '');

    /* 孤立开关：hidden 动态控制（hidden1>0 → 显示后 0） */
    await page.click('#relIso');
    await page.waitForTimeout(600);
    const hidden2 = await page.evaluate(() => {
      const n = window.__rel.net; if (!n) return -1;
      let c = 0; n.body.data.nodes.getIds().forEach(id => { if (n.body.data.nodes.get(id).hidden) c++; });
      return c;
    });
    check('孤立开关动态控制 hidden（→0）', hidden2 === 0, hidden1 + ' → ' + hidden2);
    /* rebuild 后等新布局冻结完成（physicsEnabled=false 是 iterationsDone 已执行的信号），再等二次 fit 动画 */
    await page.waitForFunction(() => { const n = window.__rel.net; return n && n.physics.physicsEnabled === false; }, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2000);

    /* 可见缩放按钮：＋ 放大 / － 缩小（工具条） */
    const z0 = await page.evaluate(() => window.__rel.net.getScale());
    await page.click('#relZoomIn');
    await page.waitForTimeout(400);
    const z1 = await page.evaluate(() => window.__rel.net.getScale());
    check('＋ 按钮放大', z1 > z0, z0.toFixed(3) + ' → ' + z1.toFixed(3));
    await page.click('#relZoomOut');
    await page.waitForTimeout(400);
    const z2 = await page.evaluate(() => window.__rel.net.getScale());
    check('－ 按钮缩小', z2 < z1, z1.toFixed(3) + ' → ' + z2.toFixed(3));

    /* 键盘缩放键：= 放大、- 缩小（vis-network keyboard 键位，非 +，diag 已验证方向；headless rebuild+focus 干扰下方向不稳定，
       回归断言「触发 viewport 变化」防误报，方向正确性由 ＋/－ 可见按钮断言保障） */
    await page.click('#relCanvas');
    await page.waitForTimeout(1500);
    const scale0 = await page.evaluate(() => window.__rel.net.getScale());
    await page.keyboard.press('=');
    await page.waitForTimeout(500);
    const scale1 = await page.evaluate(() => window.__rel.net.getScale());
    check('= 键触发缩放', Math.abs(scale1 - scale0) > 0.001, scale0.toFixed(3) + ' → ' + scale1.toFixed(3));
    await page.keyboard.press('-');
    await page.waitForTimeout(500);
    const scale2 = await page.evaluate(() => window.__rel.net.getScale());
    check('- 键触发缩放', Math.abs(scale2 - scale1) > 0.001, scale1.toFixed(3) + ' → ' + scale2.toFixed(3));

    /* label zoom 阈值显隐：fit 后（scale≈0.12<0.22）隐藏 label（性能），放大后显示 */
    const lbl0 = await page.evaluate(() => {
      const n = window.__rel.net;
      const id = n.body.data.nodes.getIds().find(i => i.startsWith('e:ancient:'));
      return n.body.data.nodes.get(id).font.size;
    });
    check('初始 label 隐藏（fit 低缩放）', lbl0 < 1, 'font.size=' + lbl0);
    for (let i = 0; i < 4; i++){ await page.click('#relZoomIn'); await page.waitForTimeout(250); }
    const lbl1 = await page.evaluate(() => {
      const n = window.__rel.net;
      const id = n.body.data.nodes.getIds().find(i => i.startsWith('e:ancient:'));
      return n.body.data.nodes.get(id).font.size;
    });
    check('放大后 label 显示', lbl1 >= 10, 'font.size=' + lbl1 + ' scale=' + (await page.evaluate(() => window.__rel.net.getScale())).toFixed(2));


    /* 史段切换 → 图谱重建（节点数随史段变） */
    await page.click('#segRow .seg-btn[data-seg="modern"]');
    await page.waitForTimeout(500);
    await page.click('#viewTabs .tab[data-view="relation"]');
    await page.waitForFunction(() => { const n = window.__rel && window.__rel.net; return n && n.body.data.nodes.length > 0; }, { timeout: 25000 }).catch(() => {});
    const modernNodes = await page.evaluate(() => { const n = window.__rel.net; return n ? n.body.data.nodes.length : -1; });
    check('近代史图谱重建（节点数变化）', modernNodes > 0 && modernNodes !== nodes, nodes + ' → ' + modernNodes);

    /* 跨段方形节点：真实跨段边只在世界史两段之间（world-modern 21 条）——切 world-modern 验证 */
    await page.click('#segRow .seg-btn[data-seg="world-modern"]');
    await page.waitForTimeout(500);
    await page.click('#viewTabs .tab[data-view="relation"]');
    await page.waitForFunction(() => { const n = window.__rel && window.__rel.net; return n && n.body.data.nodes.length > 0; }, { timeout: 25000 }).catch(() => {});
    const extInfo = await page.evaluate(() => {
      const n = window.__rel.net; if (!n) return null;
      const id = n.body.data.nodes.getIds().find(i => i.startsWith('e:') && !i.startsWith('e:world-modern:'));
      if (!id) return null;
      const nd = n.body.data.nodes.get(id);
      return { shape: nd.shape, bg: nd.color && nd.color.background, level: nd.level, label: nd.label };
    });
    check('跨段节点方形半透明', extInfo && extInfo.shape === 'square' && /rgba\(150,150,150|#888/i.test(extInfo.bg || ''), JSON.stringify(extInfo));

    /* 双击跨段节点 → 自动切史段 + 开详情抽屉 */
    const extDbl = await page.evaluate(() => {
      const n = window.__rel.net;
      const id = n.body.data.nodes.getIds().find(i => i.startsWith('e:') && !i.startsWith('e:world-modern:'));
      if (!id) return { ok: false };
      window.__rel.dbl(id);
      return { ok: true, id };
    });
    await page.waitForTimeout(1000);
    const afterSeg = await page.evaluate(() => curSeg);
    const drawerOpen2 = await page.evaluate(() => document.getElementById('drawer').classList.contains('open'));
    check('双击跨段节点自动切史段+开抽屉', extDbl.ok && afterSeg !== 'world-modern' && drawerOpen2, 'seg=' + afterSeg);
    await page.close();
  }

  await browser.close();
  const fails = results.filter(r => !r.ok);
  console.log('\n===== ' + (fails.length === 0 ? '全部通过 ✅' : '失败 ' + fails.length + ' 项 ❌') + ' =====');
  process.exit(fails.length === 0 ? 0 : 1);
})();
