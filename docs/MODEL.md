# 本地抠图模型（贡献者用）

> 给缩略图去透明底用的**本机**模型。属贡献者本地工具链，不是站点运行依赖——模型文件本身不入库（168 MB），这里只记录路径、校验值与用法。

## isnet-anime.onnx

- 路径：`%USERPROFILE%\.u2net\isnet-anime.onnx`
- 大小：`176069933` bytes
- MD5：`6f184e756bb3bd901c8849220a83e38e`
- 来源：`https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-anime.onnx`
- 用途：给 `thumbnails/<slug>/cover.*` 抠透明底；模型只在本机使用，不提交仓库。

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
