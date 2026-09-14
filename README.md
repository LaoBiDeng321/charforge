# CHAR//FORGE — 角色构建器工坊

一套"产出角色扮演设定"的 Agent Skill 体系：两个构建器 skill + 由它们产出的角色设定卡 + 一个 GitHub Pages 宣传站。

- **构建器（skills/）**：喂给支持 Skill 的 agent，agent 会按"搜索 → 整理查证 → 产出"三阶段，为指定角色生成 10 个各司其职的扮演设定文件
- **角色（char/）**：用构建器产出并核定的角色卡成品，可直接用于 AI 扮演（角色扮演 prompt 工程）
- **网站（web/）**：资源展示与下载的宣传页，GitHub Pages 部署后即是本项目主页

## 仓库结构

```
角色skill/
├── index.html              # GitHub Pages 根入口：meta refresh 跳转到 web/index.html
├── SKILL.md                # 项目元 skill（工作流总纲，不随网站展示）
├── build_data.py           # 扫描 skills/ 与 char/，生成 web/js/data.js（网站数据源）
├── skills/
│   ├── character-profile-builder/   # 官方角色构建器（SKILL.md + reference/templates.md）
│   └── original-character-builder/  # 原创角色构建器（同上结构）
├── char/
│   ├── deepseek-fish/      # 吃白饭的大肥鱼（DeepSeek 社区拟人）
│   ├── shu-arknights/      # 黍（明日方舟）
│   ├── citlali/            # 茜特菈莉（原神）
│   ├── priestess/          # Priestess
│   └── alf/                # Alf
└── web/                    # 宣传站（纯静态，详见 web/README.md）
```

## 使用构建器

1. 把 `skills/<构建器>/` 整个目录装入支持 Skill 的 agent（或将其中的 SKILL.md 内容粘贴给模型）
2. 按其 SKILL.md 的引导发起请求，例如"为《明日方舟》的黍构建角色扮演设定"
3. agent 将经历三阶段：素材搜索（分维度缓存落盘）→ 矛盾查证 → 分批产出 10 文件到 `char/<slug>/`

两种构建器的差异与共同规则见各自 SKILL.md；10 个设定文件"为什么存在、归属边界、章节取舍"统一定义在 `skills/*/reference/templates.md`，此处不重复。

**产出文件体系**（每个角色目录下）：`prompt.md`（自我认同内核）、`world.md`、`profile.md`、`memory.md`、`personality.md`、`behavior.md`、`relations.md`、`interaction.md`、`conflicts.md` + `SKILL.md`（该角色的运行规则）。角色目录如含 `assets/`（官方立绘），供多模态模型加载外貌认知，非文件体系计数成员。

## 宣传站

- **本地预览**：双击根 `index.html`（自动进入 `web/`），或 `python -m http.server 8765 --directory web`
- **内容更新**：`char/` 或 `skills/` 增删文件后，在仓库根运行 `python build_data.py`，网站展示与下载自动同步（零代码改动）
- **GitHub Pages 部署**：Settings → Pages → Branch 选 `main` + `/(root)` 即可，根 index 会重定向到宣传页
- 功能与维护细节（轮播、索引检索、下载、双语、Subgrid 对齐等）见 [web/README.md](web/README.md)

## 署名

- 视觉语言：[Endfield-Style-Skill（终末地风格 SKILL）](https://github.com/LaoBiDeng321/Endfield-Style-Skill)
- 维护者：[LaoBiDeng321](https://github.com/LaoBiDeng321)（个人维护）

## 版权声明

两个构建器 skill 与网站代码遵循本仓库声明，欢迎学习与转载（注明来源）。`char/` 下角色设定素材的版权归各自原作版权方所有；本仓库产出仅用于社区扮演与学习交流，不作商业用途。
