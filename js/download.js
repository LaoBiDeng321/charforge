/**
 * Downloader - 资源下载工具
 * 数据来源：window.SITE_DATA（由 build_data.py 生成的 index.json）
 * 能力：
 *   1. 单文件下载：直接指向 root 下的静态文件 URL
 *   2. 整包 ZIP 下载：优先使用构建期生成的静态 ZIP（含图片）；
 *      若该 ZIP 尚未生成/部署，则在浏览器内抓取全部文件并现场打包（同样含图片）
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

    function absoluteUrl(relOrAbs) {
        try {
            return new URL(relOrAbs, location.href).href;
        } catch (e) {
            return relOrAbs;
        }
    }

    function saveUrl(url, filename) {
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    function saveBlob(blob, filename) {
        var url = URL.createObjectURL(blob);
        saveUrl(url, filename);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }

    var UTF8_BOM = new Uint8Array([0xEF, 0xBB, 0xBF]);

    function withUtf8Bom(u8) {
        var out = new Uint8Array(UTF8_BOM.length + u8.length);
        out.set(UTF8_BOM, 0);
        out.set(u8, UTF8_BOM.length);
        return out;
    }

    /** 下载静态文件。浏览器内现场打包 ZIP，包含 .md 与 assets 图片。 */
    function buildClientZip(entry) {
        var requests = entry.files.map(function (file) {
            return fetch(absoluteUrl(file.url), { cache: 'no-store' })
                .then(function (res) {
                    if (!res.ok) throw new Error('Failed to fetch ' + file.url + ': ' + res.status);
                    return res.arrayBuffer();
                })
                .then(function (buf) {
                    var data = new Uint8Array(buf);
                    if (file.name.toLowerCase().endsWith('.md')) data = withUtf8Bom(data);
                    return { name: entry.slug + '/' + file.name, data: data };
                });
        });

        return Promise.all(requests).then(function (entries) {
            saveBlob(buildZip(entries), entry.slug + '.zip');
            return true;
        }).catch(function (err) {
            console.error('ZIP 现场打包失败：', err);
            return false;
        });
    }

    /* ------------------------------------------
       公开 API
       ------------------------------------------ */
    window.Downloader = {
        /** 单文件下载，如 downloadFile('white-rice-fish-deepseek', 'prompt.md') */
        downloadFile: function (slug, fileName) {
            var file = findFile(slug, fileName);
            if (!file) return false;
            saveUrl(absoluteUrl(file.url), fileName.split('/').pop());
            return true;
        },

        /**
         * 整包 ZIP 下载。
         * 优先使用构建期生成的静态 ZIP（含图片）；不存在时在浏览器内现场打包。
         */
        downloadZip: function (slug) {
            var entry = findEntry(slug);
            if (!entry || !entry.files || entry.files.length === 0) return false;

            var archiveUrl = entry.archive && entry.archive.url;
            if (!archiveUrl) return buildClientZip(entry);

            return fetch(absoluteUrl(archiveUrl), { method: 'HEAD', cache: 'no-store' })
                .then(function (res) {
                    if (res.ok) {
                        saveUrl(absoluteUrl(archiveUrl), entry.slug + '.zip');
                        return true;
                    }
                    return buildClientZip(entry);
                })
                .catch(function () {
                    return buildClientZip(entry);
                });
        }
    };
})();
