#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 talisman 的 damerau-levenshtein.js 原样 vendor 进 js/vendor/。

- 算法本体**一字不改**，只在外面套一层 IIFE 并补上浏览器全局名。
- 保留上游 MIT 版权声明（MIT 要求随附）。
- 可重复执行：上游文件升级后重跑即可。
用法：python tools/vendor_dl.py <talisman包路径>
"""
import pathlib
import sys

SRC = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path(
    r"C:\Users\1\AppData\Local\Temp\fuzzlib\node_modules\talisman\metrics\damerau-levenshtein.js")
DST = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else pathlib.Path(
    r"C:\Users\1\Desktop\角色skill\js\vendor\damerau-levenshtein.js")
VERSION = "1.1.4"

body = SRC.read_text(encoding="utf-8")

header = """/**
 * Damerau-Levenshtein distance —— 剪贴自 talisman，算法本体未作任何改动。
 * ---------------------------------------------------------------------------
 * 上游：talisman v%s · https://github.com/yomguithereal/talisman
 * 文件：metrics/damerau-levenshtein.js
 * 许可：MIT License · Copyright (c) 2016-2020 Guillaume Plique (Yomguithereal)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * 本地改动（仅此一处）：上游是 CommonJS 模块，这里用 IIFE 包一层、造出局部的
 * `exports` / `module` 对象使其能在浏览器里直接 <script> 引入，然后在 window 上
 * 暴露 { distance, limited }。**函数实现本身逐字节一致。**
 * 重新生成：python tools/vendor_dl.py
 */
(function (root) {
    var exports = {};
    var module = { exports: exports };

""" % VERSION

footer = """
    root.DamerauLevenshtein = { distance: exports.default, limited: exports.limited };
})(typeof window !== 'undefined' ? window : this);
"""

DST.parent.mkdir(parents=True, exist_ok=True)
DST.write_text(header + body + footer, encoding="utf-8", newline="\n")
print("vendored -> %s (%d bytes, 上游 %d bytes)" % (DST, DST.stat().st_size, len(body.encode("utf-8"))))
