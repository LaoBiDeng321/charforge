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

用法：python build_data.py
"""

import hashlib
import json
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

IMAGE_EXTS = (".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif")

# 递归收集时排除的目录（版本库与 Python 缓存，不属于交付物）
EXCLUDED_DIRS = {".git", "__pycache__"}

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


def load_chars():
    """扫描 meta/*.json，返回 build_entry 需要的 meta 列表（按文件名排序，保证产物可复现）。

    meta 里只需写展示字段：name / alias / nameEn / reading / company / work / origin / tags。
    slug 取文件名（去 .json），dir 取 char/<slug>，两者都不用在 meta 里重复写。
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


def collect_files(rel_dir):
    """递归收集目录内全部文件（含图片），返回 [{name, size, sha256, url}]。"""
    files = []
    base = os.path.join(ROOT, *rel_dir.split("/"))
    for dirpath, dirnames, filenames in os.walk(base):
        # 目录名也排序：os.walk 的下钻顺序依赖文件系统，不排会让文件清单顺序漂移
        dirnames[:] = sorted(d for d in dirnames if d not in EXCLUDED_DIRS)
        for fn in sorted(filenames):
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, base).replace("\\", "/")
            files.append({
                "name": rel,
                "size": os.path.getsize(full),
                "sha256": sha256_file(full),
                # 站点根目录下的可访问 URL，如 char/shu-arknights/SKILL.md
                # 中文图片名做 URL 编码，方便 Agent 脚本直接 curl / fetch
                "url": quote(rel_dir + "/" + rel, safe="/"),
            })
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
    return quote("thumbnails/%s/%s" % (slug, names[0]), safe="/")


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


def build_entry(meta, kind):
    files = collect_files(meta["dir"])
    archive = build_archive(kind, meta["dir"], meta["slug"], files)
    entry = {
        "slug": meta["slug"],
        "name": meta["name"],
        "files": files,
        "archive": archive,
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

    skills_out = [build_entry(meta, "skills") for meta in SKILLS]
    chars_out = [build_entry(meta, "char") for meta in load_chars()]

    stamped = stamp_assets()
    versioned = stamp_version()

    data = {
        "generatedAt": date.today().isoformat(),
        "skills": skills_out,
        "chars": chars_out,
    }

    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, separators=(",", ": "))
        f.write("\n")

    total_files = sum(len(s["files"]) for s in skills_out) + sum(len(c["files"]) for c in chars_out)
    total_zip_bytes = sum(s["archive"]["size"] for s in skills_out) + sum(c["archive"]["size"] for c in chars_out)
    print("index.json generated ->", os.path.relpath(OUT, ROOT))
    print("downloads generated ->", os.path.relpath(DOWNLOADS, ROOT))
    print("index.html asset stamps updated ->", stamped)
    print("index.html version stamp -> %s（命中 %d 处%s）" % (
        date.today().strftime("VER %y.%m.%d"), versioned[0],
        "，已更新" if versioned[1] else "，无需更新"))
    print("skills: %d, chars: %d, files: %d, zip bytes: %d" % (
        len(skills_out), len(chars_out), total_files, total_zip_bytes
    ))


if __name__ == "__main__":
    build()
