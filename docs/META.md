# meta 字段参考

> 项目层 · 索引类。`meta/<slug>.json` 是角色卡的**展示元数据**，一人一文件。
> 加角色不用改代码：slug 取文件名、交付目录由它推出，两者都不用在 JSON 里重复写。

## 字段表

| 字段 | 必填 | 作用 |
|---|---|---|
| `name` | ✅ | 角色主名（构建会校验，缺了直接报错） |
| `alias` | | 英文别名（如 `SHERRY`），展示与检索用 |
| `nameEn` | | 英文名 |
| `company` | | 定位索引一级（公司），含 `id` / `zh-CN` / `en-US` |
| `work` | | 定位索引二级（作品），结构同 `company`。**省略即"单层"**，该公司下不出现二级栏 |
| `origin` | | 来源，含 `zh-CN` / `en-US` |
| `tags` | | 标签，含 `zh-CN` / `en-US`。**固定格式，见下** |
| `reading` | | **仅多音字需要**，见下 |

`pinyin` / `pinyinInitials` / 中文排序键全部由构建期**自动推导**，不需要人工维护。

## `tags` 是固定格式

**只放「角色名 + 作品名 + 公司名」，不加任何角色特质。**

```json
"tags": {
  "zh-CN": ["橘雪莉", "魔法少女的魔女审判", "Acacia"],
  "en-US": ["Sherry Tachibana", "Magical Girl Witch Trials", "Acacia"]
}
```

- 顺序固定 **角色名 → 作品名 → 公司名**；中英各一份，措辞与 `name` / `work` / `company` 对齐。
- **禁止**加角色特质、能力、称号、原罪、阵营之类的词（如 `破坏侦探`、`怪力`、`侦探`）。这类内容归角色卡的 `profile.md` 核心标签——**它们是设定，不是检索入口**。
- 单个角色的**异名可以加**（如 `三月七` 条目下的 `长夜月`），因为它仍是"角色名"。
- **为什么必须守住**：`tags` 是角色索引第①段的检索键，往里面塞关键词会**直接改变搜索结果**（搜「怪力」会突然冒出这个角色）。构建期有 `warn_extra_tags` 软校验会提示。

## `reading` 只给多音字

pypinyin 判错读音时才写，**空格分隔逐字读音**：

```json
{ "name": "茜特菈莉", "reading": "xi te la li" }
```

pypinyin 默认把「茜」判为 qiàn。**音节数必须等于汉字数**，否则构建直接报错。全站目前只有这一处，其余角色一律不用写。

## 最小示例

```json
{
  "name": "橘雪莉",
  "alias": "SHERRY",
  "nameEn": "Sherry Tachibana",
  "company": { "id": "acacia", "zh-CN": "Acacia", "en-US": "Acacia" },
  "work": { "id": "manosaba", "zh-CN": "魔法少女的魔女审判", "en-US": "Magical Girl Witch Trials" },
  "origin": { "zh-CN": "《魔法少女的魔女审判》官方设定", "en-US": "Magical Girl Witch Trials Official" },
  "tags": {
    "zh-CN": ["橘雪莉", "魔法少女的魔女审判", "Acacia"],
    "en-US": ["Sherry Tachibana", "Magical Girl Witch Trials", "Acacia"]
  }
}
```

> `meta/` 与 `char/` **平级、在交付目录之外**——这是刻意的：`char/<slug>/` 必须保持纯净，元数据放进去会被构建脚本扫进 ZIP 和站点数据。
