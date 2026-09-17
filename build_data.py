# -*- coding: utf-8 -*-
"""
build_data.py —— 资源分享站数据构建脚本
扫描 skills/ 与 char/ 目录，将设定文件内容与展示元数据打包为 web/js/data.js。
前端（含 file:// 本地打开）据此渲染卡片、预览与下载，无需网络请求。

用法：python build_data.py
输出：web/js/data.js （window.SITE_DATA）

输出约定（可读性优先，便于人工审阅与 git diff）：
  1) 采用 2 空格缩进的 pretty JSON，不再单行压缩——此前任何一处改动都会造成整文件 diff；
  2) 每个文件的正文以「行数组」输出，键名 lines，一行一个元素；全文 = lines.join("\\n")。
     这样每段/每行都是独立的一行，diff 只落在真正改动的那几行。
     站点侧消费方必须用 lines.join("\\n") 还原全文（见 web/js/download.js 的 fileText()）；
  3) 仅对 "</script" 做防御性转义，避免日后被内联进 HTML 时截断脚本（JS 中 \\/ 等价于 /，取值不变）；
  4) 固定以 LF（\n）写出，保证 Windows / Linux 上重新生成得到同一份字节；
  5) 角色展示顺序不在构建期固定：由前端按当前语言实时排序（中文拼音 / 英文首字母，见
     web/js/carousel.js 的 orderedChars）。CHARS 里的 "sort" 为可选的读音覆盖键，
     用于多音字（引擎默认读音与实际不符时）钉死排序位置。
"""

import json
import os
from datetime import date

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "web", "js", "data.js")

# 递归收集时排除的目录（版本库与 Python 缓存，不属于交付物）
# 注意：角色交付目录须为纯净目录（10 个设定文件 + assets/），素材缓存等本地工作产物一律放在角色目录之外，
# 因此本脚本不承担“按名排除工作目录”的职责；收录到的任何文件都会进入站点数据。
EXCLUDED_DIRS = {".git", "__pycache__"}

# ---------------------------------------------------------------
# 展示元数据配置（数据与代码分离：改名/加角色只改这张表）
# ---------------------------------------------------------------
SKILLS = [
    {
        "slug": "character-profile-builder",
        "dir": os.path.join("skills", "character-profile-builder"),
        "name": "character-profile-builder",
    },
    {
        "slug": "original-character-builder",
        "dir": os.path.join("skills", "original-character-builder"),
        "name": "original-character-builder",
    },
]

# 角色名分两个字段：name（中文名，检索与缺省回退用）/ nameEn（英文名，英文模式的展示主名）。
# 展示主名随语言切换、副名位置显示另一种语言的名字，实现见 web/js/carousel.js 的 nameOf()。
CHARS = [
    {
        "slug": "deepseek-fish",
        "dir": os.path.join("char", "deepseek-fish"),
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
        "dir": os.path.join("char", "shu-arknights"),
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
        "slug": "priestess",
        "dir": os.path.join("char", "priestess"),
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
        "slug": "citlali",
        "dir": os.path.join("char", "citlali"),
        "name": "茜特菈莉",
        "alias": "CITLALI",
        "nameEn": "Citlali",
        "origin": {"zh-CN": "《原神》官方设定", "en-US": "Genshin Impact Official"},
        "tags": {
            "zh-CN": ["茜特菈莉", "原神", "米哈游"],
            "en-US": ["Citlali", "Genshin Impact", "HoYoverse"],
        },
        # 排序覆盖键（可选）：展示顺序由 carousel.js 用 Intl.Collator 计算——
        # 中文按拼音、英文按首字母；多音字引擎可能读错，用本字段钉死正确读音。
        # 「茜特菈莉」应读 xī，而引擎默认按 qiàn 排（会错排到「黍」之前），故此处覆盖。
        "sort": {"zh-CN": "xitelali"},
    },
    {
        "slug": "alf",
        "dir": os.path.join("char", "alf"),
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
        "slug": "cyrene",
        "dir": os.path.join("char", "cyrene"),
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


def collect_files(rel_dir):
    """递归收集目录内全部文本文件，返回 [{name, lines}]，name 为相对路径（正斜杠）。"""
    files = []
    base = os.path.join(ROOT, rel_dir)
    for dirpath, dirnames, filenames in os.walk(base):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDED_DIRS]
        for fn in sorted(filenames):
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, base).replace("\\", "/")
            try:
                # utf-8-sig：读取时剥离源文件 BOM，避免 BOM 混入 data.js
                with open(full, "r", encoding="utf-8-sig") as f:
                    content = f.read()
            except UnicodeDecodeError:
                continue  # 非文本资源（图片等）不内联，仅跳过
            # 正文按行拆分输出（见文件头「输出约定」第 2 条）
            files.append({"name": rel, "lines": content.split("\n")})
    return files


def build():
    skills_out = []
    for meta in SKILLS:
        skills_out.append({
            "slug": meta["slug"],
            "name": meta["name"],
            "files": collect_files(meta["dir"]),
        })

    chars_out = []
    for meta in CHARS:
        entry = {
            "slug": meta["slug"],
            "name": meta["name"],
            "nameEn": meta["nameEn"],
            "alias": meta["alias"],
            "origin": meta["origin"],
            "tags": meta["tags"],
            "files": collect_files(meta["dir"]),
        }
        # 仅在有排序覆盖键时下发（展示顺序本身由前端按语言计算，见文件头「输出约定」）
        if meta.get("sort"):
            entry["sort"] = meta["sort"]
        chars_out.append(entry)

    data = {
        "generatedAt": date.today().isoformat(),
        "skills": skills_out,
        "chars": chars_out,
    }

    # 可读输出：2 空格缩进 + 中文原文不转义（见文件头「输出约定」）
    payload = json.dumps(data, ensure_ascii=False, indent=2, separators=(",", ": "))
    # 防御：避免 "</script" 在被内联进 HTML 时截断脚本（JS 里 \/ 就等于 /，取值不变）
    payload = payload.replace("</script", "<\\/script")

    # 控制台仅输出英文摘要（cmd 禁止打印中文）
    total_files = sum(len(s["files"]) for s in skills_out) + sum(len(c["files"]) for c in chars_out)
    header = (
        "/* 由 build_data.py 自动生成，请勿手改；重新生成请运行: python build_data.py */\n"
        "/* 生成日 " + data["generatedAt"] + " · 构建器 " + str(len(skills_out)) + " 个 · 角色 " + str(len(chars_out)) + " 个 · 内联文件 " + str(total_files) + " 个 */\n"
        "/* 结构：{ generatedAt, skills[], chars[] }；每项的 files[] 元素为 { name, lines[] }，全文 = lines.join(\"\\n\") */\n"
    )
    js = header + "window.SITE_DATA = " + payload + ";\n"
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    # newline="\n"：固定以 LF 写出。否则 Windows 文本模式会把 \n 转成 CRLF，
    # 导致"本地生成物"与"仓库/线上版本"字节不同（内容一致却 cmp 不等，易被误判为部署异常）。
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write(js)

    print("data.js generated ->", os.path.relpath(OUT, ROOT))
    print("skills: %d, chars: %d, files inlined: %d" % (len(skills_out), len(chars_out), total_files))


if __name__ == "__main__":
    build()
