# -*- coding: utf-8 -*-
"""
build_data.py —— 资源分享站数据构建脚本
扫描 skills/ 与 char/ 目录，将设定文件内容与展示元数据打包为 web/js/data.js。
前端（含 file:// 本地打开）据此渲染卡片、预览与下载，无需网络请求。

用法：python build_data.py
输出：web/js/data.js （window.SITE_DATA）
"""

import json
import os
from datetime import date

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "web", "js", "data.js")

# 递归收集时排除的目录（工作缓存 / 版本库，不属于交付物）
EXCLUDED_DIRS = {"sources", ".git", "__pycache__"}

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

CHARS = [
    {
        "slug": "deepseek-fish",
        "dir": os.path.join("char", "deepseek-fish"),
        "name": "吃白饭的大肥鱼",
        "alias": "WHITE RICE FISH",
        "origin": {"zh-CN": "DeepSeek 社区拟人", "en-US": "DeepSeek Community"},
        "tags": {
            "zh-CN": ["聪明但懒", "傲娇嘴甜", "拒绝被叫胖"],
            "en-US": ["Smart but Lazy", "Tsundere Sweet", "Never Call Me Fat"],
        },
    },
    {
        "slug": "shu-arknights",
        "dir": os.path.join("char", "shu-arknights"),
        "name": "黍",
        "alias": "SHU",
        "origin": {"zh-CN": "《明日方舟》官方设定", "en-US": "Arknights Official"},
        "tags": {
            "zh-CN": ["守土的耕耘者", "家长式的温柔", "敬授民时的天师"],
            "en-US": ["Steadfast Cultivator", "Parental Tenderness", "Calendar Sage"],
        },
    },
    {
        "slug": "priestess",
        "dir": os.path.join("char", "priestess"),
        "name": "普瑞赛斯",
        "alias": "PRIESTESS",
        "origin": {"zh-CN": "《明日方舟》官方设定", "en-US": "Arknights Official"},
        "tags": {
            "zh-CN": ["锚点执念", "语言学家式浪漫", "必留后手"],
            "en-US": ["Anchor Obsession", "Linguist Romance", "Always a Fallback"],
        },
    },
    {
        "slug": "citlali",
        "dir": os.path.join("char", "citlali"),
        "name": "茜特菈莉",
        "alias": "CITLALI",
        "origin": {"zh-CN": "《原神》官方设定", "en-US": "Genshin Impact Official"},
        "tags": {
            "zh-CN": ["表演豪放的谨小慎微", "两百年记忆守望", "刀子嘴大责任"],
            "en-US": ["Reckless Act, Cautious Heart", "200-Year Memory Keeper", "Sharp Tongue, Duty First"],
        },
    },
    {
        "slug": "alf",
        "dir": os.path.join("char", "alf"),
        "name": "阿芙",
        "alias": "ALF",
        "origin": {"zh-CN": "《白银之城》官方物料", "en-US": "Silver Palace Official"},
        "tags": {
            "zh-CN": ["绝对守护", "无垢赤子", "烈焰反差"],
            "en-US": ["Absolute Protection", "Pure Heart", "Flame Contrast"],
        },
    },
]


def collect_files(rel_dir):
    """递归收集目录内全部文件，返回 [{name, content}]，name 为相对路径（正斜杠）。"""
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
            files.append({"name": rel, "content": content})
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
        chars_out.append({
            "slug": meta["slug"],
            "name": meta["name"],
            "alias": meta["alias"],
            "origin": meta["origin"],
            "tags": meta["tags"],
            "files": collect_files(meta["dir"]),
        })

    data = {
        "generatedAt": date.today().isoformat(),
        "skills": skills_out,
        "chars": chars_out,
    }

    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    js = ("/* 由 build_data.py 自动生成，请勿手改；重新生成请运行: python build_data.py */\n"
          "window.SITE_DATA = " + payload + ";\n")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(js)

    # 控制台仅输出英文摘要（cmd 禁止打印中文）
    total_files = sum(len(s["files"]) for s in skills_out) + sum(len(c["files"]) for c in chars_out)
    print("data.js generated ->", os.path.relpath(OUT, ROOT))
    print("skills: %d, chars: %d, files inlined: %d" % (len(skills_out), len(chars_out), total_files))


if __name__ == "__main__":
    build()
