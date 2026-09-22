# 部署与运维档案

> 面向后续接手的 agent 与自部署者：记录**当前**仓库的部署链路与运维事实。
> 公开文档在 [`README.md`](README.md)、[`QUICKSTART.md`](QUICKSTART.md)、[`MAP.md`](MAP.md)；本文只记部署与运维，不重复其内容。

> **本仓库是公开仓库**：任何写入这里的运维事实都会被公开。**绝不要把账号、密码、Token、后台截图放进任何文件**（含本文）。任何"需要登录后台"的操作，优先改成仓库内配置文件方案（如 `netlify.toml`）。

## 一、部署拓扑

| 项 | 值 |
|---|----|
| 代码仓库 | `https://github.com/LaoBiDeng321/charforge`（main 分支） |
| 部署平台 | Netlify（Git-based 自动部署，连接上述仓库） |
| 线上地址 | `https://lbd-charforge.netlify.app/`（根路径即网站本体） |
| 发布目录 | **仓库根**（`netlify.toml`：`publish = "."`，并对 production / deploy-preview / branch-deploy 三种上下文各显式覆盖一次） |
| 构建命令 | `pip install -r requirements.txt && python3 build_data.py` |

**发布机制**：push 到 `main` → Netlify 检测变更 → 按 `netlify.toml` 跑构建、发布仓库根 → 约 1 分钟后线上生效。

**站点已从 `web/` 子目录扁平化到仓库根**（发布根 = 仓库根）。因此：

- 站点唯一入口是根 `index.html`，资源在 `js/` `css/` `image/`，**不存在 `web/` 目录**。
- `netlify.toml` 里对三种上下文的显式 `publish = "."` 是刻意的——防止 Netlify UI 或旧站点设置仍指向 `web/`。改这份配置时别把这三段删掉。
- 构建产物是 `index.json` + `downloads/*.zip`；**没有 `data.js`**（旧时代把全文内联进 `data.js`，现已改为前端 `fetch('index.json')`）。
- `index.json` **需要提交**（无构建步骤的静态托管与 Agent 读取都靠它）；`downloads/` 不入库。

## 二、日常更新流程（唯一标准流程）

1. 改了 `char/` 或 `skills/` 下任何文件 → 仓库根运行 `python build_data.py`（会重算 `index.json`、重打 ZIP、给 `index.html` 盖资源戳与版本号）
2. 改站点本身（样式/逻辑/文案）→ 直接改 `js/` `css/` 下文件；**文案必须走 `js/i18n.js` 的键值对**，禁止在 HTML/JS 硬编码
3. `git add` → commit → push
4. 无需登录任何平台，Netlify 自动部署

**验证**：`Invoke-WebRequest https://lbd-charforge.netlify.app/` 响应体 title 应为「CHAR//FORGE」；本地可跑 `python build_data.py` + `python _verify_zips.py` 双重自检（后者查下载包内死链）。

## 三、关键约束（新会话必读）

- **不要手改 `index.json` 与 `downloads/`**——它们是 `build_data.py` 的生成物。`index.json` 必须提交，`downloads/` 不入库（Netlify 构建时现生成）。
- **改生成物结构前先全量审计消费方**。历史事故（2026-09-17，旧 `data.js` 时代）：把 `content` 改成 `lines[]` 时只查了 `main.js` / `download.js`，漏了 `carousel.js` 里的字段访问 → `undefined.length` 抛错 → **线上角色卡全部不渲染、内容区全黑**。教训仍然有效：改 `index.json` 的字段结构时，先 `grep -rln "SITE_DATA" .` 逐个核对消费方，再动。
- **改角色目录名（slug）时的同步清单**：① `git mv char/<旧> char/<新>`（保历史，git 识别为 R 而非删+增）② `meta/<旧>.json` 改名为 `meta/<新>.json` ③ `docs/CHARACTERS.md` 角色表的链接与路径 ④ 该卡 `SKILL.md` front-matter 的 `name` ⑤ 卡内对 `_溯源/<旧>/` 的引用 ⑥ `thumbnails/<旧>/` 改名 ⑦ 本地 `_溯源/<旧>/` 目录同步改名 ⑧ 重跑 `python build_data.py`。命名约定：`<角色名>-<作品英文名>`
  > 旧清单里的"改 `build_data.py` 里的 slug/dir"已作废——现在 slug 取 `meta/` 文件名、交付目录由它推出，**不用改代码**；`download.js` 注释示例也已不存在。
- **Q&A 条目数量上限**硬编码在 `js/main.js` 的 `renderQA()` 循环里（当前 9），新增词条后需同步改数字。
- 站内所有图标为内联 SVG（`js/config.js` 的 socials/icons 与各 JS 模板字符串）；`image/` 仅剩声明页三图标，无 favicon（属正常，浏览器标签显示默认图标）。
- **手机端策略**：手机 UA 访问时由 `index.html` head 内联脚本强制桌面视口（`width=1280` + `.view-pc`）。决策记录与技术债见 `MOBILE-TODO.md`；**实现细节在 `js/carousel.js` 头部注释**，改这块前先读它。
- 仓库里不得出现部署平台账号凭证；任何"需要登录后台"的操作优先改为仓库内配置文件（如 `netlify.toml`）方案。
- 公开仓库的前提：**写进任何文件的内容都会被公开**。运维事实（域名、发布目录、踩坑结论）可以写；账密、Token、后台截图一律不写、不存、不贴进对话记录。

## 四、历史踩坑记录（避免重蹈）

**这些与"仓库处于哪个时代"无关，都还成立。**

- **Windows 重复端口绑定**：本机可对同一端口重复启动多个 `python -m http.server`，导致请求被旧进程接走、浏览器测试结果异常。测试前先 `netstat -ano | findstr <端口>` 查重，测完 `taskkill` 清理。
- **`file://` 与 `?v=` 参数**：给 `<script src>` 加 `?v=` 版本参数在 `http(s)` 下防缓存有效，但本地双击打开（`file://`）时会导致资源加载失败（`ERR_ABORTED`）。本站已给 `js/` `css/` 加资源戳（构建期盖章），所以**本地必须走 HTTP 预览**，别双击 `index.html`。
- **`git pull --rebase` 卡死**：曾因 Windows 文件锁（unlink `.gitignore` 失败）卡在中间状态，工作树暂时"变空"。处置：删除被锁的 untracked 文件 → `git rebase --abort` → 文件恢复。
- **推送被拒先别 rebase**：远程有新提交导致 `push` 被拒时，用 `git fetch` + `git merge origin/main`（本仓库 `rebase` 有卡死前科）。若远程只是文档改动，通常零冲突。仓库与 GitHub 建库 Initial commit 无共同历史时，需要 `--allow-unrelated-histories`。
- **"假修改"的判据**：`core.autocrlf=true`（本机默认）+ 脚本固定写 LF ⇒ 重跑后 `git status` 可能把某些文件标为 `M`，但 **`git diff` 为空**、提交内容不变。这是换行记账，不是内容漂移。判据：**只要 `git diff` 有实质内容才是真改动**。
- **线上文件与本地不一致时先验换行符**：`cmp` 报差异但内容看似相同，用 `cmp -s <(tr -d '\r' < 线上) <(tr -d '\r' < 本地)` 复核——Git 存 LF、Windows 工作区可能是 CRLF，属正常现象而非部署失败。
- **无头浏览器验收（不看截图也能验）**：起本地服务后用 Edge/Chrome 把渲染后的 DOM 抓下来数元素，即可定位"白屏/卡片缺失"这类问题：

  ```bash
  python -m http.server 8912 --directory . &         # 注意端口查重，见上文
  "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
    --headless=new --disable-gpu --no-sandbox --virtual-time-budget=7000 \
    --dump-dom "http://localhost:8912/index.html" > dom.html
  grep -o 'class="char-card[^"]*"' dom.html | wc -l   # 期望 = 角色数
  grep -o 'class="char-file"' dom.html | wc -l        # 期望 = 各角色文件数之和
  grep -c 'NaN' dom.html                              # 期望 0
  ```

  注意用**宽松匹配**：class 常带附加类名（`char-card-head` 等），`class="char-card"` 精确匹配会得到 0 的假阴性。数据表由 `fetch('index.json')` 异步填充，`--virtual-time-budget` 别设太短。

## 五、文档关系

- 公开文档：本目录 `docs/`（[`README.md`](README.md) → [`QUICKSTART.md`](QUICKSTART.md) / [`MAP.md`](MAP.md) / [`CHARACTERS.md`](CHARACTERS.md) / [`META.md`](META.md) / [`LAYERS.md`](LAYERS.md)）
- 部署链路（私有）：本文
- 手机端决策（私有）：[`MOBILE-TODO.md`](MOBILE-TODO.md)
- 本地模型（私有）：[`MODEL.md`](MODEL.md)
- **更新本文的时机**：部署平台 / 域名 / 发布目录变更，或出现新的踩坑结论时
