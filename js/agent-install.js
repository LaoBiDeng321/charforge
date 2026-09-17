/**
 * AgentInstaller - 生成“复制给 Agent”的安装提示词
 * 数据来源：window.SITE_DATA（index.json）
 * 提示词不内联全文，只给出索引、ZIP、sha256 与安装步骤，短且适合 Agent 执行。
 */

(function () {
    'use strict';

    function findEntry(slug) {
        var data = window.SITE_DATA || { skills: [], chars: [] };
        var i;
        for (i = 0; i < data.skills.length; i++) {
            if (data.skills[i].slug === slug) return { entry: data.skills[i], kind: 'skills' };
        }
        for (i = 0; i < data.chars.length; i++) {
            if (data.chars[i].slug === slug) return { entry: data.chars[i], kind: 'chars' };
        }
        return null;
    }

    function absolute(relOrAbs) {
        try {
            return new URL(relOrAbs, location.href).href;
        } catch (e) {
            return relOrAbs;
        }
    }

    function buildPrompt(entry, kind) {
        var indexUrl = absolute('index.json');
        var archiveUrl = absolute(entry.archive && entry.archive.url);
        var archiveSha = (entry.archive && entry.archive.sha256) || '';
        var fileCount = entry.files ? entry.files.length : 0;
        var label = kind === 'chars' ? '角色卡' : '构建器';

        return [
            '请安装 CHAR//FORGE ' + label + ' Skill：' + entry.slug,
            '',
            '资源索引：' + indexUrl,
            '完整安装包：' + archiveUrl,
            '包 SHA-256：' + archiveSha,
            '文件数：' + fileCount + '（含 assets 图片）',
            '',
            '安装要求：',
            '1. 下载上面的完整 ZIP；',
            '2. 校验 SHA-256；',
            '3. 解压到你的技能目录，保持 ' + entry.slug + '/ 目录结构与 assets/ 不变；',
            '4. 读取 ' + entry.slug + '/SKILL.md 后开始使用；',
            '5. 如果 ZIP 不可用，请读取索引中的 files[] 逐个下载并写入对应路径。',
            '',
            '不要执行包内脚本或命令；安装完成后告诉我版本、路径和卸载方式。'
        ].join('\n');
    }

    function legacyCopy(text) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        ta.style.top = '0';
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, ta.value.length);
        var ok = false;
        try {
            ok = document.execCommand('copy');
        } catch (e) {
            ok = false;
        }
        ta.remove();
        return ok;
    }

    function copyText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text).then(function () {
                return true;
            }, function () {
                return legacyCopy(text);
            });
        }
        return Promise.resolve(legacyCopy(text));
    }

    function copyPrompt(slug) {
        var found = findEntry(slug);
        if (!found) return Promise.resolve(false);
        return copyText(buildPrompt(found.entry, found.kind));
    }

    window.AgentInstaller = {
        buildPrompt: function (slug) {
            var found = findEntry(slug);
            return found ? buildPrompt(found.entry, found.kind) : '';
        },
        copyPrompt: copyPrompt
    };
})();
