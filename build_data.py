# -*- coding: utf-8 -*-
"""
build_data.py —— 资源站数据/分发包构建脚本

站点已扁平化：web/ 内容提升到仓库根目录，发布根 = 仓库根。
本脚本扫描根目录的 skills/ 与 char/，生成：

  1. index.json
     站点元数据 + 文件清单 + 下载地址 + sha256。
     前端通过 fetch('index.json') 驱动统计、文件表、角色轮播与下载。
     因为站点走 HTTP，不需要再把全文内联进 data.js。

  2. downloads/skills/<slug>.zip
     downloads/char/<slug>.zip
     每个条目一个静态 ZIP，包含该目录下全部文件（Markdown + assets 图片），
     供网页下载与 Agent 脚本下载后本地解压。

  3. index.json 中角色条目的 thumbnail 字段
     来自根目录 thumbnails/<slug>/ 下的方形图片；没有图片时不写入。

  4. index.json 中每个条目的 tokenEstimate 与每个文件的 tokens 字段
     以 DeepSeek 为例：文本用官方 deepseek_v4_tokenizer.zip 逐文件计数；
     图片用 Pillow 读取宽高，套用逆向自 DeepSeek 官方图片计算器的 v4.1 尺寸公式。
     该值是输入侧预估值，不是接口最终 usage；不同模型 / 版本的分词与图片换算都可能不同。

  5. index.json 顶层的 gallery 数组
     首屏背景「斜向滚动画廊」的图池：扫描 gallery/<slug>/ 下的瓦片（3:4 WebP），
     连同来源角色 slug 一起下发，前端 js/hero-gallery.js 直接铺成列。
     瓦片**由 tools/make_gallery.py 从 char/<slug>/assets 派生**，本脚本只扫描，
     不做任何图像处理——编码放进构建会让产物字节随 Pillow 版本漂移。

  6. index.html 的两处盖章（原先都是手工步骤，而手工步骤必然会被忘掉——
     页脚版本号就曾一路停在 26.09.14）：
       · 版本号：两处 `VER YY.MM.DD` 改写成构建当天日期。日期制版本没有需要人工
         决定的信息，构建日即发版日；想手工指定就先改 index.html，脚本只在
         日期不一致时改写。
       · 资源戳：给 js/ css/ 引用补 `?v=<sha256 前 8 位>`。文件一变 URL 就变，
         避免浏览器复用旧脚本（症状是「新 HTML + 旧 JS」：界面元素在、逻辑与
         文案缺失）。

构建期自动派生 / 校验（都不需要人工维护）：

  · 拼音与排序键 —— 从 meta 的中英名字、作品名、公司名推导 pinyin /
    pinyinInitials，并把中文排序键写进 sort["zh-CN"]。后者让中文排序不再依赖
    浏览器对 zh 的 collation（ICU 构造失败会静默退化成码点序）。
  · 字段校验 —— meta 缺 name、JSON 不合法、char/<slug>/ 不存在、reading 音节数
    与汉字数不符、官方 tokenizer 缺失、图片读不出尺寸：一律直接报错，不产半成品。
  · tags 软校验（warn_extra_tags）—— tags 是固定格式「角色名 + 作品名 + 公司名」，
    且直接进角色索引第①段的检索键。多塞关键词会改变搜索结果（搜「怪力」会冒出
    某个角色），所以含角色特质时**只警告不中断**。身份串会拆括号与分隔符
    （`三月七（含长夜月）` → `三月七` / `含长夜月` / 整体），让「异名可加」与
    「不许加特质」两条规则同时成立。
  · 共享文件一致性（check_shared_skill_files）—— 两个 builder 各带一份内容相同的
    reference/templates.md（下载包必须自包含，见 reference/LAYERS.md §2.3）。
    两份 sha256 不一致**直接中断构建**：重复可以接受，无声漂移不行。

产物的可复现性（同一份源码同一天重复构建，index.json 与各 ZIP 的 sha256 完全一致）：

  1. ZIP 条目时间戳固定为 1980-01-01 —— zipfile.writestr 传字符串名会取「当前
     时间」当条目时间，于是每次构建 ZIP 字节都不同，index.json 里的 sha256 跟着抖。
  2. ZIP 条目权限位固定 0o644，不受 umask / 平台默认值影响。
  3. 取哈希前把行尾归一化为 LF，且 ZIP 内的 Markdown 也统一 LF（core.autocrlf 会让
     「哪些文件是 CRLF」随检出历史漂移）。

验证方式：连跑两次 `python build_data.py`，`git status` 应无输出。

用法：python build_data.py
"""

import hashlib
import json
import math
import os
import re
import shutil
import zipfile
from datetime import date
from urllib.parse import quote

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "index.json")
DOWNLOADS = os.path.join(ROOT, "downloads")
THUMBNAILS = os.path.join(ROOT, "thumbnails")
GALLERY = os.path.join(ROOT, "gallery")

IMAGE_EXTS = (".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif")
# 参与 Token 预估的文本扩展名。角色卡目前是 .md，留出常见纯文本格式，
# 以便以后把 reference/ 或说明文件也算进去。
TEXT_EXTS = (".md", ".markdown", ".txt", ".json", ".yaml", ".yml", ".csv", ".toml", ".ini")
# DeepSeek 官方 tokenizer 压缩包（来自 docs 的 deepseek_v4_tokenizer.zip）。
TOKENIZER_ZIP = os.path.join(ROOT, "tools", "deepseek_v4_tokenizer.zip")
TOKENIZER_ENTRY = "deepseek_v4_tokenizer/tokenizer.json"

# 递归收集时排除的目录（版本库与 Python 缓存，不属于交付物）
EXCLUDED_DIRS = {".git", "__pycache__"}

# Token 预估依赖：文本用 DeepSeek 官方 tokenizer；图片尺寸用 Pillow 读取。
# 与 pypinyin 一样属于构建期硬依赖，缺了直接报错，不静默降级成粗略估算。
try:
    from tokenizers import Tokenizer
except ImportError as exc:                                   # pragma: no cover
    raise SystemExit(
        "构建需要 tokenizers（读取 DeepSeek 官方 tokenizer.json）。"
        "请先执行： pip install -r requirements.txt"
    ) from exc

try:
    from PIL import Image
except ImportError as exc:                                   # pragma: no cover
    raise SystemExit(
        "构建需要 Pillow（读取 assets 图片尺寸，用于图片 Token 预估）。"
        "请先执行： pip install -r requirements.txt"
    ) from exc

# ---------------------------------------------------------------
# 展示元数据配置（数据与代码分离：改名/加角色只改这张表）
# ---------------------------------------------------------------
SKILLS = [
    {
        "slug": "character-profile-builder",
        "dir": "skills/character-profile-builder",
        "name": "character-profile-builder",
    },
    {
        "slug": "original-character-builder",
        "dir": "skills/original-character-builder",
        "name": "original-character-builder",
    },
]

# ---------------------------------------------------------------
# 角色元数据：每个角色一个 meta/<slug>.json，这里只做目录扫描。
#
# 为什么不再写成一个 CHARS 大表：加一个角色就要动同一个文件，角色一多，
# 「读一遍 build_data.py 才能加人」的成本会随角色数线性上涨（上下文 + 冲突）。
# 拆成一人一文件后，加角色只需新建 meta/<slug>.json + char/<slug>/ 目录，
# 两者同名，slug 由文件名决定（目录名也由它推出，无需重复填写）。
# ---------------------------------------------------------------

META_DIR = "meta"


def check_shared_skill_files():
    """校验两个 skill 包内内容必须一致的共享文件。

    角色构建器是从站点**按目录打包下载**的（ZIP = `skills/<slug>/` 下全部文件），
    用户拿到的是包本身、不是整个仓库。所以：
      · 包内所有相对链接必须落在包内 —— 指向仓库根目录的链接在下载包里是死链；
      · 两个 builder 需要同一份 `templates.md` 时，只能各自带一份、内容保持一致。

    重复不可怕，**无声漂移**才可怕。所以这里直接比对，不一致就中断构建，
    而不是留着两份慢慢长歪。
    """
    shared = "reference/templates.md"
    skills_dir = os.path.join(ROOT, "skills")
    if not os.path.isdir(skills_dir):
        return
    copies = []
    for slug in sorted(os.listdir(skills_dir)):
        path = os.path.join(skills_dir, slug, *shared.split("/"))
        if os.path.isfile(path):
            copies.append((slug, path))
    if len(copies) < 2:
        return
    ref_slug, ref_path = copies[0]
    ref_hash = sha256_file(ref_path)
    for slug, path in copies[1:]:
        if sha256_file(path) != ref_hash:
            raise SystemExit(
                "共享文件内容不一致，构建中止：\n"
                "  skills/%s/%s\n"
                "  skills/%s/%s\n"
                "这两份是给各自的下载包用的（包必须自包含），内容必须逐字节相同。\n"
                "请把其中一份的内容同步到另一份后重新构建。"
                % (ref_slug, shared, slug, shared)
            )


def warn_extra_tags(fn, meta):
    """tags 是统一格式：角色名 + 作品名 + 公司名，不加角色特质。

    tags 直接进角色索引第①段的检索键，多塞关键词会改变搜索结果
    （搜「怪力」会冒出某个角色），所以这里做一次软校验：只警告，不中断构建。

    身份串的拆法：整串算一个候选，再拆出「括号内内容」与「去掉括号后的其余部分」，
    并按 `/`、`、`、空白切词（`三月七（含长夜月）` → `三月七` / `含长夜月` / 整体）。
    这样「异名可以加」与「不能加特质」两条规则能同时成立。
    """
    tags = meta.get("tags")
    if not isinstance(tags, dict):
        return

    identity = []
    for key in ("name", "nameEn", "alias"):
        if meta.get(key):
            identity.append(str(meta[key]))
    for field in ("company", "work"):
        block = meta.get(field)
        if isinstance(block, dict):
            for key in ("zh-CN", "en-US"):
                if block.get(key):
                    identity.append(str(block[key]))

    expected = set()
    for raw in identity:
        raw = raw.strip().lower()
        if not raw:
            continue
        expected.add(raw)
        for inner in re.findall(r"[（(]([^）)]*)[）)]", raw):
            if inner.strip():
                expected.add(inner.strip())
        stripped = re.sub(r"[（(][^）)]*[）)]", " ", raw)
        for part in re.split(r"[/、,，\s]+", stripped):
            if len(part.strip()) >= 2:
                expected.add(part.strip())

    for lang in sorted(tags.keys()):
        values = tags[lang]
        if not isinstance(values, list):
            continue
        for value in values:
            if str(value).strip().lower() not in expected:
                print(
                    "  · 提示 meta/%s 的 tags[%s] 含非「角色名/作品名/公司名」条目：%r\n"
                    "    tags 是统一格式（角色名 + 作品名 + 公司名），角色特质请写进 profile.md，\n"
                    "    否则会被角色索引当成检索键（搜该词会命中该角色）。见 README「新增角色」。"
                    % (fn, lang, value)
                )


def load_chars():
    """扫描 meta/*.json，返回 build_entry 需要的 meta 列表（按文件名排序，保证产物可复现）。

    meta 里只需写展示字段：name / alias / nameEn / reading / company / work / origin / tags。
    slug 取文件名（去 .json），dir 取 char/<slug>，两者都不用在 meta 里重复写。
    tags 是统一格式：角色名 + 作品名 + 公司名（不加角色特质），见 warn_extra_tags。
    """
    base = os.path.join(ROOT, META_DIR)
    if not os.path.isdir(base):
        return []
    out = []
    for fn in sorted(os.listdir(base)):
        if not fn.endswith(".json"):
            continue
        slug = fn[:-5]
        path = os.path.join(base, fn)
        try:
            with open(path, "r", encoding="utf-8") as f:
                meta = json.load(f)
        except ValueError as exc:
            raise SystemExit("meta/%s 不是合法 JSON：%s" % (fn, exc))
        if not meta.get("name"):
            raise SystemExit("meta/%s 缺少必要字段 name" % fn)
        warn_extra_tags(fn, meta)
        meta["slug"] = slug
        meta["dir"] = "char/" + slug
        if not os.path.isdir(os.path.join(ROOT, *meta["dir"].split("/"))):
            raise SystemExit("meta/%s 对应的交付目录 %s/ 不存在" % (fn, meta["dir"]))
        out.append(meta)
    return out



# ZIP 条目固定时间戳（1980-01-01），保证构建产物可复现
ZIP_EPOCH = (1980, 1, 1, 0, 0, 0)

BOM = b"\xef\xbb\xbf"


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


CRLF = b"\r\n"


def sha256_text_lf(path):
    """文本资源取哈希前先把行尾归一化成 LF。

    为什么要归一化：`core.autocrlf` 会把检出到工作区的文本文件转成 CRLF，
    而「哪些文件被转过」取决于检出历史——同一份仓库在不同平台 / 不同机器上
    算出的原始字节哈希并不一致。若直接按原始字节取哈希，index.html 里的
    ?v= 戳会随平台漂移，产物反复 churn（index.json 的 ZIP sha256 同理）。
    归一化后，LF 与 CRLF 的工作副本得到同一个戳。
    """
    with open(path, "rb") as f:
        return hashlib.sha256(f.read().replace(CRLF, b"\n")).hexdigest()


def file_kind(name):
    """按扩展名区分 text / image / other，用于汇总 Token 预估。"""
    lower = name.lower()
    if lower.endswith(IMAGE_EXTS):
        return "image"
    if lower.endswith(TEXT_EXTS):
        return "text"
    return "other"


def load_deepseek_tokenizer():
    """读取 DeepSeek 官方 tokenizer.json。

    官方文档提供的是 deepseek_v4_tokenizer.zip；这里直接读压缩包内文件，
    不落盘解压，保持仓库目录干净。缺失时直接报错，避免静默产出无 Token 的索引。
    """
    if not os.path.isfile(TOKENIZER_ZIP):
        raise SystemExit(
            "缺少 DeepSeek 官方 tokenizer：%s\n"
            "请从 https://api-docs.deepseek.com/zh-cn/quick_start/token_usage/ "
            "下载 deepseek_v4_tokenizer.zip 并放到 tools/ 下。"
            % os.path.relpath(TOKENIZER_ZIP, ROOT)
        )
    try:
        with zipfile.ZipFile(TOKENIZER_ZIP) as zf:
            raw = zf.read(TOKENIZER_ENTRY)
    except (KeyError, zipfile.BadZipFile) as exc:
        raise SystemExit("无法读取 %s 内的 %s：%s" % (
            os.path.relpath(TOKENIZER_ZIP, ROOT), TOKENIZER_ENTRY, exc
        )) from exc
    try:
        return Tokenizer.from_str(raw.decode("utf-8"))
    except Exception as exc:
        raise SystemExit("DeepSeek tokenizer.json 解析失败：%s" % exc) from exc


def count_text_tokens(tokenizer, path):
    """按官方 tokenizer 统计一个文本文件的 token 数。

    这里没有拼接 chat template / system prompt，所以它代表「把文件原文喂给模型」
    的输入 token 预估，不等于一次对话的最终消耗。
    """
    with open(path, "r", encoding="utf-8-sig", errors="replace") as f:
        text = f.read()
    # 与官方 deepseek_tokenizer.py 的 tokenizer.encode() 一致（该 tokenizer 配置
    # add_bos_token / add_eos_token 均为 false，不会额外加特殊 token）。
    return len(tokenizer.encode(text, add_special_tokens=False).ids)


def image_size(path):
    """用 Pillow 读取图片像素尺寸；图片 Token 公式只依赖宽高，不依赖完整解码。"""
    with Image.open(path) as im:
        return im.size


def _floor_div(a, b):
    return a // b


def _ceil_div(a, b):
    return (a + b - 1) // b


def _trunc(value):
    return math.trunc(value)


class DeepSeekImageTokenizer:
    """DeepSeek v4.1 图片 Token 预估公式。

    逆向自 DeepSeek 官方文档站「图片 Token 计算器」的纯前端实现
    （https://api-docs.deepseek.com/zh-cn/quick_start/token_usage/）。
    这里只保留 v4.1 配置，并逐行对应原实现的取整 / 缩放 / 上限逻辑。
    """

    def __init__(self, patch_size, downsample_ratio, max_n_token, is_n_layout,
                 compress_pad_to=None, max_wh_ratio=None, min_pixels=None):
        self.patch_size = patch_size
        self.downsample_ratio = downsample_ratio
        self.max_n_token = max_n_token
        self.is_n_layout = is_n_layout
        self.compress_pad_to = compress_pad_to
        self.max_wh_ratio = max_wh_ratio
        self.min_pixels = min_pixels

    @classmethod
    def v41(cls):
        # 官方计算器实际使用的是 v41 配置（1024 token 上限，最小 295936 像素）。
        return cls(14, 3, 1024, False, None, None, 295936)

    def worst_pad(self):
        return self.compress_pad_to - 1 if self.is_n_layout and self.compress_pad_to is not None else 0

    def actual_pad(self, value):
        if not (self.is_n_layout and self.compress_pad_to is not None):
            return 0
        if value is None:
            return self.compress_pad_to - 1
        return (self.compress_pad_to - ((value + 1) % self.compress_pad_to)) % self.compress_pad_to

    def calc_num_tokens(self, height, width):
        tokens = height * (width + 1) + 2
        if self.is_n_layout:
            if height % 2 == 1:
                tokens += width + 1
            tokens += ((_ceil_div(height, 2) * (width + 1)) % 2) * 2
        return tokens

    def solve_resize_ratio(self, original_height, original_width, max_tokens):
        ratio = original_height / original_width
        fit_h = math.sqrt((max_tokens - 2) / ratio + 0.25) - 0.5
        fit_w = fit_h * ratio

        if fit_h < 1:
            target_h = 1
            target_w = _floor_div(max_tokens - 2, target_h + 1)
            if self.is_n_layout and target_w % 2 == 1:
                target_w -= 1
            best_width = target_h * self.patch_size * self.downsample_ratio
            best_height = target_w * self.patch_size * self.downsample_ratio
        elif fit_w < (2 if self.is_n_layout else 1):
            target_h = 2 if self.is_n_layout else 1
            target_w = _floor_div(max_tokens - 2, target_h) - 1
            if not target_w > 1:
                raise ValueError("图片 Token 缩放参数无解")
            best_width = target_w * self.patch_size * self.downsample_ratio
            best_height = target_h * self.patch_size * self.downsample_ratio
        else:
            target_h = _trunc(fit_h)
            target_w = _trunc(fit_w)
            if self.is_n_layout and target_w % 2 == 1:
                target_w -= 1
            scale_h = (target_h * self.patch_size * self.downsample_ratio) / original_width
            scale_w = (target_w * self.patch_size * self.downsample_ratio) / original_height
            scale = min(scale_h, scale_w)
            best_width = _trunc((original_width * scale) / self.patch_size) * self.patch_size
            best_height = _trunc((original_height * scale) / self.patch_size) * self.patch_size

        n_llm_h = _ceil_div(_floor_div(best_height, self.patch_size), self.downsample_ratio)
        n_llm_w = _ceil_div(_floor_div(best_width, self.patch_size), self.downsample_ratio)
        return {
            "nLlmH": n_llm_h,
            "nLlmW": n_llm_w,
            "bestHeight": best_height,
            "bestWidth": best_width,
            "numTokens": self.calc_num_tokens(n_llm_h, n_llm_w),
        }

    def safe_resize(self, original_height, original_width, padded_height, padded_width):
        n_llm_h = _ceil_div(_floor_div(padded_height, self.patch_size), self.downsample_ratio)
        n_llm_w = _ceil_div(_floor_div(padded_width, self.patch_size), self.downsample_ratio)
        num_tokens = self.calc_num_tokens(n_llm_h, n_llm_w)
        worst_pad = self.worst_pad()
        limit = self.max_n_token - worst_pad
        result = {
            "nLlmH": n_llm_h,
            "nLlmW": n_llm_w,
            "bestHeight": padded_height,
            "bestWidth": padded_width,
            "numTokens": num_tokens,
        }
        if result["numTokens"] > limit:
            result = self.solve_resize_ratio(original_height, original_width, limit)
            if self.is_n_layout:
                budget = limit
                while result["numTokens"] > limit:
                    budget -= 1
                    result = self.solve_resize_ratio(original_height, original_width, budget)
            if not result["numTokens"] <= limit:
                raise ValueError("图片 Token 缩放结果超过上限")
        result["numTokens"] += worst_pad
        return result

    def calc_resize_inner(self, width, height, pad_arg):
        if self.max_wh_ratio is not None and width > height * self.max_wh_ratio:
            width = height * self.max_wh_ratio
        pixels = width * height
        if self.min_pixels is not None and 0 < pixels < self.min_pixels:
            scale = math.sqrt(self.min_pixels / pixels)
            width = _trunc(width * scale)
            height = _trunc(height * scale)
        padded_width = _ceil_div(width, self.patch_size) * self.patch_size
        padded_height = _ceil_div(height, self.patch_size) * self.patch_size
        worst_pad = self.worst_pad()
        actual_pad = self.actual_pad(pad_arg)
        result = self.safe_resize(height, width, padded_height, padded_width)
        result["numTokens"] -= worst_pad - actual_pad
        return result

    def calc_resize(self, width, height, pad_arg=None):
        result = self.calc_resize_inner(width, height, pad_arg)
        for _ in range(1, 10):
            next_result = self.calc_resize_inner(
                result["bestWidth"], result["bestHeight"], pad_arg
            )
            if next_result == result:
                return result
            result = next_result
        raise ValueError("图片 Token 尺寸迭代不收敛")

    def calc_token_len(self, width, height, pad_arg=None):
        return self.calc_resize(width, height, pad_arg)["numTokens"]


_IMAGE_TOKENIZER = DeepSeekImageTokenizer.v41()


def image_token_count(width, height):
    """给定像素宽高，返回 DeepSeek 图片 Token 预估值。"""
    return _IMAGE_TOKENIZER.calc_token_len(int(width), int(height))


def collect_files(rel_dir, tokenizer):
    """递归收集目录内全部文件（含图片），返回 [{name, size, sha256, url, ...}]。

    文本文件附加 `tokens`（官方 tokenizer 精确计数）；图片附加 `width` / `height` /
    `tokens`（官方图片 Token 公式，按像素尺寸估算）。
    """
    files = []
    base = os.path.join(ROOT, *rel_dir.split("/"))
    for dirpath, dirnames, filenames in os.walk(base):
        # 目录名也排序：os.walk 的下钻顺序依赖文件系统，不排会让文件清单顺序漂移
        dirnames[:] = sorted(d for d in dirnames if d not in EXCLUDED_DIRS)
        for fn in sorted(filenames):
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, base).replace("\\", "/")
            item = {
                "name": rel,
                "size": os.path.getsize(full),
                "sha256": sha256_file(full),
                # 站点根目录下的可访问 URL，如 char/shu-arknights/SKILL.md
                # 中文图片名做 URL 编码，方便 Agent 脚本直接 curl / fetch
                "url": quote(rel_dir + "/" + rel, safe="/"),
            }
            kind = file_kind(rel)
            if kind == "text":
                item["tokens"] = count_text_tokens(tokenizer, full)
            elif kind == "image":
                width, height = image_size(full)
                item["width"] = width
                item["height"] = height
                item["tokens"] = image_token_count(width, height)
            files.append(item)
    return files


def find_thumbnail(slug):
    """在 thumbnails/<slug>/ 中找一张方形缩略图；优先 cover / thumbnail 前缀。"""
    base = os.path.join(THUMBNAILS, slug)
    if not os.path.isdir(base):
        return None
    names = [n for n in os.listdir(base) if n.lower().endswith(IMAGE_EXTS)]
    if not names:
        return None

    def rank(name):
        lower = name.lower()
        for i, prefix in enumerate(("cover", "thumbnail", "thumb", "square")):
            if lower.startswith(prefix):
                return i
        return len(("cover", "thumbnail", "thumb", "square"))

    names.sort(key=lambda n: (rank(n), n.lower()))
    rel = "thumbnails/%s/%s" % (slug, names[0])
    full = os.path.join(ROOT, *rel.split("/"))
    # 缩略图 URL 带内容 hash：图片替换后 URL 变化，浏览器不会继续复用旧缓存。
    # 之前只替换同路径文件时，index.json 虽已更新，但浏览器仍可能拿旧图。
    return quote(rel, safe="/") + "?v=" + sha256_file(full)[:8]


def collect_gallery():
    """扫描 gallery/<slug>/ 下的首屏背景瓦片，返回扁平图池。

    与 thumbnails/ 同一分工：图片是**一次生成、入库**的派生物（生成器
    tools/make_gallery.py，规则见 gallery/README.md），构建期只做扫描与打戳。
    把编码放进构建会让产物字节随 Pillow 版本漂移，index.json 跟着抖——
    可复现性要求见本文件头部注释。

    带 slug 是有用的：前端按 slug 分桶后再轮转取图，避免某个素材多的角色
    （如三月七 10 张）在画廊里连成一片。顺序按 slug、文件名排，保证可复现。
    """
    if not os.path.isdir(GALLERY):
        return []
    out = []
    for slug in sorted(os.listdir(GALLERY)):
        base = os.path.join(GALLERY, slug)
        if not os.path.isdir(base):
            continue
        # 跳过 .cache/ 这类衍生目录（生成器的本地抠图缓存，见 tools/make_gallery.py）：
        # 目录名以点开头的一律不算角色目录，否则缓存里的中间图会被当成瓦片下发
        if slug.startswith("."):
            continue
        for fn in sorted(os.listdir(base)):
            if not fn.lower().endswith(IMAGE_EXTS):
                continue
            rel = "gallery/%s/%s" % (slug, fn)
            full = os.path.join(ROOT, *rel.split("/"))
            # 与缩略图同理：图片换掉后 URL 变化，浏览器不会继续复用旧瓦片
            out.append({
                "url": quote(rel, safe="/") + "?v=" + sha256_file(full)[:8],
                "slug": slug,
            })
    return out


def archive_paths(kind, slug):
    rel_zip = "downloads/%s/%s.zip" % (kind, slug)
    full_zip = os.path.join(ROOT, *rel_zip.split("/"))
    return rel_zip, full_zip


def build_archive(kind, rel_dir, slug, files):
    """把条目目录下全部文件打包为 <slug>/<相对路径> 的 ZIP。

    条目时间戳与权限位**固定**，保证构建产物可复现：
    zf.writestr(名字字符串, 数据) 会拿「当前时间」当条目时间，
    于是每次构建 ZIP 字节都不同，index.json 里的 sha256 跟着抖，
    每次跑一遍 build_data.py 都会产生无意义的 diff。
    """
    rel_zip, full_zip = archive_paths(kind, slug)
    os.makedirs(os.path.dirname(full_zip), exist_ok=True)

    with zipfile.ZipFile(full_zip, "w", zipfile.ZIP_DEFLATED) as zf:
        for item in files:
            full = os.path.join(ROOT, *rel_dir.split("/"), *item["name"].split("/"))
            with open(full, "rb") as f:
                data = f.read()
            # 与旧下载行为一致：Markdown 写入 UTF-8 BOM，避免旧版 Windows 编辑器乱码
            # 同时把行尾统一成 LF —— 否则 core.autocrlf 会让同一份卡在不同平台上
            # 打出字节不同的 ZIP，archive.sha256 跟着漂移
            if item["name"].lower().endswith(".md"):
                data = BOM + data.replace(CRLF, b"\n")
            info = zipfile.ZipInfo(slug + "/" + item["name"], date_time=ZIP_EPOCH)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16      # 固定权限位，免受 umask / 平台默认值影响
            zf.writestr(info, data)

    return {
        "url": rel_zip,
        "size": os.path.getsize(full_zip),
        "sha256": sha256_file(full_zip),
    }


# ---------------------------------------------------------------
# 汉字 → 拼音（构建期自动推导，替代人工维护 pinyin 字段）
#
# 依赖 pypinyin（MIT），**硬依赖**：未安装直接报错，不静默降级——
# 否则改了角色名却沿用上一次的拼音，会悄悄产出错的检索键。
# 多音字由 pypinyin 自动判定；库判错时在对应条目里写 "reading" 覆盖（全站目前仅一处）。
# ---------------------------------------------------------------

try:
    from pypinyin import lazy_pinyin, Style
except ImportError as exc:                                   # pragma: no cover
    raise SystemExit(
        "构建需要 pypinyin（把汉字名转成拼音检索键）。"
        "请先执行： pip install -r requirements.txt"
        "（只做本地预览 python -m http.server 不需要装任何东西）"
    ) from exc


def letters_only(s):
    return "".join(ch for ch in s.lower() if "a" <= ch <= "z")


def cjk_count(s):
    return sum(1 for ch in s if "一" <= ch <= "鿿")


def to_pinyin(text, reading=None):
    """返回 (全拼, 首字母, 音节表)。

    reading：人工覆盖，**空格分隔逐字读音**（如 "xi te la li"）。仅在库判错读音时使用。
    覆盖值做音节数校验——个数必须等于原文汉字数，否则直接报错，
    避免静默产出错误的首字母（首字母是从音节首字母拼出来的）。

    音节表下发给前端做「音节级重排匹配」：把 dayufei 和 da-fei-yu 按音节比，
    而不是按字符串距离比（字符级距离对音节换位完全无感）。第三方库的逐字结果
    本身就是音节切分，覆盖值也天然是空格分隔的——两边都不需要额外的音节词典。
    """
    if reading:
        units = [letters_only(u) for u in re.split(r"[\s\-_/]+", reading.strip())]
        units = [u for u in units if u]
        if not units:
            raise ValueError("reading 为空：%r" % (reading,))
        n = cjk_count(text)
        if n and len(units) != n:
            raise ValueError(
                "reading 音节数(%d) 与 %r 的汉字数(%d) 不一致：%r" % (len(units), text, n, reading))
        return "".join(units), "".join(u[0] for u in units), units

    units = [letters_only(u) for u in lazy_pinyin(text)]
    units = [u for u in units if u]
    full = "".join(units)
    ini = letters_only("".join(lazy_pinyin(text, style=Style.FIRST_LETTER)))
    if not full:
        raise ValueError("无法为 %r 生成拼音" % (text,))
    return full, ini, units


def attach_pinyin(entry, meta):
    """给角色条目及其 company / work 挂上拼音三件套；并下发中文排序键。

    拼音三件套 = pinyin（全拼）/ pinyinInitials（首字母）/ pinyinSyllables（音节表）。
    排序键交给前端已有的 char.sort[lang] 机制，这样中文排序不再依赖浏览器对
    zh 的 collation（ICU 构造失败会静默退化成码点序），跨引擎结果一致。
    """
    full, ini, units = to_pinyin(meta["name"], meta.get("reading"))
    entry["pinyin"], entry["pinyinInitials"] = full, ini
    entry["pinyinSyllables"] = units
    entry.setdefault("sort", {})["zh-CN"] = full

    for key in ("company", "work"):
        obj = meta.get(key)
        if not obj:
            continue
        full, ini, units = to_pinyin(obj.get("zh-CN") or "", obj.get("reading"))
        obj["pinyin"], obj["pinyinInitials"], obj["pinyinSyllables"] = full, ini, units
        obj.pop("reading", None)


def build_entry(meta, kind, tokenizer):
    files = collect_files(meta["dir"], tokenizer)
    archive = build_archive(kind, meta["dir"], meta["slug"], files)
    text_tokens = sum(f.get("tokens", 0) for f in files if file_kind(f["name"]) == "text")
    image_tokens = sum(f.get("tokens", 0) for f in files if file_kind(f["name"]) == "image")
    entry = {
        "slug": meta["slug"],
        "name": meta["name"],
        "files": files,
        "archive": archive,
        # Token 预估值：以 DeepSeek 为例，文本 + assets 图片都算，覆盖整个交付包。
        # 它是「文件原文进入模型」的输入侧估算，不含 system prompt / chat 模板，
        # 也不代表接口最终 usage；不同模型 / 版本的结果可能不同，详见 README。
        "tokenEstimate": {
            "text": text_tokens,
            "image": image_tokens,
            "total": text_tokens + image_tokens,
            "textFiles": sum(1 for f in files if file_kind(f["name"]) == "text"),
            "imageFiles": sum(1 for f in files if file_kind(f["name"]) == "image"),
        },
    }
    for key in ("nameEn", "alias", "origin", "tags", "sort", "company", "work"):
        if meta.get(key):
            entry[key] = meta[key]
    if kind == "char":
        attach_pinyin(entry, meta)
        thumb = find_thumbnail(meta["slug"])
        if thumb:
            entry["thumbnail"] = thumb
    return entry


ASSET_REF_RE = re.compile(
    r'(?P<attr>\b(?:href|src)=")(?P<path>(?:js|css)/[^"?]+\.(?:js|css))(?:\?v=[0-9a-fA-F]+)?"'
)


def stamp_assets():
    """给 index.html 里的 js/css 引用打上内容哈希（?v=<sha256 前 8 位>）。

    为什么要做：静态资源原本没有任何版本标识，浏览器（尤其本地 python -m http.server
    这种不发强缓存头的环境）会按启发式规则复用旧副本，出现"HTML 已更新、脚本还是旧的"
    的错配——表现为界面元素在、但渲染逻辑和文案缺失。内容哈希让文件一变 URL 就变。
    本函数可重复执行：已带 ?v= 的引用会被原地改写，不会叠加。
    """
    page = os.path.join(ROOT, "index.html")
    if not os.path.isfile(page):
        return 0
    with open(page, "r", encoding="utf-8", newline="") as f:
        src = f.read()

    changed = [0]

    def repl(m):
        rel = m.group("path")
        full = os.path.join(ROOT, *rel.split("/"))
        digest = sha256_text_lf(full)[:8] if os.path.isfile(full) else "00000000"
        out = "%s%s?v=%s\"" % (m.group("attr"), rel, digest)
        if out != m.group(0):
            changed[0] += 1
        return out

    out = ASSET_REF_RE.sub(repl, src)
    if out != src:
        with open(page, "w", encoding="utf-8", newline="") as f:
            f.write(out)
    return changed[0]


VERSION_RE = re.compile(r"VER \d{2}\.\d{2}\.\d{2}")


def stamp_version():
    """把 index.html 里的版本号改写成构建当天日期（VER YY.MM.DD）。

    版本号是日期制的（开屏与页脚各一处），原先靠手工维护——结果一路停在
    26.09.14，中间加了角色、改了检索都没人动它。日期制版本本来就没有需要
    人工决定的信息：构建当天就是发版日，直接盖戳即可，顺手抹掉一步容易忘的
    手工操作。同一份源码在同一天重复构建，结果仍完全一致（可复现性不受影响）。
    """
    page = os.path.join(ROOT, "index.html")
    if not os.path.isfile(page):
        return 0
    with open(page, "r", encoding="utf-8", newline="") as f:
        src = f.read()
    out, count = VERSION_RE.subn(date.today().strftime("VER %y.%m.%d"), src)
    if out != src:
        with open(page, "w", encoding="utf-8", newline="") as f:
            f.write(out)
        return count, True
    return count, False


def build():
    if os.path.isdir(DOWNLOADS):
        shutil.rmtree(DOWNLOADS)

    check_shared_skill_files()
    tokenizer = load_deepseek_tokenizer()
    skills_out = [build_entry(meta, "skills", tokenizer) for meta in SKILLS]
    chars_out = [build_entry(meta, "char", tokenizer) for meta in load_chars()]

    stamped = stamp_assets()
    versioned = stamp_version()

    data = {
        "generatedAt": date.today().isoformat(),
        "gallery": collect_gallery(),
        "skills": skills_out,
        "chars": chars_out,
    }

    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, separators=(",", ": "))
        f.write("\n")

    total_files = sum(len(s["files"]) for s in skills_out) + sum(len(c["files"]) for c in chars_out)
    total_tokens = sum(s["tokenEstimate"]["total"] for s in skills_out) + sum(
        c["tokenEstimate"]["total"] for c in chars_out)
    total_zip_bytes = sum(s["archive"]["size"] for s in skills_out) + sum(c["archive"]["size"] for c in chars_out)
    print("index.json generated ->", os.path.relpath(OUT, ROOT))
    print("downloads generated ->", os.path.relpath(DOWNLOADS, ROOT))
    print("index.html asset stamps updated ->", stamped)
    print("index.html version stamp -> %s（命中 %d 处%s）" % (
        date.today().strftime("VER %y.%m.%d"), versioned[0],
        "，已更新" if versioned[1] else "，无需更新"))
    print("skills: %d, chars: %d, files: %d, token estimate: %d, zip bytes: %d" % (
        len(skills_out), len(chars_out), total_files, total_tokens, total_zip_bytes
    ))
    print("gallery tiles -> %d（缺失时跑 python tools/make_gallery.py）" % len(data["gallery"]))


if __name__ == "__main__":
    build()
