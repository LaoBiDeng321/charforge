# 本地抠图模型（贡献者用）

> 给缩略图去透明底用的**本机**模型。属贡献者本地工具链，不是站点运行依赖——模型文件本身不入库（168 MB），这里只记录路径、校验值与用法。

## isnet-anime.onnx

- 路径：`%USERPROFILE%\.u2net\isnet-anime.onnx`
- 大小：`176069933` bytes
- MD5：`6f184e756bb3bd901c8849220a83e38e`
- 来源：`https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-anime.onnx`
- 用途：① 给 `thumbnails/<slug>/cover.*` 抠透明底；② 给首屏背景画廊的瓦片抠底
  （`tools/make_gallery.py`，**只对背景明显纯色的素材**）。模型只在本机使用，不提交仓库。

## 本地用法

```bash
pip install rembg onnxruntime
```

```python
from PIL import Image
from rembg import remove, new_session

session = new_session("isnet-anime")
img = Image.open("thumbnails/perlica-arknights-endfield/cover.png").convert("RGBA")
out = remove(img, session=session)
out.save("thumbnails/perlica-arknights-endfield/cover.png")
```

换图后：

```bash
python build_data.py
```

`build_data.py` 会给缩略图 URL 自动加上 `?v=<内容哈希>`，避免浏览器继续显示旧图。

## ⚠️ 它不是什么都能抠

**这是主体分割模型，只对「平底上的主体」有效。** 满幅插画（光锥 / 带框卡片 / 场景）它会把
整块背景一起留下、甚至把主体抠没，实拍照片直接糊成一团——这类"抠完比不抠更难看"的图，
画廊那边一律走整块裁切 + 边缘羽化，不交给它。判断谁该抠、阈值怎么量出来的，见
[`../gallery/README.md`](../gallery/README.md)「为什么只对『明显纯色底』抠图」。

## 画廊那边不会每次都调它

`tools/make_gallery.py` 是**增量**的：源图内容哈希与归一化口径都没变时，那张瓦片整张跳过；
抠图结果另存本地缓存（`gallery/.cache/`，gitignore），所以改画布尺寸、改编码档位这类
与抠图无关的改动不会再拉起模型。本机实测：什么都没改 0.2s / 0 次模型，全量重做 6s / 0 次模型。
只有"源图变了或抠图口径变了"才真的跑模型。
