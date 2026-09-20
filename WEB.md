# CHAR//FORGE — 站点与分发说明

展示并分发本仓库两类产物的纯静态站点：`skills/` 下的角色构建器，与 `char/` 下的角色设定卡。站点已从 `web/` 扁平化到仓库根目录，发布根 = 仓库根。

## 运行

```bash
pip install -r requirements.txt   # 构建依赖：pypinyin（汉字转拼音，MIT）
python build_data.py
python -m http.server 8765
# 访问 http://localhost:8765
```

站点走 HTTP，前端通过 `fetch('index.json')` 获取资源索引，不再使用内联 `data.js`。本地预览前必须先运行 `build_data.py` 生成 `index.json` 与 `downloads/`。

> `pypinyin` 是**构建期硬依赖**（缺了直接报错，不静默降级）。只做本地预览（`python -m http.server`）不需要装任何东西。

## 目录结构

```text
/
├── index.html            # 唯一入口：5 分区全屏滚动（首页 / 构建器 / 角色库 / 问答 / 致谢声明）
├── index.json            # 构建产物：站点 + Agent 共用索引（元数据 / 文件清单 / sha256 / ZIP 地址）
├── downloads/            # 构建产物：skills/<slug>.zip、char/<slug>.zip（含 assets 图片）· 不入库
├── skills/               # 唯一可编辑源：角色构建器
├── char/                 # 唯一可编辑源：角色卡（10 个设定文件 + assets/，保持纯净）
├── meta/                 # 唯一可编辑源：角色展示元数据，一人一文件 meta/<slug>.json
├── thumbnails/           # 角色卡方形缩略图，按 <slug>/ 分目录（社区采集，出处见该目录 README）
├── build_data.py         # 扫描 meta/、skills/、char/、thumbnails/，生成 index.json 与 downloads/，并给 index.html 盖章
├── requirements.txt      # 构建期依赖
├── netlify.toml          # Netlify：pip install -r requirements.txt && python3 build_data.py，publish = "."
├── tools/
│   └── vendor_dl.py      # 从上游重新剪贴 js/vendor/ 里的算法，便于审计
├── js/
│   ├── i18n.js           # 中英双语词条 + 语言切换
│   ├── config.js         # 站点配置：页脚社交链接
│   ├── data-loader.js    # fetch('index.json') 并以 window.SITE_DATA 暴露
│   ├── download.js       # 单文件直下 + ZIP 下载（优先静态 ZIP，缺失时浏览器现场打包）
│   ├── agent-install.js  # 生成“复制给 Agent”的安装提示词
│   ├── carousel.js       # 角色卡环形轮播 + 角色索引面板（两级定位 / 三段检索 / 模糊兜底）
│   ├── loader.js         # 启动遮罩，等待 window load 与 index.json
│   ├── fullpage.js       # 全屏滚动框架
│   ├── main.js           # 装配：统计数字、文件表、Q&A、下载与跳转委托
│   └── vendor/
│       └── damerau-levenshtein.js   # 第三方算法（talisman，MIT，算法未改动）
├── css/                  # 设计令牌与分块样式
├── image/                # 站点图标
├── _溯源/                # 构建期素材缓存与裁定记录 · 不入库
├── README.md / README.en.md
└── WEB.md                # 本文件
```

## 数据流水线

```bash
python build_data.py
```

**输入**：`meta/*.json`（角色展示元数据）、`skills/`、`char/`、`thumbnails/`。

**输出**：

- `index.json`
  - 顶层：`generatedAt`、`skills[]`、`chars[]`；
  - 每项：`slug`、`name`、`files[]`、`archive`，以及由 meta 透传或推导的展示字段；
  - 每个文件：`name`、`size`、`sha256`、`url`（站点根相对路径）；
  - `archive`：`url`、`size`、`sha256`，指向含图片的完整 ZIP。
- `downloads/skills/<slug>.zip`
- `downloads/char/<slug>.zip`
- `index.html` 的两处盖章：资源 `?v=` 哈希与版本号（见下节）。

`downloads/` 与 `_溯源/` 是构建产物 / 本地目录，已加入 `.gitignore`；Netlify 构建时自动生成。`index.json` **需要提交**，供无构建步骤的静态托管与 Agent 读取。

### 构建期自动派生 / 自动盖章的四件事

这些都不需要人工维护——它们原先都是手工步骤，而手工步骤必然会被忘掉（页脚版本号就曾一路停在 `26.09.14`）。

| 项目 | 说明 |
|---|---|
| **版本号** | 把 `index.html` 里两处 `VER YY.MM.DD`（开屏 + 页脚）改写成**构建当天日期**。日期制版本没有需要人工决定的信息，构建日即发版日。想手工指定：先改 `index.html` 再构建，脚本只在日期不一致时改写 |
| **资源戳** | 给 `index.html` 的 `js/`、`css/` 引用补 `?v=<SHA256 前 8 位>`。文件一变 URL 就变，避免浏览器复用旧脚本（症状是「新 HTML + 旧 JS」：界面元素在、渲染逻辑与文案缺失） |
| **拼音与排序键** | 从 meta 的中英名字、作品名、公司名推导 `pinyin` / `pinyinInitials`，并把中文排序键写入 `sort["zh-CN"]`。后者让中文排序不再依赖浏览器对 `zh` 的 collation（ICU 构造失败会静默退化成码点序） |
| **字段校验** | meta 缺 `name`、JSON 不合法、`char/<slug>/` 不存在、`reading` 音节数与汉字数不符——一律直接报错，不产出半成品 |

### 产物的可复现性

同一份源码在同一天重复构建，`index.json` 与各 ZIP 的 sha256 **完全一致**。由三条保证：

1. ZIP 条目时间戳固定为 `1980-01-01`（`zipfile.writestr` 传字符串名会取「当前时间」，每次构建字节都不同）；
2. ZIP 条目权限位固定 `0o644`，不受 umask / 平台默认值影响；
3. 文本资源取哈希前把行尾归一化为 LF，且 ZIP 内的 Markdown 也统一为 LF（`core.autocrlf` 会让「哪些文件是 CRLF」随检出历史漂移）。

验证方式：连跑两次 `python build_data.py`，`git status` 应无输出。

## 发布流程

```bash
# 在仓库根目录
pip install -r requirements.txt   # 首次或依赖变更时
python build_data.py              # 生成 index.json / downloads/，并给 index.html 盖版本号与资源戳
git add -A && git commit && git push
```

Netlify 会在推送后自动跑 `pip install -r requirements.txt && python3 build_data.py` 并发布仓库根。

### 新增一个角色

1. 建交付目录 `char/<slug>/`：10 个设定文件 + `assets/`（保持纯净，不放任何工作文件）
2. 建 `meta/<slug>.json`：展示元数据。slug 取文件名、交付目录由它推出，两者都不用在 JSON 里重复写
3. 可选：`thumbnails/<slug>/cover.*` 方形缩略图
4. 跑一次 `python build_data.py`

**不用改任何代码。** 字段含义见 [README 的「新增角色」](README.md#角色一览)一节。

## 交互机制

- **下载**：全部委托 `main.js` 的全局点击代理。
  - `data-file-dl="<slug>/<file>"` → `download.js` 直接指向根目录静态文件；
  - `data-download-zip="<slug>"` → 优先使用 `entry.archive.url` 静态 ZIP；HEAD 不存在时由浏览器抓取全部文件（含图片）现场打包。
- **数据加载**：`data-loader.js` 提供 `window.SiteData.load()`；`loader.js` 等待该 Promise 完成后才完成开屏；`main.js` 在数据就绪后渲染统计、文件表与角色轮播。
- **全屏导航**：顶栏与右侧刻度统一走 `FullPage.goToSection()`；顶栏会 `preventDefault` 阻止默认锚点跳转，动画中再次点击会记录 `pendingIndex`，当前动画结束后补跳，避免卡在中间或跳到错误分区。
- **复制至 Agent 安装**：`agent-install.js` 根据 `index.json` 生成安装 Prompt；构建器面板与角色卡都有入口。
- **角色缩略图**：`build_data.py` 扫描 `thumbnails/<slug>/`，优先取 `cover.*` / `thumbnail.*`，把 URL 写入 `index.json` 的 `thumbnail` 字段；没有图片时前端显示 `NO IMG` 占位块。
- **角色图片**：`char/<slug>/assets/` 直接位于站点根，ZIP 与 Agent 下载都指向同一份源文件，不再单独维护 `web/assets`。

## 角色索引：定位与检索

索引面板位于「角色库」分区，结构为「搜索框 → 两级定位索引 → 角色卡网格」。

**两级定位索引**：一级公司、二级作品，两级各带实时计数与「全部」回退。只点一级即筛选该公司全部角色，再点二级收窄到该公司该作品；二级栏仅在该公司定义了 `work` 时出现（单层公司不出现）。选中公司时二级自动归位，避免带着上一个公司的作品筛。

**三段式检索**（每段都保留展示顺序，不做相关性重排）：

| 段 | 覆盖 | 实现位置 |
|---|---|---|
| ① 精确 / 前缀 / 片段 / 分词 | 中文名、英文名、全拼与首字母、作品、公司、来源、标签；中文按任意长度子串匹配 | `carousel.js` `hitIn()` |
| ② 去分隔符重试 | 分写或带连字符的拼音（`pei li ka`） | `stageCompact()` |
| ③ 兜底候选 | 先 Damerau-Levenshtein（错字 / 漏字 / 换位 / 同音字 / 繁体），零候选时再用子序列（跳字缩写、首字母尾片段）。**只出「你是不是想找」候选，不进入结果列表** | `dlCandidates()` / `subseqCandidates()` |

两条安全边界：DL 按查询长度自适应阈值（≤2 字不放行 / 3–5 字距离 1 / ≥6 字距离 2）；两条兜底都只在①②零命中时触发——所以 `zzz` 什么都不命中，`ys` 也不会被 `lys` 这类首字母串吃掉。

**检索键的分组**（`searchOf()`）：通用字段（名称 / 来源 / 标签 / 首字母）拉丁子串需 ≥3 位；纯全拼字段放宽到 ≥2 位（`yu` → 大肥鱼）。分组的原因：全拼串里的短子串是「一个音节的一部分」，语义清晰；首字母串里的短子串是「跨两个字声母的偶然相邻」（`ys` ⊂ `lys`），只会制造误匹配。

`localeVals()` 遇到值是数组时（`tags` 就是这种结构）必须**摊平成独立条目**，不能 `String()` 成 `a,b,c`——那会拼出一个大长串，让子串 / 子序列跨越本不相邻的字段乱命中。

## 文案与配置

- 界面文案集中在 `js/i18n.js`（`data-i18n="key"`）。
- 页脚社交链接在 `js/config.js` 的 `SITE_CONFIG.socials`。
- Q&A 条目按 `qa.<n>.q/a` 渲染，循环上限见 `js/main.js`。
- 页脚「资源用途 / 版权归属 / 免责声明」三张声明卡同样走 `declare.*` 词条，改动它们等于改动对外声明，请谨慎。

## 署名

- 视觉语言：[终末地风格 SKILL（Endfield-Style-Skill）](https://github.com/LaoBiDeng321/Endfield-Style-Skill)
- 界面审美：[taste-skill](https://github.com/Leonxlnx/taste-skill)
- 模糊匹配：[talisman](https://github.com/yomguithereal/talisman)（`metrics/damerau-levenshtein.js`，MIT，vendor 至 `js/vendor/`，算法未改动，可由 `tools/vendor_dl.py` 重新剪贴）
- 汉字注音：[pypinyin](https://github.com/mozillazg/python-pinyin)（MIT，构建期使用，不进运行时）
- 维护者：[LaoBiDeng321](https://github.com/LaoBiDeng321)（个人维护，无维护组）
