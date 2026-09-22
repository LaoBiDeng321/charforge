# 快速开始

> 项目层 · 索引类。跑起来 → 构建 → 发布 → 加角色 → 验证。

## 跑起来（只预览）

```bash
git clone https://github.com/LaoBiDeng321/charforge && cd charforge
python -m http.server 8765
# 浏览器打开 http://localhost:8765
```

不需要装任何依赖。

## 构建

```bash
pip install -r requirements.txt   # pypinyin + tokenizers + Pillow（构建期硬依赖，缺了直接报错）
python build_data.py
```

**输入**：`meta/*.json`、`skills/`、`char/`、`thumbnails/`、`gallery/`

**输出**：
- `index.json` —— 站点与 Agent 共用索引（元数据 / 文件清单 / sha256 / ZIP 地址 / Token 预估 / **首屏画廊图池**）
- `downloads/skills/<slug>.zip` · `downloads/char/<slug>.zip`
- `index.html` 的两处盖章：版本号 + 资源 `?v=` 哈希

前端用 `fetch('index.json')` 取索引，所以**预览前要先构建一次**。

> `index.json` **需要提交**（无构建步骤的静态托管与 Agent 读取都靠它）；`downloads/` 是构建产物，不入库，Netlify 构建时自动生成。
> **不要直接改** `index.json` 或 `downloads/` 里的文件——它们由脚本从 `skills/`、`char/` 生成。

实现细节（版本号/资源戳怎么盖、字段怎么校验、为什么能复现）见 `build_data.py` 头部注释。

## 发布

```bash
python build_data.py
git add -A && git commit && git push
```

Netlify 推送后自动跑 `pip install -r requirements.txt && python3 build_data.py` 并发布仓库根（配置见 `netlify.toml`）。

## 加一个角色

1. 建交付目录 `char/<slug>/`：10 个设定文件 + `assets/`（保持纯净）
2. 建 `meta/<slug>.json`：展示元数据（字段见 [`META.md`](META.md)）
3. 可选：`thumbnails/<slug>/cover.*` 方形缩略图（**方形图归这里，不进 `assets/`**）
4. `python tools/make_gallery.py` —— 把新角色的 `assets/` 立绘切成首屏画廊瓦片（**增量**：只有变了的素材会重做，抠图模型也不会被重新拉起；口径要整批重来用 `--force`）
5. `python build_data.py`（第 4 步在前：`index.json` 的图池是按 `gallery/` 实际文件扫出来的）

**不用改任何代码。** 第 4 步别忘：漏了不会报错，只是新角色**不会出现在首屏背景里**。

## Agent 安装入口

优先给 Agent 索引地址：

```text
https://lbd-charforge.netlify.app/index.json
```

或直接给某个角色的完整 ZIP：

```text
https://lbd-charforge.netlify.app/downloads/char/shu-arknights.zip
```

建议流程：下载 ZIP → 校验 `index.json` 里的 `sha256` → 解压到自己的技能目录（保持 `<slug>/` 与 `assets/` 结构）→ 读 `SKILL.md` 开始用。

## 改了东西之后：先问"要不要同期改别的文件"

**任何一次修改都要做一次三问**，尤其是 `char/` 这类**流程产出物**（改它等于改产物，不是改源码）：

| 问 | 怎么答 | 答"要"时就地改 |
|---|---|---|
| **① 溯源在不在？** | 这次改动有凭证吗——缓存、来源 URL、观测记录、对账结果。产物里每条事实都该能指回 `_溯源/` 或文档里的出处 | 补进 `_溯源/<slug>/`（或其 `raw/`），别只留在对话里 |
| **② 有产出约束吗？** | 这个文件是被哪份规则约束产出的？改动**违反**了它，还是**超出了**它 | 违反 → 改回来或先改规则；超出 → 说明规则已经落后于产物 |
| **③ 约束文档同期改了吗？** | 只要 ② 是"超出"，就**必须在同一次改动里更新约束文档** | 见下表——**不许留到"下次一起改"** |

### 判定表：改什么 → 还要看哪里

| 你改了 | 溯源在哪 | 约束文档在哪（超出即同期改） |
|---|---|---|
| `char/<slug>/` 任一设定文件 | `_溯源/<slug>/01`–`08`、`90` | `skills/character-profile-builder/reference/details.md` · `templates.md` |
| `char/<slug>/assets/README.md` | `_溯源/<slug>/raw/`（图片凭证） | `details.md` §七（assets 收尾） |
| `char/<slug>/assets/` 增删换图 | `_溯源/<slug>/raw/` | **`gallery/` 是它的派生**：重跑 `python tools/make_gallery.py` 再 `python build_data.py`，规则见 `gallery/README.md`（与 `thumbnails/` 内容相同的方形图会被画廊**自动跳过**——那类图归属 `thumbnails/`） |
| `gallery/exclude.json`（让某张素材不上首屏） | 理由就写在条目里（`reason` / `since`），`manifest.json` 的 `excluded` 同步留档 | `gallery/README.md`；**原图不许删**——角色卡与下载包还要用它，排除的只是"当背景展示" |
| `gallery/matte.json`（抠图例外） | 实测值记在 `manifest.json` 的 `plainRatio` / `matteForeground` | `gallery/README.md`「为什么只对『明显纯色底』抠图」· `docs/MODEL.md`；**规则在代码里，这个文件只放例外** |
| `gallery/` 里的瓦片 | `gallery/manifest.json`（源图 + sha256） | `gallery/README.md`；**手放/手改瓦片等于绕过生成器**，溯源与 `index.json` 都会对不上 |
| `tools/make_gallery.py` | git 历史 + 本次对话 | `gallery/README.md`（归一化口径变了就同步改） |
| `skills/<slug>/` 任一文件 | git 历史 + 本次对话 | 同为 `skills/<slug>/reference/`；**跨层内容见 `LAYERS.md`** |
| `build_data.py` / `js/` / `css/` | 代码注释即凭证 | `docs/LAYERS.md`（若动了交付契约）· 相关代码头部注释 |
| `docs/` 任一文件 | git 历史 | `LAYERS.md`（职责边界变动时） |

### 两条硬性要求

1. **约束与产物同一次提交**。不允许"先把产物改好，规则回头补"——回头补一定会漏；而漏掉的规则会在下一次生成时把旧格式重新产出来。（实测踩过：手改了 9 份 `assets/README.md`，产出规则却还是旧的四项，再生成就会退回旧格式。）
2. **改完跑一次验证，别靠眼睛**：
   ```bash
   python build_data.py               # 共享文件一致性 + tags 软校验
   python tools/make_gallery.py --check   # 改了 assets 时：画廊瓦片是否与源图脱节
   python _verify_zips.py             # 下载包内链接是否都落在包内
   ```
   另有两类**对账自检**只能手工做，因为它们依赖"产物 vs 实际"的比对：清单里列的文件名与目录实际文件是否一一对应；文档里写的路径是否真实存在。

> 这条纪律本身体现三层规则：**项目层（本节）写判定标准，构建器层把它落成产出流程里的自检项**——两层都写，各写各的那一半。

## 验证

```bash
python build_data.py      # 构建 + 共享文件一致性 + tags 软校验
python _verify_zips.py    # 解开每个 ZIP，按包内视角解析全部 .md 链接，报告死链
```

`_verify_zips.py` 是本地检查脚本（`_*.py` 已在 `.gitignore`）。**改完 skill 文档后建议跑一次**——它能抓出"包外链接"这类在仓库里看不出来的死链。

## 前端行为速查

| 想改什么 | 去哪 |
|---|---|
| 下载（**只有整包 ZIP** + 客户端打包兜底） | `js/download.js` + `js/main.js` 的全局点击代理 |
| 数据加载与开屏 | `js/data-loader.js` · `js/loader.js` |
| 全屏滚动导航 | `js/fullpage.js` |
| 角色轮播 · 索引检索算法 · 手机端面板缩放 | `js/carousel.js` 头部注释 |
| 首屏背景「斜向滚动画廊」（列数 / 流速 / 无缝循环 / 压暗） | `js/hero-gallery.js` 头部注释 · 参数 `js/config.js` → `gallery` · 样式 `css/fullpage.css`「Hero 背景 · 二」· 瓦片生成 `tools/make_gallery.py` |
| Token 预估展示（**仅单角色，不做全站合计**） | `js/tokens.js` 头部注释 · `build_data.py` 头部注释 |
| 界面文案 / 配置 / 声明 | `js/i18n.js` · `js/config.js` |
| 缩略图扫描与 `NO IMG` 占位 | `build_data.py` `find_thumbnail()` |

**手机端**：站点桌面优先，手机默认走 PC 视图兜住可用性（UA 判定 → viewport `width=1280` + `.view-pc`；页脚开关或 `?view=pc` / `?view=auto` 切换；记忆在 `localStorage['charforge-view']`）。决策记录见 [`MOBILE-TODO.md`](MOBILE-TODO.md)，实现见 `js/carousel.js` 头部注释。

**缩略图去底**：给 `thumbnails/<slug>/cover.*` 抠透明底用的是本机 `isnet-anime.onnx` 模型（路径、校验值、用法见 [`MODEL.md`](MODEL.md)）。换图后重跑 `python build_data.py`——脚本会给缩略图 URL 自动加 `?v=<内容哈希>`，避免浏览器继续显示旧图。

> 改动 `declare.*` 这类词条**等于改动对外声明**，请谨慎。

### 首屏（hero）纪律

1. **默认什么都不加。** 没有用户的主动要求，第一屏不新增任何元素——不补说明文字、不加小字注释、不塞免责声明。首屏只保留既有的：标题区、四个统计数字、两个入口按钮。
2. **加了就必须跟动画。** 首屏元素若不在入场动画体系里（缺 `animate-on-scroll`），它会**在页面加载瞬间直接出现**，而其余内容还在淡入——这种"不随动画的出现"在视觉上很突兀，等于破坏首屏。新加元素要么进动画序列，要么不加。
   > 顺带一个坑：`data-delay="1…5"` **只是给人看的序号**，实际间隔由 **DOM 顺序**算（`index * 110 + 120`，见 `main.js` `animateSectionElements()`）。所以增删首屏元素时**要顺手把序号重排连续**，否则会留下跳号（`1 2 4 5`），容易让人误以为漏了一项。
3. **需要声明的，放声明区。** 免责/口径类文案归 `declare.*` 词条与声明分区，**不要为了"保险"往首屏塞一句**。历史反例：曾在统计条下方加过一行 Token 预估口径小字，它没有动画、静态出现，观感突兀，最终删除。
4. **首屏文案里不要写死数量。** 角色数 / 构建器数 / 文件数都是变动值，写进文案就会过期（历史反例：`hero.description` 写过"八张成品角色卡"，加到第 9 个角色后就成了错话）。这些数字由统计条**动态**展示，文案里只用类别名（"成品角色卡"），不带数词。
5. **统计条只放"数得清的东西"。** 现在是 3 项：构建器 / 角色卡 / 设定文件——都是**离散计数**，看一眼就知道是什么。**不放聚合型估算**：曾有过第 4 项"预估 TOKENS（全站合计）"，它的量纲与前三项不同（是估算不是计数），且粒度错位——Token 预估的意义在「**单个角色包**大概占多少上下文」，把多个包加起来没有使用场景（没人会一次性把全站灌进模型），容易被误读成整站开销。故已删除，`TokenEstimate.entriesTotal` 也一并移除；**单角色**的预估仍显示在角色卡底部与角色索引里。
6. **背景画廊是用户点名要的那一个例外**（首屏唯一的位图层：斜向滚动的角色立绘瓦片）。它同样受上面各条约束，落点是：
   - **必须进入场动画**：外层挂 `animate-on-scroll`，由 `main.js` 统一渐显（第 2 条）。它是 `#hero` 里 DOM 最靠前的动画元素，因此最先淡入。
   - **纯装饰，不吃交互**：`pointer-events: none` + `aria-hidden="true"` + 瓦片 `alt=""`；不得拦点击、悬停或 Tab 焦点。
   - **不许往首屏加文字**：画廊不加标题、不加图注、不加"图源"小字（那属于声明区，见第 3 条）。
   - **可读性靠整体不透明度，不要加"让出文字区"的遮罩**：画廊压到 16% 后文字带背景实测只有 #1e~#34，白字/黄按钮对比度 12:1 以上。曾经加过一版以标题为中心的径向遮罩（中心透明、向外显影），结果外面有图、圈里没图，在近黑底上**围出一块看得见的椭圆暗斑**，用户一眼就指出来了——这类"局部让位"在近黑底上必然显形，别再加。改参数（`.hero-gallery-tilt` 的 `opacity`、瓦片 `filter`）后重新看一眼首屏。
   - **图池来自产物、不手改**：瓦片由 `tools/make_gallery.py` 从 `char/<slug>/assets/` 派生，规则与溯源见 [`../gallery/README.md`](../gallery/README.md)；观感上不适合当背景的素材走 `gallery/exclude.json`（**不动原图**）。
