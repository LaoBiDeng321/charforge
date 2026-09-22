# 目录地图

> 项目层 · 索引类。东西都放在哪。**发布根 = 仓库根**。

```text
/
├── index.html            # 站点唯一入口：5 分区全屏滚动
├── index.json            # 构建产物：站点 + Agent 共用索引 · 需提交
├── downloads/            # 构建产物：skills/<slug>.zip、char/<slug>.zip · 不入库
│
├── skills/               # 唯一可编辑源 · 角色构建器（随 ZIP 下发）
│   ├── character-profile-builder/
│   │   ├── SKILL.md              # 薄主文件：三阶段流程、闸门、批次表
│   │   └── reference/            # 包内细则（随包下发）
│   │       ├── details.md        # 铁律细则、认知协议、素材规则、自检
│   │       └── templates.md      # 10 文件章节池
│   └── original-character-builder/
│       ├── SKILL.md
│       └── reference/
│           ├── reference.md
│           └── templates.md
│
├── char/                 # 唯一可编辑源 · 角色卡（随 ZIP 下发，保持纯净）
│   └── <slug>/           #   10 个设定文件 + assets/
│
├── meta/                 # 唯一可编辑源 · 角色展示元数据，一人一文件
├── thumbnails/           # 角色卡方形缩略图，按 <slug>/ 分目录
│
├── docs/                 # 项目层文档（本目录）
│   ├── README.md         #   文档索引
│   ├── QUICKSTART.md     #   跑起来 / 构建 / 发布 / 加角色 / 验证
│   ├── MAP.md            #   本文件
│   ├── CHARACTERS.md     #   角色表
│   ├── META.md           #   meta 字段参考
│   └── LAYERS.md         #   三层职责与交付契约
│
├── build_data.py         # 构建脚本（机制见其头部注释）
├── requirements.txt      # 构建期依赖
├── netlify.toml          # Netlify：pip install && python3 build_data.py，publish = "."
├── tools/                # deepseek_v4_tokenizer.zip · vendor_dl.py
├── js/ css/ image/       # 前端资源（js/vendor/ 内为第三方算法，MIT，未改动）
│
├── _溯源/                # 构建期素材缓存与裁定记录 · 不入库
├── 未分类的素材/          # 图片投放临时区 · 不入库
└── README.md             # 仓库入口（薄，指向 docs/）
```

## 三条容易踩的边界

**1. `skills/<slug>/reference/` 与根 `docs/` 不是一回事。**
前者是**包内**目录，随 ZIP 一起下发给用户；后者只在仓库里，不随任何包下发。构建器文档里**禁止出现指向 `docs/` 的文件链接**——那在下载包里是死链，只能用文字描述（详见 [`LAYERS.md`](LAYERS.md) §2.3）。

**2. 交付目录必须纯净。**
`char/<slug>/` 内只放 10 个设定文件与 `assets/`。素材缓存、草稿、原始长文档一律放同级的 `_溯源/<slug>/`——构建脚本按 `<slug>` 整目录扫描，混进去会被一并发布。

**3. 图片分两处。**
立绘 → `char/<slug>/assets/`；**方形图 / Q 版 / 头像 / 表情包 → `thumbnails/<slug>/cover.*`**，不入 `assets/`。
