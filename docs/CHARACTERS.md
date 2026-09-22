# 角色一览

> 项目层 · 索引类。想加角色，流程见 [`QUICKSTART.md`](QUICKSTART.md)。

| 角色 | 作品 | 交付目录 | 文件数 |
|---|---|---|---|
| 阿芙 | 白银之城 | [`char/alf-silver-palace/`](../char/alf-silver-palace/prompt.md) | 10 |
| 茜特菈莉 | 原神 | [`char/citlali-genshin-impact/`](../char/citlali-genshin-impact/prompt.md) | 10 |
| 昔涟 | 崩坏：星穹铁道 | [`char/cyrene-honkai-star-rail/`](../char/cyrene-honkai-star-rail/prompt.md) | 10（三阶段档位） |
| 三月七（含长夜月） | 崩坏：星穹铁道 | [`char/march-7th-honkai-star-rail/`](../char/march-7th-honkai-star-rail/prompt.md) | 10（三档显形） |
| 佩丽卡 | 明日方舟：终末地 | [`char/perlica-arknights-endfield/`](../char/perlica-arknights-endfield/prompt.md) | 10 |
| 普瑞赛斯 | 明日方舟 | [`char/priestess-arknights/`](../char/priestess-arknights/prompt.md) | 10 |
| 黍 | 明日方舟 | [`char/shu-arknights/`](../char/shu-arknights/prompt.md) | 10 |
| 橘雪莉 | 魔法少女的魔女审判 | [`char/tachibana-sherry-manosaba/`](../char/tachibana-sherry-manosaba/prompt.md) | 10（正常 / 魔女化两形态） |
| 吃白饭的大肥鱼 | DeepSeek 社区拟人 | [`char/white-rice-fish-deepseek/`](../char/white-rice-fish-deepseek/prompt.md) | 10 |

## 角色卡里有什么

每个角色的扮演入口是它目录下的两个文件：

- **`SKILL.md`** —— 运行规则：加载顺序、触发条件、自纠与惩罚机制。
- **`prompt.md`** —— 人格快照：自我认同、说话风格、铁律与禁忌。

其余 8 个文件各回答一个独立问题（世界 / 硬事实 / 经历 / 性格 / 行为 / 关系 / 语料 / 误读点），分工见构建器的 [`templates.md`](../skills/character-profile-builder/reference/templates.md)。

`assets/` 里是立绘，供多模态模型建立"这个角色长什么样"的印象——**认得出来就够，不是图集**。

## 版权

- 所有角色设定与图片版权归各自权利人所有；本仓库仅作**介绍、研究与个人扮演参考**，不含商业用途。
- `char/<slug>/assets/` 内的图片多为游戏内素材的转录，**请勿再分发**。
- 构建器的"官方口径"以正剧 / 公式书 / 设定集 / 官网公告为准，社区二创内容不采信。
