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

CHARS = [
    {
        "slug": "white-rice-fish-deepseek",
        "dir": "char/white-rice-fish-deepseek",
        "name": "吃白饭的大肥鱼",
        "alias": "WHITE RICE FISH",
        "nameEn": "White Rice Fish",
        "origin": {"zh-CN": "DeepSeek 社区拟人", "en-US": "DeepSeek Community"},
        "tags": {
            "zh-CN": ["吃白饭的大肥鱼", "DeepSeek 社区拟人", "深度求索"],
            "en-US": ["White Rice Fish", "DeepSeek Community Persona", "DeepSeek"],
        },
    },
    {
        "slug": "shu-arknights",
        "dir": "char/shu-arknights",
        "name": "黍",
        "alias": "SHU",
        "nameEn": "Shu",
        "origin": {"zh-CN": "《明日方舟》官方设定", "en-US": "Arknights Official"},
        "tags": {
            "zh-CN": ["黍", "明日方舟", "鹰角网络"],
            "en-US": ["Shu", "Arknights", "Hypergryph"],
        },
    },
    {
        "slug": "priestess-arknights",
        "dir": "char/priestess-arknights",
        "name": "普瑞赛斯",
        "alias": "PRIESTESS",
        "nameEn": "Priestess",
        "origin": {"zh-CN": "《明日方舟》官方设定", "en-US": "Arknights Official"},
        "tags": {
            "zh-CN": ["普瑞赛斯", "明日方舟", "鹰角网络"],
            "en-US": ["Priestess", "Arknights", "Hypergryph"],
        },
    },
    {
        "slug": "citlali-genshin-impact",
        "dir": "char/citlali-genshin-impact",
        "name": "茜特菈莉",
        "alias": "CITLALI",
        "nameEn": "Citlali",
        "origin": {"zh-CN": "《原神》官方设定", "en-US": "Genshin Impact Official"},
        "tags": {
            "zh-CN": ["茜特菈莉", "原神", "米哈游"],
            "en-US": ["Citlali", "Genshin Impact", "HoYoverse"],
        },
        # 排序覆盖键：前端按语言排序，多音字在此钉死正确读音
        "sort": {"zh-CN": "xitelali"},
    },
    {
        "slug": "alf-silver-palace",
        "dir": "char/alf-silver-palace",
        "name": "阿芙",
        "alias": "ALF",
        "nameEn": "Alf",
        "origin": {"zh-CN": "《白银之城》官方物料", "en-US": "Silver Palace Official"},
        "tags": {
            "zh-CN": ["阿芙", "白银之城", "乐元素"],
            "en-US": ["Alf", "Silver Palace", "Element Games"],
        },
    },
    {
        "slug": "cyrene-honkai-star-rail",
        "dir": "char/cyrene-honkai-star-rail",
        "name": "昔涟",
        "alias": "CYRENE",
        "nameEn": "Cyrene",
        "origin": {"zh-CN": "《崩坏：星穹铁道》官方设定", "en-US": "Honkai: Star Rail Official"},
        "tags": {
            "zh-CN": ["昔涟", "崩坏：星穹铁道", "米哈游"],
            "en-US": ["Cyrene", "Honkai: Star Rail", "HoYoverse"],
        },
    },
]

BOM = b"\xef\xbb\xbf"


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def collect_files(rel_dir):
    """递归收集目录内全部文件（含图片），返回 [{name, size, sha256, url}]。"""
    files = []
    base = os.path.join(ROOT, *rel_dir.split("/"))
    for dirpath, dirnames, filenames in os.walk(base):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDED_DIRS]
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
    """把条目目录下全部文件打包为 <slug>/<相对路径> 的 ZIP。"""
    rel_zip, full_zip = archive_paths(kind, slug)
    os.makedirs(os.path.dirname(full_zip), exist_ok=True)

    with zipfile.ZipFile(full_zip, "w", zipfile.ZIP_DEFLATED) as zf:
        for item in files:
            full = os.path.join(ROOT, *rel_dir.split("/"), *item["name"].split("/"))
            with open(full, "rb") as f:
                data = f.read()
            # 与旧下载行为一致：Markdown 写入 UTF-8 BOM，避免旧版 Windows 编辑器乱码
            if item["name"].lower().endswith(".md"):
                data = BOM + data
            zf.writestr(slug + "/" + item["name"], data)

    return {
        "url": rel_zip,
        "size": os.path.getsize(full_zip),
        "sha256": sha256_file(full_zip),
    }


def build_entry(meta, kind):
    files = collect_files(meta["dir"])
    archive = build_archive(kind, meta["dir"], meta["slug"], files)
    entry = {
        "slug": meta["slug"],
        "name": meta["name"],
        "files": files,
        "archive": archive,
    }
    for key in ("nameEn", "alias", "origin", "tags", "sort"):
        if meta.get(key):
            entry[key] = meta[key]
    if kind == "char":
        thumb = find_thumbnail(meta["slug"])
        if thumb:
            entry["thumbnail"] = thumb
    return entry


def build():
    if os.path.isdir(DOWNLOADS):
        shutil.rmtree(DOWNLOADS)

    skills_out = [build_entry(meta, "skills") for meta in SKILLS]
    chars_out = [build_entry(meta, "char") for meta in CHARS]

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
    print("skills: %d, chars: %d, files: %d, zip bytes: %d" % (
        len(skills_out), len(chars_out), total_files, total_zip_bytes
    ))


if __name__ == "__main__":
    build()
