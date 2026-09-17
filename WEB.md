# CHAR//FORGE — 站点与分发说明

展示并分发本仓库两类产物的纯静态站点：`skills/` 下的角色构建器，与 `char/` 下的角色设定卡。站点已从 `web/` 扁平化到仓库根目录，发布根 = 仓库根。

## 运行

```bash
python build_data.py
python -m http.server 8765
# 访问 http://localhost:8765
```

站点走 HTTP，前端通过 `fetch('index.json')` 获取资源索引，不再使用内联 `data.js`。本地预览前必须先运行 `build_data.py` 生成 `index.json` 与 `downloads/`。

## 目录结构

```text
/
├── index.html            # 唯一入口：5 分区全屏滚动（首页 / 构建器 / 角色库 / 问答 / 致谢声明）
├── index.json            # 构建产物：站点 + Agent 共用索引（元数据 / 文件清单 / sha256 / ZIP 地址）
├── downloads/            # 构建产物：skills/<slug>.zip、char/<slug>.zip（含 assets 图片）
├── skills/               # 唯一可编辑源：角色构建器
├── char/                 # 唯一可编辑源：角色卡（含 assets/ 图片）
├── thumbnails/           # 角色卡方形缩略图，按 <slug>/ 分目录
├── build_data.py         # 扫描 skills/、char/、thumbnails/，生成 index.json 与 downloads/
├── netlify.toml          # Netlify：python3 build_data.py + publish = "."
├── js/
│   ├── i18n.js           # 中英双语词条 + 语言切换
│   ├── config.js         # 站点配置：页脚社交链接
│   ├── data-loader.js    # fetch('index.json') 并以 window.SITE_DATA 暴露
│   ├── download.js       # 单文件直下 + ZIP 下载（优先静态 ZIP，缺失时浏览器现场打包）
│   ├── agent-install.js  # 生成“复制给 Agent”的安装提示词
│   ├── carousel.js       # 角色卡环形轮播，使用 index.json 中的文件大小与复制按钮
│   ├── loader.js         # 启动遮罩，等待 window load 与 index.json
│   ├── fullpage.js       # 全屏滚动框架
│   └── main.js           # 装配：统计数字、文件表、Q&A、下载与跳转委托
├── css/                  # 设计令牌与分块样式
├── image/                # 站点图标
└── WEB.md                # 本文件
```

## 数据流水线

```bash
python build_data.py
```

输出：

- `index.json`
  - 顶层：`generatedAt`、`skills[]`、`chars[]`；
  - 每项：`slug`、`name`、`files[]`、`archive`；
  - 每个文件：`name`、`size`、`sha256`、`url`（站点根相对路径）；
  - `archive`：`url`、`size`、`sha256`，指向含图片的完整 ZIP。
- `downloads/skills/<slug>.zip`
- `downloads/char/<slug>.zip`

`downloads/` 是构建产物，已加入 `.gitignore`；Netlify 构建时自动生成。`index.json` 需要提交，供无构建步骤的静态托管与 Agent 读取。

## 交互机制

- **下载**：全部委托 `main.js` 的全局点击代理。
  - `data-file-dl="<slug>/<file>"` → `download.js` 直接指向根目录静态文件；
  - `data-download-zip="<slug>"` → 优先使用 `entry.archive.url` 静态 ZIP；HEAD 不存在时由浏览器抓取全部文件（含图片）现场打包。
- **数据加载**：`data-loader.js` 提供 `window.SiteData.load()`；`loader.js` 等待该 Promise 完成后才完成开屏；`main.js` 在数据就绪后渲染统计、文件表与角色轮播。
- **全屏导航**：顶栏与右侧刻度统一走 `FullPage.goToSection()`；顶栏会 `preventDefault` 阻止默认锚点跳转，动画中再次点击会记录 `pendingIndex`，当前动画结束后补跳，避免卡在中间或跳到错误分区。
- **复制至 Agent 安装**：`agent-install.js` 根据 `index.json` 生成安装 Prompt；构建器面板与角色卡都有入口。
- **角色缩略图**：`build_data.py` 扫描 `thumbnails/<slug>/`，优先取 `cover.*` / `thumbnail.*`，把 URL 写入 `index.json` 的 `thumbnail` 字段；没有图片时前端显示 `NO IMG` 占位块。
- **索引面板 / 排序**：角色排序逻辑仍在 `carousel.js`，使用 `index.json` 中的 `name`、`nameEn`、`alias`、`sort` 字段。
- **角色图片**：`char/<slug>/assets/` 直接位于站点根，ZIP 与 Agent 下载都指向同一份源文件，不再单独维护 `web/assets`。

## 文案与配置

- 界面文案集中在 `js/i18n.js`（`data-i18n="key"`）。
- 页脚社交链接在 `js/config.js` 的 `SITE_CONFIG.socials`。
- Q&A 条目按 `qa.<n>.q/a` 渲染，循环上限见 `js/main.js`。

## 署名

- 视觉语言：[终末地风格 SKILL（Endfield-Style-Skill）](https://github.com/LaoBiDeng321/Endfield-Style-Skill)
- 维护者：[LaoBiDeng321](https://github.com/LaoBiDeng321)（个人维护，无维护组）
