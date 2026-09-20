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

当前目录：

- thumbnails/white-rice-fish-deepseek/
- thumbnails/shu-arknights/
- thumbnails/priestess-arknights/
- thumbnails/citlali-genshin-impact/
- thumbnails/alf-silver-palace/
- thumbnails/cyrene-honkai-star-rail/
- thumbnails/perlica-arknights-endfield/

没有图片时前端显示占位块，不影响角色卡渲染。
