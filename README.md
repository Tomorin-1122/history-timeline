# 考研古代史时间轴（history-timeline）

考研 313 中国史「时间线」复习工具：从朱绍侯《中国古代史》（15 章，1840 年前）按章提取可考事件，以三视图（时间轴 / 时空地图 / 翻牌复习）呈现。**本地 file:// 双击即开，无需构建。**

> 方向基准（2026-08-02）：纯本地 · 数据优先 · 无需 Vercel 部署 · 无需地图商业 key · 视觉最低优先

## 快速开始

双击 `index.html` 即可（file:// 下运行，依赖 jsdelivr CDN 加载字体与 Leaflet，需联网）。此模式**只读**。

## 本地可视化编辑（维护数据用）

编辑/新增/删除历史事件需走本地服务（file:// 下浏览器不能写文件）：

```bash
# 方式一：双击 启动.bat（起服务 + 自动开页面 http://localhost:3099）
# 方式二：命令行 node server.js

# 页面右上角「编辑」进入编辑模式：
#   ＋ 新增事件（选章节，19 字段表单）
#   点事件行 → 抽屉底部 ✎ 编辑 / ✕ 删除（删除有二次确认）
# 保存后自动写回 data/*_pilot_*.json → 重建 js/data.js → 刷新生效（git 可追踪）
```

- 只支持已有章节（原始社会/夏商/西周/春秋/战国/秦/西汉/元代；录入新章后 server.js 的 PILOTS 同步加行）
- 日常查看/复习仍双击 `index.html`，无需起服务

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

`type` 枚举 7 类：**政治 / 军事 / 经济 / 文化 / 制度 / 民族关系 / 对外关系**（2026-08-03 扩展；民族=境内政权交往治理、对外=外国交往；纯外国内政不收）。

扩展字段：`era`、`eraSub`（yearMode=era 时的时代段描述；录入提示词已要求回填，旧试点待复核回填）。

字段语义与判定规则见 `docs/提取事件提示词.md`。

## 里程碑状态

| 阶段 | 内容 | 状态 |
|------|------|------|
| F0 | 工程化重构（多文件 + data.js + 数据管道） | ✅ 2026-08-02 完成 |
| F1 | 数据生产（12 章 563 条：原始社会→唐 + 元；待续 3 章：五代宋辽夏金/明/清） | ⏸ 进行中 |
| F2 | 全库合并 + 集成质量关卡（12 章已接入，check_data PASS） | ⏸ 待收尾 |
| F3 | 坐标正式化（CHGIS + 今址表兜底：coords_resolved 217 条、coords_modern 196 键） | ⏸ 部分完成 |
| F4 | 视觉风格定稿 | ⏸ 最低优先 |
| F5 | 部署（GitHub/Vercel/天地图 tk） | ⏸ 暂缓（数据成型后再说） |

## 地图交互特性（2026-08-03 迭代）

- **双时间轴完全隔离**：原始社会（史前对数刻度）/ 历史时期（-2070~1840）事件不串门
- **连续播放 + keepN**：播放时屏幕保留最近 N 个事件（10/5/3/2/1 可切），旧的渐透明、最新加粗置顶、事件到真实年份才出现（不提前）
- **倍速 6 档**：1×/2×/4×/8×/0.5×/0.1×（播放时细 step 防钳制）
- **步进按钮 ◀▶**：精准上一个/下一个事件（随章/门类/等第/搜索筛选联动）
- **分期筛选按章过滤**：顶栏分期链接点按章只显示该章事件
- **全屏沉浸式**：⛶ 隐藏顶栏/页脚，仅地图占满

## 验收

```bash
cd history-timeline
node js/check_data.js                        # 数据关卡
NODE_PATH="$(npm root -g)" node tests/acceptance/regression.js   # 功能回归
```
