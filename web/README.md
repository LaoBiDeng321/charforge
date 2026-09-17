# CHAR//FORGE — 角色资源分享站（web 子系统）

展示并分发本仓库两类产物的纯静态站点：`skills/` 下的两个角色构建器，与 `char/` 下的角色设定卡。无框架、无构建步骤、无外部依赖。

## 运行

- 本地预览：直接双击 `index.html`（file:// 协议可用），或 `python -m http.server 8765 --directory web` 后访问 `http://localhost:8765`
- 部署：整个仓库（含根目录）托管到 GitHub Pages（main 分支 + 根目录）即可；仓库根的 `index.html` 是重定向入口，`meta refresh` 跳转到本目录的 `web/index.html`，实际站点全部在本目录

## 目录结构

```
web/
├── index.html            # 唯一入口：5 分区全屏滚动（首页 / 构建器 / 角色库 / 问答 / 致谢声明）
├── build_data.py         # 位于仓库根目录：扫描 skills/ 与 char/，生成 js/data.js
├── js/
│   ├── i18n.js           # 中英双语词条 + 语言切换（localStorage 记忆）
│   ├── data.js           # 自动生成的站点数据（skill/char 元数据与文件全文），勿手改
│   ├── config.js         # 站点配置：页脚社交链接（URL + 官方品牌 SVG）
│   ├── download.js       # 下载：单文件 Blob 直下 + 纯 JS ZIP 打包（无外部库）
│   ├── carousel.js       # 角色卡环形轮播：自动播放 / 手动切换 / 索引检索面板
│   ├── loader.js         # 启动遮罩："Loading…" 渐变扫光，5s 兜底强制完成
│   ├── fullpage.js       # 全屏滚动框架：滚轮/键盘/触摸分区导航，data-scrollable 放行内部滚动
│   └── main.js           # 装配：统计数字、Skill 文件表、Q&A 渲染、下载与跳转委托
├── css/                  # 按管理范围分块
│   ├── design-system.css # 设计令牌（色彩/字体/间距/滚动入场动画基类）
│   ├── fullpage.css      # 分区框架 + 首页/页脚区块
│   ├── components.css    # 构建器双栏、Skill 面板、Q&A、声明卡
│   ├── carousel.css      # 角色卡与索引面板
│   ├── loader.css        # 启动遮罩
│   └── responsive.css    # 断点：≤1024px（双栏堆叠）/ ≤768px（移动端）
└── image/                # 站点图标：favicon.svg（品牌 // 图标，两个入口页均引用）+ 声明页三图标（其余图标均为内联 SVG）
```

## 数据流水线（内容更新入口）

站点展示的一切角色/Skill 内容都来自 `js/data.js`，由根目录脚本生成：

```bash
python build_data.py
```

- 新增角色：在 `char/<slug>/` 放入设定文件 → 重跑脚本 → 轮播与索引面板自动收录，无需改任何页面代码
- Skill 增删文件（如 reference/ 下的新参考文档）：文件落盘后重跑脚本，页面文件清单与下载自动同步
- `data.js` 为**可读输出**（2 空格缩进的多行 JSON，含全部文件全文），禁止手改；角色名/来源/标签的多语言键为 `zh-CN` / `en-US`（旧 `zh`/`en` 键在 carousel.js 中有回退兼容）
- `data.js` 中每个文件的正文以**行数组** `lines[]` 存储（全文 = `lines.join("\n")`），这样改动只产生局部 diff。**消费方必须用 `download.js` 的 `fileText(file)` 取正文**，不要直接读 `file.content`（该函数保留旧格式兼容分支）；改结构时同步改 `download.js`

## 交互机制要点（后续维护需知）

- **下载**：全部委托 `main.js` 的全局点击代理。`data-file-dl="<slug>/<file>"` 单文件直下（面板"仅下载 SKILL.md"按钮与文件行小按钮共用）；`data-download-zip="<slug>"` 由 download.js 客户端打包
- **索引面板**：角色库标题行的「全部角色」按钮打开，覆盖轮播区；检索为跨语言 includes 匹配（slug/角色名/来源/标签），点击条目 `goTo(index)` 直达卡片；打开即暂停自动播放，Esc 或关闭后恢复
- **对齐**：构建器双栏用 CSS Subgrid 共享「头部 / 按钮行 / 正文」三条行轨道（`@supports` 渐进增强，不支持时回退 flex 堆叠）；≤1024px 单列时显式还原 flex
- **全屏滚动**：分区内部可滚动区域必须带 `data-scrollable` 属性，否则滚轮/触摸会被分区导航拦截
- **file:// 兼容**：script 标签不带 `?v=` 查询参数（该协议下会解析失败）；部署到 HTTP 后如遇缓存可自行加版本参数

## 文案与配置

- 界面文案集中在 `js/i18n.js`（键名约定：`hero.*` `skills.*` `chars.*` `qa.*` `footer.*` `declare.*`；HTML 中用 `data-i18n="key"` 挂载）
- 页脚社交链接在 `js/config.js` 的 `SITE_CONFIG.socials`（顺序即渲染顺序）与 `SITE_CONFIG.icons`（官方品牌 SVG，currentColor 染色）
- Q&A 条目按 `qa.<n>.q/a` 键渲染，`main.js` 的循环上限为 9，新增条目同步扩容上限即可

## 署名

- 视觉语言：[终末地风格 SKILL（Endfield-Style-Skill）](https://github.com/LaoBiDeng321/Endfield-Style-Skill)
- 维护者：[LaoBiDeng321](https://github.com/LaoBiDeng321)（个人维护，无维护组）
