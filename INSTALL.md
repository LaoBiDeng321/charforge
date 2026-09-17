# 资源位置与 Agent 安装说明

站点已从 `web/` 扁平化到仓库根目录，发布根 = 仓库根。本文件只做位置说明，不再保留第二份可编辑副本。

## 唯一可编辑源

- 构建器：`skills/<slug>/`
- 角色卡：`char/<slug>/`（含 `assets/` 图片）

## 构建产物

运行：

```bash
python build_data.py
```

会生成：

- `index.json`：站点与 Agent 共用的索引，包含元数据、文件清单、文件 URL、sha256、ZIP 地址。
- `downloads/skills/<slug>.zip`：构建器完整包。
- `downloads/char/<slug>.zip`：角色完整包，包含 Markdown 与 `assets/` 图片。

`downloads/` 是构建产物，已加入 `.gitignore`；Netlify 构建时会自动生成。本地预览前请先执行一次构建脚本，然后用：

```bash
python -m http.server 8765
```

访问 `http://localhost:8765`。

## Agent 安装入口

优先给 Agent 索引地址：

```text
https://lbd-charforge.netlify.app/index.json
```

或直接给某个角色的完整 ZIP：

```text
https://lbd-charforge.netlify.app/downloads/char/shu-arknights.zip
```

Agent 安装流程建议：

1. 下载 ZIP；
2. 校验 `index.json` / manifest 中的 sha256；
3. 解压到自己的技能目录，保持 `<slug>/` 与 `assets/` 结构；
4. 读取 `SKILL.md` 后开始使用。

## 不要直接编辑

不要直接修改 `index.json` 或 `downloads/` 下的文件；它们由 `build_data.py` 从 `skills/`、`char/` 生成。
