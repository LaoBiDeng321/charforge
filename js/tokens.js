/**
 * TokenEstimate - 前端 Token 预估展示工具
 *
 * 数据来源：index.json 中由 build_data.py 预计算的 tokenEstimate 字段。
 * 文本 token 以 DeepSeek 官方 deepseek_v4_tokenizer 离线计数；
 * 图片 token 按逆向自 DeepSeek 官方文档站「图片 Token 计算器」的 v4.1 尺寸公式估算。
 *
 * 注意：这只是「以 DeepSeek 为例」的估算示例，不代表使用者会使用 DeepSeek 模型。
 * 不同公司、不同模型、甚至同一模型的不同版本，分词都可能不同；前端只负责格式化展示，
 * 真实消耗以对应模型返回的 usage 为准。
 */

(function () {
    'use strict';

    var UNITS = ['', 'K', 'M', 'B'];

    function number(value) {
        var n = Number(value);
        return isFinite(n) && n > 0 ? n : 0;
    }

    function entryTotal(entry) {
        return number(entry && entry.tokenEstimate && entry.tokenEstimate.total);
    }

    function entriesTotal(entries) {
        if (!entries || !entries.length) return 0;
        var sum = 0;
        for (var i = 0; i < entries.length; i++) {
            sum += entryTotal(entries[i]);
        }
        return sum;
    }

    /** 182921 -> "182.9K"；不足 1000 时原样显示 */
    function compact(value) {
        var n = number(value);
        if (n < 1000) return String(Math.round(n));
        var unit = 0;
        while (n >= 1000 && unit < UNITS.length - 1) {
            n /= 1000;
            unit += 1;
        }
        var digits = n >= 100 ? 0 : 1;
        return n.toFixed(digits).replace(/\.0$/, '') + UNITS[unit];
    }

    /** 卡片 / 索引上的短标签：~182.9K TOKENS */
    function label(entry) {
        var unit = (window.I18N && window.I18N.t) ? window.I18N.t('token.unit') : 'TOKENS';
        return '~' + compact(entryTotal(entry)) + ' ' + unit;
    }

    window.TokenEstimate = {
        entriesTotal: entriesTotal,
        compact: compact,
        label: label
    };
})();
