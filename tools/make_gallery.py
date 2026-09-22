# -*- coding: utf-8 -*-
"""
make_gallery.py —— 首屏背景「斜向滚动画廊」的切片生成器

把 `char/<slug>/assets/` 下的立绘 / 光锥 / 场景图，统一归一化成 **3:4 的瓦片**，
输出到 `gallery/<slug>/NN.webp`，供首屏背景层使用（前端 `js/hero-gallery.js`，
参数 `js/config.js` → `SITE_CONFIG.gallery`）。

为什么要单独一个脚本、而不是塞进 build_data.py：

  1. `char/<slug>/` 是**交付包**——随 ZIP 下发、参与 Token 预估。派生图混进去会污染
     交付物，也会让每个角色的下载包平白变大。派生图另立 `gallery/`，与 `char/` 解耦。
  2. `thumbnails/` 已经是这个套路：图片一次生成、提交入库，构建期只做扫描与打戳。
     这里沿用同一分工——**编码不进构建**，否则 Pillow 版本一变产物字节就漂，
     `index.json` 跟着抖（可复现性见 build_data.py 头部注释第 4 条）。
  3. GitHub Pages 没有构建步骤，而 `index.json` 是入库的；派生图同理必须入库，
     否则 Pages 上的首屏会是一片空白（Netlify 会跑 build_data.py，但那只覆盖 Netlify）。

为什么源图不能直接上首屏：`char/*/assets/` 里最大的一张 14 MB（4000×4218 PNG），
首屏背景要挂几十个瓦片，按原图算就是几百 MB。所以必须在**这里**把体积压到位。

三种归一路径（前一条判据不成立才看下一条）：

  · cutout —— 源图**自带透明底**（立绘）。先按 alpha 通道紧裁掉四周空白，再等比缩放到
    画布内（留 2% 边距），**水平居中、底边对齐**。底边对齐是关键：所有立绘站在同一条
    基线上，列滚动时不会有"这张浮在上、那张沉在下"的跳动感。
  · matte —— 源图不透明，但**背景明显纯色**（见 plain_background）。交给本机
    isnet-anime 模型抠底（模型与依赖见 docs/MODEL.md），抠完与 cutout 同样收尾。
    只对纯色底下手是有原因的：这个模型是主体分割，满幅插画它抠不动——会把整块背景留在
    一起、甚至把主体抠没，那比不抠更难看。逐张比过，不是猜的。
  · plate —— 其余（满幅插画 / 光锥 / 带框卡片 / 场景 / 实拍照片）。等比放大到**铺满**
    画布再裁切，锚点横向居中、纵向 0.35（人像头部通常在上半部，居中裁容易切掉头），
    再按 PLATE_MODE 收尾（默认四边羽化）。

判定全都不靠文件名，靠像素实测：透明底看 alpha 通道的全透明占比，纯色底看外圈同色率。

输出为什么是 WebP：本机这套图里，只有 WebP 同时满足「体积小」与「保留透明通道」。
透明立绘一旦存 JPEG，透明区会压成黑块或白块——在近黑的首屏上就是一个洞。

**不想让某张素材上首屏**：把它写进 `gallery/exclude.json`（slug + assets 里的文件名 +
理由），别删 `char/<slug>/assets/` 里的原图——原图是角色卡的外貌依据、随 ZIP 下发，
排除的只是"当背景展示"这一件事。清单处理的是观感问题（如惊悚向的形态立绘），
不是版权或可用性问题。

**抠图规则是自动的**：背景明显纯色的素材才交给 isnet-anime（判据与阈值见
plain_background）。少量例外写 `gallery/matte.json` 的 `force` / `skip`（判定与观感
不一致时人工纠正）——**这两份清单都算进口径指纹**，所以改完重跑就生效，不必加 --force。
抠图依赖属本机工具链，不是站点运行依赖；但一旦清单里有要抠的素材，
缺 rembg 就直接报错——**不静默降级成没抠的瓦片**，那等于悄悄丢产物。

用法：
    python tools/make_gallery.py            # 全量重生成 + 写 manifest
    python tools/make_gallery.py --check    # 只报告，不写文件（CI / 提交前核对）

产物（两份都要入库，`index.json` 依赖它们）：
    gallery/<slug>/NN.webp     归一化后的瓦片，NN 按素材文件名排序
    gallery/manifest.json      每张瓦片的来源与变换记录（溯源用，见 _溯源 规则）

本目录由本脚本独占：源图删掉、换了扩展名、角色目录改名、或者被排除清单挡掉之后重跑，
多出来的孤儿瓦片会被删掉（否则它们会一起进 `index.json` 的图池）。`--check` 只报告，
不动任何文件。
"""

import argparse
import hashlib
import json
import os
import sys

from PIL import Image, ImageChops

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHAR_DIR = os.path.join(ROOT, "char")
GALLERY_DIR = os.path.join(ROOT, "gallery")
THUMBNAILS_DIR = os.path.join(ROOT, "thumbnails")
MANIFEST = os.path.join(GALLERY_DIR, "manifest.json")
# 排除清单：写在数据文件里而不是代码里——理由（观感判断）也是产物的一部分，
# 下一个人要能看懂"为什么这张不上首屏"，而不是只看到一行硬编码。
EXCLUDE = os.path.join(GALLERY_DIR, "exclude.json")
# 抠图允许清单：同样是数据文件。为什么不是"全部都抠"——见文件里的 note：
# 这个模型是主体分割，满幅插画抠不动，硬抠出来比不抠更难看。
MATTE_LIST = os.path.join(GALLERY_DIR, "matte.json")
# 本地派生缓存（不入库，见 .gitignore）：只缓存抠图结果。
# 为什么缓存：抠图依赖本机模型（176MB、CPU 推理），而它只依赖「源图内容 + 抠图口径」。
# 口径没变、源图没变就没有重跑的理由——尤其是"只改了画布尺寸/编码档位"这种
# 与抠图无关的改动，不该把模型再拉起来一次。
CACHE_DIR = os.path.join(GALLERY_DIR, ".cache")
# 抠图缓存的口径标签：换模型 / 改 MATTE_MAX_SIDE / 改抠图收尾逻辑时 +1，旧缓存自动失效
MATTE_CACHE_TAG = "isnet-anime|1024|v1"

IMAGE_EXTS = (".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif")

# 瓦片画布（宽 × 高）：3:4 竖构图，正好装下一个全身立绘。
# 尺寸取的是「首屏最大显示尺寸的 1.2 倍左右」——列宽是视口的 25%（8 列、容器宽 200%），
# 1080p 下约 480 px，再算上高分屏，360 px 宽够用；而瓦片整体只有 16% 不透明度，
# 再往上加分辨率纯属浪费首屏带宽。
TILE_W, TILE_H = 360, 480
QUALITY = 72
# WebP 编码档位。实测（26 张瓦片全量）：method=6 → 70.2s / 782KB，method=5 → 5.3s / 806KB，
# method=4 → 1.5s / 810KB。**method 只影响编码器的搜索强度，不改变有损质量**（alpha 始终无损），
# 换来的是 47 倍速度差和 3.5% 体积差——闭着眼睛选 4：全量重做从 74s 降到 5s，
# 而且瓦片只是 16% 不透明度的背景，那 27KB 谁看得出来。
WEBP_METHOD = 4
# cutout 缩放到画布高度的比例：留出上下呼吸，避免立绘顶到瓦片边缘
CUTOUT_FILL = 0.96
CUTOUT_MARGIN_BOTTOM = 0.02
# plate 裁切锚点：横向居中、纵向偏上
PLATE_ANCHOR_Y = 0.35
# 有透明底的判定：全透明像素（alpha < 16）占比超过这个值就算 cutout
ALPHA_CLEAR_RATIO = 0.02

# 抠不动的整块图（plate）怎么收尾：
#   "feather" —— 四边渐隐到透明，退成柔光色块（与图池里的人物是同一类元素）
#   "skip"    —— 干脆不进图池
# 为什么要这一步：图池里既有透明底立绘（浮空的人），也有铺满整块的图（硬边矩形）。
# 两者在 16% 不透明度下依然看得出差别——矩形会读成"一块块贴上去的板子"，
# 混在一起不整齐。羽化把硬边消掉，是成本最低的一致性处理（比重抠一遍便宜得多）。
PLATE_MODE = "feather"
# 羽化宽度（占瓦片宽/高的比例）：横向 / 纵向
FEATHER_X, FEATHER_Y = 0.16, 0.20
# 抠图前的预缩上限：isnet-anime 的输入本来就是 1024，原图（最大 4000×4218）送进去
# 纯属浪费，而且边缘质量由最终 360×480 决定，先缩再抠完全够用
MATTE_MAX_SIDE = 1024
# 抠图结果的前景占比合理区间：交给模型的都是"纯色底上的一个主体"，
# 落在这个区间外说明模型这次没分离出来（留了整块背景 / 把主体抠没了），值得报出来
MATTE_FG_RANGE = (0.10, 0.90)

# 「背景明显纯色」的判据（为什么用它决定抠不抠，见 plain_background）：
# 缩到 256 内取外圈 5% 的像素，与这圈像素的中位色相差 ≤14 的占比 ≥0.90 就算纯色底。
# 阈值有实测支撑：非纯色底 0.002~0.495，纯白底 0.958/0.983。
PLAIN_BG_SAMPLE = 256
PLAIN_BG_BAND = 0.05
PLAIN_BG_TOLERANCE = 14
PLAIN_BG_MIN_RATIO = 0.90


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def clear_ratio(im):
    """全透明像素占比。源图不是 RGBA / 没有透明通道时返回 0。"""
    if im.mode not in ("RGBA", "LA", "PA") and "transparency" not in im.info:
        return 0.0
    alpha = im.convert("RGBA").getchannel("A")
    hist = alpha.histogram()
    return sum(hist[:16]) / float(alpha.width * alpha.height)


def fit_cutout(im):
    """透明底立绘：紧裁空白 → 等比缩放进画布 → 水平居中、底边对齐。"""
    im = im.convert("RGBA")
    bbox = im.getchannel("A").getbbox()
    if bbox:
        im = im.crop(bbox)

    w, h = im.size
    scale = min(TILE_W / w, (TILE_H * CUTOUT_FILL) / h)
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (TILE_W, TILE_H), (0, 0, 0, 0))
    x = (TILE_W - nw) // 2
    y = max(0, TILE_H - nh - round(TILE_H * CUTOUT_MARGIN_BOTTOM))
    canvas.alpha_composite(im, (x, y))
    return canvas


def fit_plate(im):
    """不透明图：等比放大铺满画布后裁切（横向居中、纵向偏上）。"""
    im = im.convert("RGB")
    w, h = im.size
    scale = max(TILE_W / w, TILE_H / h)
    nw, nh = max(TILE_W, round(w * scale)), max(TILE_H, round(h * scale))
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)

    left = (nw - TILE_W) // 2
    top = round((nh - TILE_H) * PLATE_ANCHOR_Y)
    return im.crop((left, top, left + TILE_W, top + TILE_H))


def _ramp(n, frac):
    """一维遮罩（1×n 的竖条）：两端各渐隐 frac，中间为 255。

    用 smoothstep 而不是线性：线性羽化的过渡带在低不透明度下仍能看出是一条直边。
    """
    img = Image.new("L", (1, n), 255)
    px = img.load()
    edge = max(1, int(round(n * frac)))
    for i in range(edge):
        t = i / float(edge)
        v = int(round(255 * (t * t * (3 - 2 * t))))
        px[0, i] = v
        px[0, n - 1 - i] = v
    return img


def feather_edges(im, fx=FEATHER_X, fy=FEATHER_Y):
    """四边渐隐到透明：plate 路径的收尾（为什么见文件顶部 PLATE_MODE 处）。

    两轴各一条 smoothstep 斜坡相乘，四角自然更淡。
    """
    im = im.convert("RGBA")
    w, h = im.size
    mask = Image.new("L", (w, h), 255)
    if fx > 0:
        row = _ramp(w, fx).transpose(Image.Transpose.ROTATE_90)      # (1,w) → (w,1)
        mask = ImageChops.multiply(mask, row.resize((w, h), Image.Resampling.BILINEAR))
    if fy > 0:
        mask = ImageChops.multiply(mask, _ramp(h, fy).resize((w, h), Image.Resampling.BILINEAR))
    im.putalpha(mask)
    return im


def foreground_ratio(im):
    """不透明前景（alpha ≥ 128）占比，用来判断抠图这次是否真的分离出了主体。"""
    alpha = im.convert("RGBA").getchannel("A")
    hist = alpha.histogram()
    return sum(hist[128:]) / float(alpha.width * alpha.height)


def plain_background(im):
    """背景是不是"明显纯色"：取外圈一圈像素，看它们是否几乎同色。

    为什么用它决定抠不抠：isnet-anime 是**主体分割**模型，只有"平底上的主体"才分离得
    干净；满幅插画（光锥 / 带框卡片 / 场景 / 实拍照片）它会把整块背景一起留下、甚至把
    主体抠没（实测 march 04 前景只剩 7%），那比不抠更难看。所以先看背景纯不纯。

    判据只看外圈，且先缩到 256 内再看（BOXA 平均 + 便宜）：主体压到画框的图（满幅插画
    就是这种）外圈必然花，直接落选。

    阈值是量出来的，不是拍的。本仓库实测（gallery/manifest.json 的 plainRatio 有留档）：
      · 非纯色底：0.002 ~ 0.495（满幅插画 / 照片 / 卡片全在这一段）
      · 纯白底：0.958、0.983
    阈值 0.90 两侧余量都很大，所以不存在"卡在边界上"的图。加新素材时如果落在中间，
    说明它既不是纯色底、又不完全是满幅插画——先按不抠处理，再按观感决定是否写进
    gallery/matte.json 的 force。
    """
    small = im.convert("RGB")
    s = min(PLAIN_BG_SAMPLE / small.width, PLAIN_BG_SAMPLE / small.height, 1.0)
    if s < 1.0:
        small = small.resize((max(8, round(small.width * s)), max(8, round(small.height * s))),
                             Image.Resampling.BOX)
    w, h = small.size
    band = max(1, round(min(w, h) * PLAIN_BG_BAND))
    px = small.load()
    pts = [px[x, y] for y in range(h) for x in range(w)
           if x < band or y < band or x >= w - band or y >= h - band]

    med = tuple(sorted(p[c] for p in pts)[len(pts) // 2] for c in range(3))
    hit = sum(1 for p in pts if max(abs(p[c] - med[c]) for c in range(3)) <= PLAIN_BG_TOLERANCE)
    ratio = hit / float(len(pts))
    return ratio, ratio >= PLAIN_BG_MIN_RATIO


def matte_session():
    """加载本机 isnet-anime 模型（延迟 import：不抠图的环境不必装 rembg）。

    模型与依赖属贡献者本地工具链，不是站点运行依赖——见 docs/MODEL.md。
    """
    try:
        from rembg import new_session
    except ImportError as exc:
        raise SystemExit(
            "gallery/matte.json 里列了要抠底的素材，但本机没有 rembg：\n"
            "  pip install rembg onnxruntime\n"
            "并准备模型 %USERPROFILE%\\.u2net\\isnet-anime.onnx（见 docs/MODEL.md）。\n"
            "（不想装就先把 gallery/matte.json 的 matte 清空——但那样重跑会覆盖掉\n"
            " 已抠好的瓦片，等于丢产物，所以这里直接报错而不是静默降级。）"
        ) from exc
    return new_session("isnet-anime")


def matte_source(path, session):
    """抠底：先缩到 1024 内再送模型（输入上限就是 1024），返回 RGBA。"""
    from rembg import remove

    with Image.open(path) as im:
        im = im.convert("RGB")
        s = min(MATTE_MAX_SIDE / im.width, MATTE_MAX_SIDE / im.height, 1.0)
        if s < 1.0:
            im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))),
                           Image.Resampling.LANCZOS)
    return remove(im, session=session)


def sources():
    """按 slug、文件名排序返回 [(slug, 源图绝对路径)]，顺序即瓦片编号。"""
    out = []
    if not os.path.isdir(CHAR_DIR):
        return out
    for slug in sorted(os.listdir(CHAR_DIR)):
        assets = os.path.join(CHAR_DIR, slug, "assets")
        if not os.path.isdir(assets):
            continue
        for fn in sorted(os.listdir(assets)):
            if fn.lower().endswith(IMAGE_EXTS):
                out.append((slug, os.path.join(assets, fn)))
    return out


def load_excluded():
    """读 gallery/exclude.json，返回 {(slug, 文件名): 理由}。

    排除只针对"首屏背景展示"这一件事：源图仍在 char/<slug>/assets/ 里，角色卡与下载包
    照旧带着它。缺文件按"没有排除"处理（首次生成时还没有这份清单）。
    """
    if not os.path.isfile(EXCLUDE):
        return {}
    try:
        with open(EXCLUDE, "r", encoding="utf-8") as f:
            data = json.load(f)
    except ValueError as exc:
        raise SystemExit("gallery/exclude.json 不是合法 JSON：%s" % exc)

    out = {}
    for item in data.get("exclude") or []:
        slug = (item.get("slug") or "").strip()
        name = (item.get("file") or "").strip()
        if not slug or not name:
            raise SystemExit("gallery/exclude.json 的条目缺少 slug 或 file：%r" % (item,))
        key = (slug, name)
        if key in out:
            raise SystemExit("gallery/exclude.json 有重复条目：%s / %s" % key)
        out[key] = item.get("reason") or ""
    return out


def load_matte_overrides():
    """读 gallery/matte.json，返回 (force, skip, reasons)。

    抠图**规则**是自动的：背景明显纯色的素材才交给 isnet-anime（判据见 plain_background）。
    这个文件只放例外——自动判定与观感不一致时人工纠正：
      force：判定说"不是纯色底"，但人看着该抠；
      skip ：判定说"是纯色底"，但抠出来难看。
    """
    force, skip, reasons = set(), set(), {}
    if not os.path.isfile(MATTE_LIST):
        return force, skip, reasons
    try:
        with open(MATTE_LIST, "r", encoding="utf-8") as f:
            data = json.load(f)
    except ValueError as exc:
        raise SystemExit("gallery/matte.json 不是合法 JSON：%s" % exc)

    for field, bucket in (("force", force), ("skip", skip)):
        for item in data.get(field) or []:
            slug = (item.get("slug") or "").strip()
            name = (item.get("file") or "").strip()
            if not slug or not name:
                raise SystemExit("gallery/matte.json 的 %s 条目缺少 slug 或 file：%r" % (field, item))
            bucket.add((slug, name))
            reasons[(slug, name)] = item.get("reason") or ""
    return force, skip, reasons


_THUMB_CACHE = {}


def thumbnail_hashes(slug):
    """`thumbnails/<slug>/` 下所有图片的内容哈希（按 slug 缓存）。

    用途见 is_thumbnail_duplicate：素材若与缩略图逐字节相同，它自己就是缩略图。
    """
    if slug in _THUMB_CACHE:
        return _THUMB_CACHE[slug]
    base = os.path.join(THUMBNAILS_DIR, slug)
    hashes = set()
    if os.path.isdir(base):
        for fn in os.listdir(base):
            if fn.lower().endswith(IMAGE_EXTS):
                hashes.add(sha256_file(os.path.join(base, fn)))
    _THUMB_CACHE[slug] = hashes
    return hashes


def is_thumbnail_duplicate(slug, path, digest):
    """这张素材是不是"缩略图本身"：与 `thumbnails/<slug>/` 里的图内容完全相同。

    为什么按内容哈希判、而不按文件名或方形比例：`assets/` 与 `thumbnails/` 的归属是
    两条流水线（前者随 ZIP 下发给扮演用的 agent，后者是站点卡片封面），唯一可靠的
    "同一张图"证据就是字节相同。实测命中的是三月七的 `10-头像-三月七.png`——它和
    `thumbnails/march-7th-honkai-star-rail/cover.png` 是同一个文件。

    这类图不该进首屏画廊：它是**缩略图/头像/表情包**那一类（归属地是 `thumbnails/`，
    见 docs/MAP.md「图片分三处」），不是角色的立绘级素材。
    """
    return digest in thumbnail_hashes(slug)


def policy_fingerprint(matte_used, matte_overrides=()):
    """当次归一化口径的指纹：写进 manifest，也用来判断"上一批瓦片还算不算数"。

    只放**影响输出**的参数。这份指纹一变，全部瓦片重做（因为无法保证哪张不受影响）；
    指纹没变 + 源图哈希没变 ⇒ 那张瓦片一定与上次逐字节相同，直接跳过即可。

    `matte_overrides` 是 `gallery/matte.json` 里 force/skip 的键集合——它决定个别素材走
    抠图还是 plate，**同样影响输出**，所以必须进指纹：否则改完清单重跑会被整批跳过，
    "改完重跑即可"就只是文档里的空话（实测踩过：force 加了两条，重做 0 张）。
    """
    return {
        "tile": {"width": TILE_W, "height": TILE_H, "format": "webp",
                 "quality": QUALITY, "method": WEBP_METHOD},
        "alphaCutoutThreshold": ALPHA_CLEAR_RATIO,
        "plainBackground": {
            "sample": PLAIN_BG_SAMPLE, "band": PLAIN_BG_BAND,
            "tolerance": PLAIN_BG_TOLERANCE, "minRatio": PLAIN_BG_MIN_RATIO,
        },
        "cutoutFill": CUTOUT_FILL,
        "cutoutMarginBottom": CUTOUT_MARGIN_BOTTOM,
        "plateAnchorY": PLATE_ANCHOR_Y,
        "plateMode": PLATE_MODE,
        "feather": {"x": FEATHER_X, "y": FEATHER_Y},
        "matteModel": "isnet-anime" if matte_used else None,
        "matteCacheTag": MATTE_CACHE_TAG if matte_used else None,
        "matteOverrides": sorted("%s/%s" % (s, f) for s, f in matte_overrides),
    }


def load_previous():
    """读上一次的 manifest，返回 (源图哈希→记录, 口径指纹)；没有就返回空。"""
    if not os.path.isfile(MANIFEST):
        return {}, None
    try:
        with open(MANIFEST, "r", encoding="utf-8") as f:
            data = json.load(f)
    except ValueError:
        return {}, None                      # 坏掉的 manifest 只当作"没有"，不影响生成
    by_out = {}
    for rec in data.get("files") or []:
        by_out[rec.get("out")] = rec
    return by_out, data.get("policy")


def matte_cache_path(digest):
    """抠图缓存的路径：键 = 抠图口径标签 + 源图内容哈希（口径变了键就变，旧缓存自然失效）。"""
    key = hashlib.sha256(("%s|%s" % (MATTE_CACHE_TAG, digest)).encode("utf-8")).hexdigest()[:16]
    return os.path.join(CACHE_DIR, "matte-%s.png" % key)


def prune(expected):
    """删掉本目录里「不该在这里」的 .webp：源图删了 / 换了格式 / 角色目录改名留下的孤儿。

    为什么要删：index.json 的图池是按 gallery/ 的实际文件扫出来的（见 build_data.py
    `collect_gallery`），孤儿瓦片会一起被发给前端。角色目录改名是典型场景——旧目录
    的文件不会有人来清，新目录又生成了同名新图，首屏会同时挂着两个角色的图。
    本目录由本脚本独占（README.md / manifest.json 不是 .webp，不会被误删）。
    """
    removed = []
    if not os.path.isdir(GALLERY_DIR):
        return removed
    for slug in sorted(os.listdir(GALLERY_DIR)):
        if slug.startswith("."):
            continue                     # .cache/ 等本地衍生目录不归 prune 管
        base = os.path.join(GALLERY_DIR, slug)
        if not os.path.isdir(base):
            # 根目录下只该有 README.md 与 manifest.json；散落的 .webp 也不该留
            if slug.lower().endswith(".webp"):
                os.remove(base)
                removed.append("gallery/" + slug)
            continue
        for fn in sorted(os.listdir(base)):
            full = os.path.join(base, fn)
            rel = "gallery/%s/%s" % (slug, fn)
            if fn.lower().endswith(".webp") and rel not in expected:
                os.remove(full)
                removed.append(rel)
        if not os.listdir(base):
            os.rmdir(base)
    return removed


def main():
    parser = argparse.ArgumentParser(description="生成首屏背景画廊切片")
    parser.add_argument("--check", action="store_true",
                        help="只报告将生成什么，不写文件")
    parser.add_argument("--force", action="store_true",
                        help="忽略缓存与上次结果，全量重做（含重新跑抠图模型）")
    args = parser.parse_args()

    items = sources()
    if not items:
        raise SystemExit("没有找到任何素材：%s" % os.path.relpath(CHAR_DIR, ROOT))

    if not args.check:
        os.makedirs(GALLERY_DIR, exist_ok=True)

    excluded = load_excluded()
    force_matte, skip_matte, matte_reasons = load_matte_overrides()
    prev_by_out, prev_policy = ({}, None) if args.force else load_previous()
    skipped = []
    planned = []
    for slug, src in items:
        key = (slug, os.path.basename(src))
        digest = sha256_file(src)
        if key in excluded:
            skipped.append({"slug": slug, "file": key[1], "kind": "excluded",
                            "source": os.path.relpath(src, ROOT).replace("\\", "/"),
                            "reason": excluded[key]})
            continue
        if is_thumbnail_duplicate(slug, src, digest):
            skipped.append({"slug": slug, "file": key[1], "kind": "thumbnail",
                            "source": os.path.relpath(src, ROOT).replace("\\", "/"),
                            "reason": "与 thumbnails/%s/ 里的缩略图逐字节相同——它本身就是"
                                      "缩略图/头像类，归属地是 thumbnails/，不进画廊图池"
                                      "（原图仍随角色卡下发）" % slug})
            continue

        planned.append({
            "slug": slug, "src": src, "key": key,
            "digest": digest, "thumb": digest[:16],
        })

    # 清单里写了、但 assets/ 里已经没有的条目：多半是文件名写错或源图已删，直接报出来
    known = set((s, os.path.basename(p)) for s, p in sources())
    for key in list(excluded) + list(force_matte) + list(skip_matte):
        if key not in known:
            print("  · 提示清单里的 %s / %s 在 assets/ 中不存在（改名了？）" % key)

    # ---- 第一趟：只做"要不要重做"的判断。能复用的一律不碰图片、不碰模型 ----
    #
    # 复用的条件（必须全部成立，缺一重做）：
    #   ① 口径指纹与上次完全相同（阈值 / 画布 / 质量 / 羽化 / 抠图口径都没动）
    #   ② 源图内容哈希与上次记录相同
    #   ③ 上次那张瓦片还在，且字节数与记录一致（手工改过就重做）
    # 这三条成立时，重做**必然**得到逐字节相同的结果——所以跳过不是"偷懒"，是等价变换。
    prev_matte_used = bool(prev_policy and prev_policy.get("matteModel"))
    matte_overrides = force_matte | skip_matte
    policy_same = prev_policy is not None and prev_policy == policy_fingerprint(
        prev_matte_used, matte_overrides)

    # 编号要先定下来（按 slug、文件名的顺序），复用判断依赖编号
    todo = planned
    per_slug = {}
    for item in todo:
        idx = per_slug.get(item["slug"], 0) + 1
        per_slug[item["slug"]] = idx
        item["rel_out"] = "gallery/%s/%02d.webp" % (item["slug"], idx)
        item["out_path"] = os.path.join(ROOT, *item["rel_out"].split("/"))

    reuse, fresh = [], []
    for item in todo:
        rec = prev_by_out.get(item["rel_out"])
        if (policy_same and rec
                and rec.get("sourceSha256") == item["thumb"]
                and os.path.isfile(item["out_path"])
                and os.path.getsize(item["out_path"]) == rec.get("bytes")):
            reuse.append((item, rec))
        else:
            fresh.append(item)

    records = []
    total_bytes = 0
    counts = {"reuse": 0, "rebuild": 0, "model": 0}
    session = None

    for item, rec in reuse:
        records.append(rec)                       # 原样沿用上次的记录（含实测值）
        total_bytes += rec.get("bytes", 0)
        counts["reuse"] += 1

    # ---- 第二趟：真正要重做的那些，才去量图、定路径、必要时跑模型 ----
    for item in fresh:
        slug, src, key = item["slug"], item["src"], item["key"]
        rel_out, out_path = item["rel_out"], item["out_path"]

        with Image.open(src) as im:
            src_size = "%dx%d" % im.size
            alpha = clear_ratio(im)
            ratio, plain = plain_background(im)

        # 三条归一路径的取舍（顺序即优先级）
        if alpha > ALPHA_CLEAR_RATIO:
            mode = "cutout"          # 源图自带透明底，不必也不该再过模型
        elif key in force_matte:
            mode = "matte"           # 人工判定该抠
        elif key in skip_matte:
            mode = "plate"           # 人工判定不该抠
        elif plain:
            mode = "matte"           # 背景明显纯色 → 交给模型
        elif PLATE_MODE == "skip":
            skipped.append({"slug": slug, "file": key[1], "kind": "plate-skip",
                            "source": os.path.relpath(src, ROOT).replace("\\", "/"),
                            "reason": "plateMode=skip：非纯色底的整块图不进图池"})
            continue
        else:
            mode = "plate"           # 满幅插画 / 照片 / 卡片：整块裁切（+ 羽化）

        counts["rebuild"] += 1
        feathered = False
        fg = None
        if mode == "matte":
            cached = matte_cache_path(item["digest"])
            if os.path.isfile(cached):
                # 命中缓存：只重做裁切/缩放，不碰模型（这正是"改口径不必重抠"的那条路）
                with Image.open(cached) as im:
                    matted = im.convert("RGBA")
                fg = foreground_ratio(matted)
            elif args.check:
                # --check 不跑模型，但要如实报出"真跑的话会需要几次"
                matted = None
                counts["model"] += 1
            else:
                if session is None:
                    session = matte_session()
                counts["model"] += 1
                matted = matte_source(src, session)
                fg = foreground_ratio(matted)
                os.makedirs(CACHE_DIR, exist_ok=True)
                matted.save(cached, "PNG")
                lo, hi = MATTE_FG_RANGE
                if not lo <= fg <= hi:
                    print("  · 注意 %s / %s 抠图前景占比 %.2f，落在合理区间 %s 外——"
                          "模型这次可能没分离出主体，看结果决定是否写进 matte.json 的 skip"
                          % (slug, key[1], fg, MATTE_FG_RANGE))
            tile = fit_cutout(matted) if matted is not None else None
        elif mode == "cutout":
            with Image.open(src) as im:
                tile = fit_cutout(im)
        else:
            with Image.open(src) as im:
                tile = fit_plate(im)
            if PLATE_MODE == "feather":
                tile = feather_edges(tile)
                feathered = True

        if not args.check and tile is not None:
            os.makedirs(os.path.dirname(out_path), exist_ok=True)
            tile.save(out_path, "WEBP", quality=QUALITY, method=WEBP_METHOD)

        size = os.path.getsize(out_path) if os.path.isfile(out_path) else 0
        total_bytes += size
        record = {
            "out": rel_out,
            "slug": slug,
            "source": os.path.relpath(src, ROOT).replace("\\", "/"),
            "sourceSize": src_size,
            "sourceSha256": item["thumb"],
            "alphaClearRatio": round(alpha, 3),
            "mode": mode,
            "plainRatio": round(ratio, 3),
            "feathered": feathered,
            "bytes": size,
        }
        if fg is not None:
            record["matteForeground"] = round(fg, 3)
        records.append(record)
        print("  %-34s %-6s%s ← %s%s" % (
            rel_out.replace("gallery/", ""), mode, "（羽化）" if feathered else "",
            os.path.basename(src), "  [--check 未生成]" if args.check else ""))

    records.sort(key=lambda r: r["out"])
    matte_used = any(r["mode"] == "matte" for r in records)

    if not args.check:
        with open(MANIFEST, "w", encoding="utf-8", newline="\n") as f:
            json.dump({
                "generatedBy": "tools/make_gallery.py",
                # 口径指纹一并留档：这是"为什么每张瓦片长这样"的完整答案，
                # 也是下一次判断"能不能直接跳过"的依据
                "policy": policy_fingerprint(matte_used, matte_overrides),
                "files": records,
                # 排除项一并留档：看 manifest 就能知道"图池为什么少了一张"，
                # 不用去翻 exclude.json 或 git 历史
                "excluded": skipped,
            }, f, ensure_ascii=False, indent=2)
            f.write("\n")

        for rel in prune(set(r["out"] for r in records)):
            print("  已删除孤儿瓦片：%s" % rel)

    for item in skipped:
        label = {"excluded": "已排除（exclude.json）",
                 "thumbnail": "已跳过（与缩略图同一张图）",
                 "plate-skip": "已跳过（plateMode=skip）"}.get(item.get("kind"), "已跳过")
        print("  %s：%s / %s —— %s" % (label, item["slug"], item["file"], item["reason"]))

    for key, reason in sorted(matte_reasons.items()):
        who = "强制抠图" if key in force_matte else "强制不抠"
        print("  例外（matte.json，%s）：%s / %s —— %s" % (who, key[0], key[1], reason))

    if not policy_same and prev_policy is not None:
        print("  · 归一化口径与上次不同 → 全部重做（这是唯一会整批重跑的情况）")

    print("")
    print("瓦片 %d 张（%d 个角色，另排除 %d 张），画布 %d×%d，总计 %.2f MB（均 %.0f KB）" % (
        len(records), len(per_slug), len(skipped), TILE_W, TILE_H,
        total_bytes / 1048576.0, total_bytes / max(1, len(records)) / 1024.0))
    for mode in ("cutout", "matte", "plate"):
        n = sum(1 for r in records if r["mode"] == mode)
        if n:
            print("  %-6s %d 张%s" % (mode, n,
                                     "（含羽化）" if mode == "plate" and PLATE_MODE == "feather" else ""))
    if args.check:
        print("  预计：复用 %d 张 · 重做 %d 张 · 需要跑模型 %d 次" % (
            counts["reuse"], counts["rebuild"], counts["model"]))
    else:
        print("  复用 %d 张（源图与口径都没变，逐字节可直接沿用）· 重做 %d 张 · 跑模型 %d 次%s" % (
            counts["reuse"], counts["rebuild"], counts["model"],
            "" if args.force else "（抠图缓存在 %s）" % os.path.relpath(CACHE_DIR, ROOT)))
    if args.force:
        print("  （--force：忽略缓存与上次结果）")
    if args.check:
        print("（--check：未写入任何文件）")
    else:
        print("manifest -> %s" % os.path.relpath(MANIFEST, ROOT))
    return 0


if __name__ == "__main__":
    sys.exit(main())
