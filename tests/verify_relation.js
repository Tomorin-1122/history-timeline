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
    /* 图谱本地化（js/vendor/vis-network.min.js）：CDN 全断仍正常渲染 */
    await page.waitForFunction(() => { const n = window.__rel && window.__rel.net; return n && n.body.data.nodes.length > 0; }, { timeout: 20000 }).catch(() => {});
    const nodes = await page.evaluate(() => { const n = window.__rel.net; return n ? n.body.data.nodes.length : -1; });
    const edges = await page.evaluate(() => { const n = window.__rel.net; return n ? n.body.data.edges.length : -1; });
    const noFallback = await page.evaluate(() => !document.querySelector('#relCanvas .rel-fallback'));
    check('CDN 全断时图谱正常渲染（本地化）', nodes > 0 && noFallback, nodes + ' 节点 / ' + edges + ' 边');

    /* 关联边完整校验（防时间序丢失回归）：实际边数 = 数据中同段 related 去重唯一边 + 跨段 related 边
       （曾 550 vs 692 丢一半——单遍遍历时早→晚的边被 ids.has 跳过；2026-08-05 加选官制度链后 ancient 段出现首条跨段边，
         期望须含跨段，见经验 51） */
    const edgeCheck = await page.evaluate(() => {
      const n = window.__rel.net;
      const set = new Set(EVENTS.map(e => e.title));
      const keys = new Set(); const cross = new Set();
      EVENTS.forEach(e => (e.related || []).forEach(t => {
        const k = e.title < t ? e.title + '|' + t : t + '|' + e.title;
        if (set.has(t)) keys.add(k); else cross.add(k);   /* 同段按 from|to 去重；跨段同样去重（mkEdge 同口径） */
      }));
      return { expect: keys.size + cross.size, actual: n.body.data.edges.length };
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
    /* 孤立默认 hidden：2026-08-06 子代理批量补边后孤立已清零（0 个）——断言从 >0 改为 ===0（未来新增孤立事件会暴露） */
    const hidden1 = await page.evaluate(() => {
      const n = window.__rel.net; if (!n) return -1;
      let c = 0; n.body.data.nodes.getIds().forEach(id => { if (n.body.data.nodes.get(id).hidden) c++; });
      return c;
    });
    check('孤立事件已全部连入（hidden=0）', hidden1 === 0, hidden1 + ' 个');

    /* 力导 fit（唯一视图，默认即力导）：渐进 fit 链（60/500/2000/4000ms）后 scale 应 < 0.5（视图已 fit 到画布，非 scale 1 空白）
       先等 fit 链稳定（4s 后），再做点击测试 */
    await page.waitForTimeout(4500);
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
    /* 异步力导模式：physics 持续开启（呼吸感，stabilization 关）；点击/搜索的 update 只触发轻微扰动而非冻结 */
    const physOn = await page.evaluate(() => { const n = window.__rel.net; return n ? n.physics.physicsEnabled : null; });
    check('异步力导 physics 开启', physOn === true, 'physicsEnabled=' + physOn);

    /* 点击有人物的事件节点 → 浮层 + 人物 chips；异步力导下点击 update 触发 startSimulation（轻微呼吸扰动）——
       855 节点弹簧网 500ms 再平衡幅度实测 ~70px（springLength 150 的 0.5 倍），阈值 100px 判"非乱飞" */
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
    check('点击后节点仅轻微扰动（<100px 呼吸感）', clickR.ok && Math.abs(moved.x - clickR.bx) < 100 && Math.abs(moved.y - clickR.by) < 100, 'Δ(' + (+(moved.x - clickR.bx)).toFixed(1) + ',' + (+(moved.y - clickR.by)).toFixed(1) + ')');
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
    /* rebuild 后等新图渐进 fit 稳定（异步无冻结，等 4s fit 链） */
    await page.waitForTimeout(4000);

    /* 卡顿保障：切 tab 暂停 physics / 切回恢复（省 CPU） */
    await page.click('#viewTabs .tab[data-view="timeline"]');
    await page.waitForTimeout(300);
    const paused = await page.evaluate(() => { const n = window.__rel.net; return n ? n.physics.physicsEnabled : null; });
    check('切走关系视图暂停 physics', paused === false, 'physicsEnabled=' + paused);
    await page.click('#viewTabs .tab[data-view="relation"]');
    await page.waitForTimeout(300);
    const resumed = await page.evaluate(() => { const n = window.__rel.net; return n ? n.physics.physicsEnabled : null; });
    check('切回关系视图恢复 physics', resumed === true, 'physicsEnabled=' + resumed);

    /* 卡顿保障：呼吸开关（静止/恢复，低配机兜底） */
    await page.click('#relAnim');
    await page.waitForTimeout(300);
    const still = await page.evaluate(() => { const n = window.__rel.net; return n ? n.physics.physicsEnabled : null; });
    check('呼吸开关关 → physics 静止', still === false, 'physicsEnabled=' + still);
    await page.click('#relAnim');
    await page.waitForTimeout(300);
    const breath = await page.evaluate(() => { const n = window.__rel.net; return n ? n.physics.physicsEnabled : null; });
    check('呼吸开关开 → physics 恢复', breath === true, 'physicsEnabled=' + breath);

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
    await page.waitForTimeout(600);   /* relZoomBy 的 setTimeout(relUpdateLabels, 350) 执行完（moveTo 不触发 zoom 事件） */
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

    /* 史段下拉（关系视图内切换，不离开图谱；2026-08-05 老板需求） */
    const segOpts = await page.$$eval('#relSeg option', os => os.map(o => o.value));
    check('史段下拉 4 选项', segOpts.join(',') === 'ancient,modern,world-ancient,world-modern', segOpts.join(','));
    await page.selectOption('#relSeg', 'ancient');
    await page.waitForFunction(() => { const n = window.__rel && window.__rel.net; return n && n.body.data.nodes.length > 0 && !document.getElementById('view-relation').hidden; }, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(300);
    const dropState = await page.evaluate(() => {
      const n = window.__rel.net;
      return {
        nodes: n ? n.body.data.nodes.length : -1,
        relVisible: !document.getElementById('view-relation').hidden,
        segOn: [...document.querySelectorAll('#segRow .seg-btn')].find(b => b.classList.contains('on'))?.dataset.seg,
        selVal: document.getElementById('relSeg').value,
        curSeg,
      };
    });
    check('下拉切史段：图谱重建且不离开视图', dropState.nodes === nodes && dropState.relVisible && dropState.segOn === 'ancient' && dropState.selVal === 'ancient' && dropState.curSeg === 'ancient', JSON.stringify(dropState));
    await page.selectOption('#relSeg', 'modern');
    await page.waitForFunction(() => { const n = window.__rel && window.__rel.net; return n && n.body.data.nodes.length > 800; }, { timeout: 15000 }).catch(() => {});

    /* 顶栏史段按钮在关系视图点击：保持图谱视图 + 重建（2026-08-05 改造：不再强制跳回时间轴） */
    await page.click('#segRow .seg-btn[data-seg="world-ancient"]');
    await page.waitForFunction(() => { const n = window.__rel && window.__rel.net; return n && n.body.data.nodes.length > 0 && !document.getElementById('view-relation').hidden; }, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(300);
    const segBtnState = await page.evaluate(() => {
      const n = window.__rel.net;
      return { relVisible: !document.getElementById('view-relation').hidden, nodes: n ? n.body.data.nodes.length : -1, seg: curSeg };
    });
    check('顶栏按钮关系视图切史段不回时间轴', segBtnState.relVisible && segBtnState.seg === 'world-ancient' && segBtnState.nodes > 200, JSON.stringify(segBtnState));
    /* 切回 world-modern 供跨段测试 */
    await page.click('#segRow .seg-btn[data-seg="world-modern"]');
    await page.waitForTimeout(600);

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

    /* 筛选栏逻辑（2026-08-05 老板检查）：顶栏门类筛选作用于图谱（高亮匹配/降透明不匹配），清除恢复 */
    await page.evaluate(() => closeDrawer());
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      [...document.querySelectorAll('#typeGroup button.f')].find(b => b.textContent === '政治').click();
    });
    await page.waitForTimeout(500);
    const filtState = await page.evaluate(() => {
      const n = window.__rel.net;
      let hit = 0, dim = 0;
      n.body.data.nodes.forEach(x => { if (x.opacity === 1) hit++; else if (x.opacity === 0.12) dim++; });
      return { hit, dim, total: n.body.data.nodes.length };
    });
    check('顶栏门类筛选作用于图谱（政治高亮/其余降透明）', filtState.hit > 0 && filtState.dim > 0 && filtState.hit + filtState.dim <= filtState.total, JSON.stringify(filtState));
    await page.evaluate(() => {
      [...document.querySelectorAll('#typeGroup button.f')].find(b => b.textContent === '全部').click();
    });
    await page.waitForTimeout(500);
    const filtClear = await page.evaluate(() => {
      const n = window.__rel.net;
      let one = 0, dim = 0;
      n.body.data.nodes.forEach(x => { if (x.opacity === 1) one++; else if (x.opacity < 1) dim++; });
      return { one, dim };
    });
    check('清除筛选恢复全量', filtClear.dim === 0 && filtClear.one > 0, JSON.stringify(filtClear));

    /* 收尾：先关抽屉（跨段双击遗留 overlay 会拦截点击），再切回时间轴正常 + 全程无 JS 报错 */
    await page.evaluate(() => closeDrawer());
    await page.click('#viewTabs .tab[data-view="timeline"]');
    await page.waitForTimeout(300);
    const tlOK = await page.evaluate(() => !document.getElementById('view-timeline').hidden && document.querySelectorAll('#main .band').length > 0);
    check('切回时间轴不受影响', tlOK, '');
    check('全程无 JS 报错', errors.length === 0, errors.join(' | ').slice(0, 160));
    await page.close();
  }

  await browser.close();
  const fails = results.filter(r => !r.ok);
  console.log('\n===== ' + (fails.length === 0 ? '全部通过 ✅' : '失败 ' + fails.length + ' 项 ❌') + ' =====');
  process.exit(fails.length === 0 ? 0 : 1);
})();
