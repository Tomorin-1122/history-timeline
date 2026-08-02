# 考研古代史时间轴（history-timeline）

考研 313 中国史「时间线」复习工具：从朱绍侯《中国古代史》（15 章，1840 年前）按章提取可考事件，以三视图（时间轴 / 时空地图 / 翻牌复习）呈现。**本地 file:// 双击即开，无需构建。**

> 方向基准（2026-08-02）：纯本地 · 数据优先 · 无需 Vercel 部署 · 无需地图商业 key · 视觉最低优先

## 快速开始

双击 `index.html` 即可（file:// 下运行，依赖 jsdelivr CDN 加载字体与 Leaflet，需联网）。

## 目录结构

```
history-timeline/
├── index.html          # 入口（结构骨架 + script 引用）
├── css/app.css         # 全部样式
├── js/
│   ├── data.js         # 事件数据 + 15 章定义（gen_data.js 产出，勿手改）
│   ├── common.js       # 工具函数（fmt/stars/matchEvent/wgs84ToGcj02）
│   ├── timeline.js     # 时间轴视图（渲染/筛选/抽屉/章节回顶）
│   ├── map.js          # 地图视图（Leaflet/滑块/播放）
│   ├── review.js       # 复习模式（三模式/错题重练）
│   ├── app.js          # 视图切换/全局绑定
│   ├── gen_data.js     # 数据管道：pilot JSON → data.js
│   └── check_data.js   # 数据质量关卡（回归资产）
├── data/
│   ├── *_pilot_*.json  # 各章提取的数据源（录入产物）
│   ├── coords_demo.json# 打样坐标缓存（F3 前临时）
│   └── obsolete/       # 废弃文件隔离区（不纳入 git）
├── demo/               # 打样历史资产（demo.html / demo2.html）
├── scripts/            # 数据录入辅助脚本（合并/年份核对/坐标解析）
├── tests/acceptance/   # Playwright 回归脚本
└── docs/               # 需求文档 / 开工文档 / 提取提示词 / 交接包
```

## 数据录入流程（每章）

```
① LLM 提取（分块 _xxx_pK.json）→ scripts/merge_blocks.py 合并校验 → 产出 data/第NN章_pilot_YYYYMMDD.json
② js/gen_data.js 的 PILOTS 加一行
③ node js/gen_data.js && node js/check_data.js
④ NODE_PATH="$(npm root -g)" node tests/acceptance/regression.js
⑤ git add -A && git commit
```

## 事件 Schema（17 字段 + 2 扩展）

`title / year / yearMode / yearRange / dynasty / period / type / importance / summary / cause / effect / examTip / people / location / tags / related / wikiSlug`

扩展字段：`era`、`eraSub`（yearMode=era 时的时代段描述；录入提示词已要求回填，旧试点待复核回填）。

字段语义与判定规则见 `docs/提取事件提示词.md`。

## 里程碑状态

| 阶段 | 内容 | 状态 |
|------|------|------|
| F0 | 工程化重构（多文件 + data.js + 数据管道） | ✅ 2026-08-02 完成，回归 28/28 |
| F1 | 数据生产（试点 116 条：原始社会/战国/元代；待续 12 章） | ⏸ 待命（老板指示暂停录入） |
| F2 | 全库合并 + 集成质量关卡 | ⏸ 待命（管道已就绪） |
| F3 | 坐标正式化（CHGIS + 高德地理编码） | ⏸ 待命（脚本框架已备） |
| F4 | 视觉风格定稿 | ⏸ 最低优先 |
| F5 | 部署（GitHub/Vercel/天地图 tk） | ⏸ 暂缓（数据成型后再说） |

## 验收

```bash
cd history-timeline
node js/check_data.js                        # 数据关卡
NODE_PATH="$(npm root -g)" node tests/acceptance/regression.js   # 功能回归
```
