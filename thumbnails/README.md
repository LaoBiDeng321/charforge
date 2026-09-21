# 角色缩略图

每个角色一个目录：

```text
thumbnails/<slug>/
```

放入一张**方形**图片即可，构建脚本会自动收录：

- 推荐命名：`cover.png` / `cover.jpg` / `cover.webp` / `thumbnail.png`
- 也支持任意图片名；同名时按文件名排序取第一张
- 支持格式：png / jpg / jpeg / webp / gif / avif
- 建议尺寸 512×512 或以上，比例尽量 1:1

没有图片时前端显示占位块，不影响角色卡渲染。

---

## ⚠️ 来源说明与下架政策

**本目录下的图片多数是从社区采集的 Q 版头像 / 表情包**，用于构成站点角色卡左侧的封面；其中 `march-7th-honkai-star-rail/cover.png` 由用户说明为**官方表情包**（具体套组未记录），属于本目录的例外记录。

整理时有若干图片**未能追溯到原作者**——这是记录疏漏，不是「没有来源」。**若你是其中任一张的作者：**

- 想**署名**：提 Issue 附上作品链接，我会补上出处与作者名；
- 想**下架**：同样提 Issue，收到即删，**不需要说明理由**。

> 注意：本目录只影响站点卡片封面，**不参与角色扮演设定**（扮演用的外貌依据是 `char/<slug>/assets/` 下的官方立绘，见该目录的 `README.md`）。因此下架某张缩略图不会影响任何角色卡的内容完整性。

## 收录记录

新增图片时请顺手填上出处；查不到就写「未记录」，不要留空。

| 角色 | 文件 | 出处 / 作者 | 状态 |
|---|---|---|---|
| 吃白饭的大肥鱼 | [`white-rice-fish-deepseek/cover.png`](white-rice-fish-deepseek/cover.png) | 未记录 | ⚠️ 待补 |
| 黍 | [`shu-arknights/cover.png`](shu-arknights/cover.png) | 未记录 | ⚠️ 待补 |
| 普瑞赛斯 | [`priestess-arknights/cover.png`](priestess-arknights/cover.png) | 未记录 | ⚠️ 待补 |
| 茜特菈莉 | [`citlali-genshin-impact/cover.png`](citlali-genshin-impact/cover.png) | 未记录 | ⚠️ 待补 |
| 阿芙 | [`alf-silver-palace/cover.jpg`](alf-silver-palace/cover.jpg) | 未记录 | ⚠️ 待补 |
| 昔涟 | [`cyrene-honkai-star-rail/cover.png`](cyrene-honkai-star-rail/cover.png) | 未记录 | ⚠️ 待补 |
| 佩丽卡 | [`perlica-arknights-endfield/cover.png`](perlica-arknights-endfield/cover.png) | 未记录 | ⚠️ 待补 |
| 三月七（含长夜月） | [`march-7th-honkai-star-rail/cover.png`](march-7th-honkai-star-rail/cover.png) | 用户说明为**官方表情包**；具体套组未记录 | ✅ 官方表情包，套组待补 |

> 该表在仓库历史里是「先上线、后补齐」的状态：多数图片都是随角色卡一起加入的，采集时没有同步记录出处。已逐一确认的事实是——**它们都不是官方角色立绘（key art）**，因此不适用于 `char/<slug>/assets/README.md` 里那套官方渠道溯源规范。
