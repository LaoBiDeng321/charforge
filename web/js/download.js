/**
 * Downloader - 资源下载工具
 * 数据来源：window.SITE_DATA（由 build_data.py 生成）
 * 能力：
 *   1. 单文件下载（text/markdown Blob）
 *   2. 整包 ZIP 下载（store 无压缩格式，纯 JS 实现，无外部依赖，
 *      file:// 本地打开同样可用）
 */

(function () {
    'use strict';

    /* ------------------------------------------
       CRC32（zip 标准多项式 0xEDB88320）
       ------------------------------------------ */
    var CRC_TABLE = (function () {
        var table = new Array(256);
        for (var i = 0; i < 256; i++) {
            var c = i;
            for (var j = 0; j < 8; j++) {
                c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            }
            table[i] = c >>> 0;
        }
        return table;
    })();

    function crc32(u8) {
        var c = 0xFFFFFFFF;
        for (var i = 0; i < u8.length; i++) {
            c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
        }
        return (c ^ 0xFFFFFFFF) >>> 0;
    }

    /* DOS 时间格式（zip 时间戳） */
    function dosDateTime(d) {
        var year = Math.max(d.getFullYear(), 1980);
        return {
            date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
            time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)
        };
    }

    /* ------------------------------------------
       ZIP 打包（store 模式：不压缩，只归档）
       entries: [{ name: 相对路径, data: Uint8Array }]
       ------------------------------------------ */
    function buildZip(entries) {
        var encoder = new TextEncoder();
        var now = dosDateTime(new Date());
        var locals = [];
        var centrals = [];
        var offset = 0;

        entries.forEach(function (entry) {
            var nameU8 = encoder.encode(entry.name);
            var data = entry.data;
            var crc = crc32(data);

            /* Local File Header（30 字节）*/
            var lh = new DataView(new ArrayBuffer(30));
            lh.setUint32(0, 0x04034b50, true);
            lh.setUint16(4, 20, true);      // 解压所需版本
            lh.setUint16(6, 0x0800, true);  // 标志位 bit11：UTF-8 文件名
            lh.setUint16(8, 0, true);       // 压缩方式：store
            lh.setUint16(10, now.time, true);
            lh.setUint16(12, now.date, true);
            lh.setUint32(14, crc, true);
            lh.setUint32(18, data.length, true);
            lh.setUint32(22, data.length, true);
            lh.setUint16(26, nameU8.length, true);
            lh.setUint16(28, 0, true);
            locals.push(new Uint8Array(lh.buffer), nameU8, data);

            /* Central Directory Header（46 字节）*/
            var ch = new DataView(new ArrayBuffer(46));
            ch.setUint32(0, 0x02014b50, true);
            ch.setUint16(4, 20, true);
            ch.setUint16(6, 20, true);
            ch.setUint16(8, 0x0800, true);
            ch.setUint16(10, 0, true);
            ch.setUint16(12, now.time, true);
            ch.setUint16(14, now.date, true);
            ch.setUint32(16, crc, true);
            ch.setUint32(20, data.length, true);
            ch.setUint32(24, data.length, true);
            ch.setUint16(28, nameU8.length, true);
            ch.setUint32(42, offset, true);
            centrals.push(new Uint8Array(ch.buffer), nameU8);

            offset += 30 + nameU8.length + data.length;
        });

        /* End of Central Directory（22 字节）*/
        var centralSize = centrals.reduce(function (sum, part) { return sum + part.length; }, 0);
        var eocd = new DataView(new ArrayBuffer(22));
        eocd.setUint32(0, 0x06054b50, true);
        eocd.setUint16(8, entries.length, true);
        eocd.setUint16(10, entries.length, true);
        eocd.setUint32(12, centralSize, true);
        eocd.setUint32(16, offset, true);

        return new Blob(locals.concat(centrals, [new Uint8Array(eocd.buffer)]), { type: 'application/zip' });
    }

    /* ------------------------------------------
       数据查找
       ------------------------------------------ */
    function findEntry(slug) {
        var data = window.SITE_DATA || { skills: [], chars: [] };
        var i;
        for (i = 0; i < data.skills.length; i++) {
            if (data.skills[i].slug === slug) return data.skills[i];
        }
        for (i = 0; i < data.chars.length; i++) {
            if (data.chars[i].slug === slug) return data.chars[i];
        }
        return null;
    }

    function findFile(slug, fileName) {
        var entry = findEntry(slug);
        if (!entry) return null;
        for (var i = 0; i < entry.files.length; i++) {
            if (entry.files[i].name === fileName) return entry.files[i];
        }
        return null;
    }

    /* ------------------------------------------
       Blob 保存触发
       ------------------------------------------ */
    /* UTF-8 BOM：Windows 下部分编辑器（记事本旧版等）对无 BOM 文本
       默认按 GBK 解码导致中文乱码，写入 BOM 可强制识别为 UTF-8 */
    var UTF8_BOM = '\uFEFF';

    /* 正文还原：data.js 里正文按行数组存储（lines），此处拼回全文。
       兼容旧格式（content 字符串），避免用旧脚本重新生成的数据打不开。 */
    function fileText(file) {
        if (file && Array.isArray(file.lines)) return file.lines.join('\n');
        return (file && file.content) || '';
    }
    /* 暴露给 carousel.js（文件体积显示也需取正文）——本文件在 index.html 中先于 carousel.js 加载。
       正文取用一律走这里，禁止各模块自行假设 data.js 的存储形态。 */
    window.fileText = fileText;
    function saveBlob(blob, filename) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }

    /* ------------------------------------------
       公开 API
       ------------------------------------------ */
    window.Downloader = {
        /** 单文件下载，如 downloadFile('white-rice-fish-deepseek', 'prompt.md') */
        downloadFile: function (slug, fileName) {
            var file = findFile(slug, fileName);
            if (!file) return false;
            saveBlob(
                new Blob([UTF8_BOM + fileText(file)], { type: 'text/markdown;charset=utf-8' }),
                fileName.split('/').pop()
            );
            return true;
        },

        /** 整包 ZIP 下载，目录结构 <slug>/<文件相对路径> */
        downloadZip: function (slug) {
            var entry = findEntry(slug);
            if (!entry || entry.files.length === 0) return false;
            var encoder = new TextEncoder();
            var entries = entry.files.map(function (file) {
                return { name: entry.slug + '/' + file.name, data: encoder.encode(UTF8_BOM + fileText(file)) };
            });
            saveBlob(buildZip(entries), entry.slug + '.zip');
            return true;
        }
    };
})();
