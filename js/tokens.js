/**
 * TokenEstimate - 前端 Token 预估展示工具
 *
 * 数据来源：index.json 中由 build_data.py 预计算的 tokenEstimate 字段。
 * 文本 token 以 DeepSeek 官方 deepseek_v4_tokenizer 离线计数；
 * 图片 token 按逆向自 DeepSeek 官方文档站「图片 Token 计算器」的 v4.1 尺寸公式估算。
 *
 * 计入范围：整个交付包 = 10 个设定文件 + assets/ 图片。**不含 system prompt 与
 * chat 模板**，所以它是「文件原文进入模型」的输入侧估算，不是接口最终 usage。
 *
 * 注意：这只是「以 DeepSeek 为例」的估算示例，不代表使用者会使用 DeepSeek 模型。
 * 不同公司、不同模型、甚至同一模型的不同版本，分词都可能不同；前端只负责格式化展示，
 * 真实消耗以对应模型返回的 usage 为准。
 *
 * 展示口径：
 *   · **单个角色包**的预估显示在角色卡底部与角色索引里（`~ xK TOKENS`），不提供悬停明细。
 *   · **不做全站合计**——预估的粒度就是「一个角色包」，把多个包加起来没有使用场景
 *     （没人会一次性把全站灌进模型），只会被误读成整站开销。故不导出 `entriesTotal`。
 *   · 文案集中在 i18n.js。
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
        compact: compact,
        label: label
    };
})();
