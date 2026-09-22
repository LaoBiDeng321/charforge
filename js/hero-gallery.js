/**
 * HeroGallery - 首屏背景「斜向滚动画廊」
 *
 * 首屏（且只在首屏）的背景层：多列角色立绘切片竖向滚动，画布整体旋转 -12°，
 * 于是看上去是斜向流动。图片是 char/<slug>/assets/ 的派生瓦片（统一 3:4 WebP，
 * 生成器 tools/make_gallery.py），图池由 index.json 的 gallery 字段下发。
 *
 * 铺列方式（与 -50% 无缝循环配套，见 css/fullpage.css 的 .hero-gallery 段）：
 *   列 = .hero-gallery-col（overflow:hidden 的窗口）
 *     └─ .hero-gallery-col__inner  ← 动画在这里，位移 -50%
 *          ├─ .hero-gallery-col__group（perCol 张瓦片）
 *          └─ 同一分组的克隆        ← 两份等长，-50% 正好等于一个分组的高度
 *
 * 几个必须由这里算、CSS 算不了的量：
 *   · 画布尺寸——取景框是视口大小，画布要旋转后仍盖满它（条件是把视口反向旋转取外接
 *     矩形，见 layoutBox）。宽高按不同口径取：宽管"瓦片多大"的观感，高只管盖住视口。
 *     倾斜角只在 js/config.js 定义一次，CSS 读这里写下去的 --hero-gallery-tilt。
 *   · 每列放几张（perCol）——分组总高必须**高于画布高**，否则列底会露空。
 *     画布高、瓦片高都随视口走，比例随窗口长宽比变化，所以按实测尺寸算，不写死。
 *   · 每列时长——按「分组高 / 目标速度」推，快慢差异来自各列分组高不同 + 一点确定性抖动。
 *     用速度（px/秒）而不是固定秒数，是为了让长短屏上的流动快慢观感一致。
 *   · 窗口尺寸变化——重定画布，且每列张数不够时重建（只重定画布不重建，是为了不让
 *     滚动位置跳回起点）。
 *
 * 纪律（见 docs/QUICKSTART.md「首屏（hero）纪律」）：
 *   · 首屏默认什么都不加，画廊是**用户点名要的**那一个例外；
 *   · 新元素必须进入场动画体系——外层挂 .animate-on-scroll，由 main.js 统一渐显；
 *   · 纯装饰：pointer-events:none 不吃交互，aria-hidden 不进无障碍树，alt 全空。
 */

(function () {
    'use strict';

    /* 瓦片画布 3:4（宽:高），与 tools/make_gallery.py 的 TILE_W/TILE_H 一致。
       前端只用这个比例推算「一列要几张才够铺满」，不关心瓦片实际像素。 */
    var TILE_RATIO = 4 / 3;

    /* 画布尺寸的保险系数：旋转后的盖满条件是取外接矩形，这里再放宽 4% 防亚像素误差 */
    var COVER = 1.04;

    /* 可调参数默认值；实际取 SITE_CONFIG.gallery（js/config.js） */
    var DEFAULTS = {
        cols: 12,
        gap: 14,
        tiltDeg: -12,
        speed: 52,
        minDuration: 14,
        maxDuration: 150
    };

    var pool = [];
    var resizeTimer = null;

    function config() {
        var g = (window.SITE_CONFIG && window.SITE_CONFIG.gallery) || {};
        var out = {};
        Object.keys(DEFAULTS).forEach(function (key) {
            out[key] = typeof g[key] === 'number' && g[key] > 0 ? g[key] : DEFAULTS[key];
        });
        return out;
    }

    /** 确定性伪随机 0..1：同一列每次刷新拿到同一个值（观感稳定，也便于截图比对） */
    function hash01(n) {
        var x = Math.sin(n * 12.9898) * 43758.5453;
        return x - Math.floor(x);
    }

    /**
     * 按来源角色轮转重排图池。
     *
     * 素材多的角色（三月七有 10 张，多数角色只有 1~2 张）如果按原始顺序连排，
     * 画廊会变成"某个角色的专场"。轮转后相邻瓦片必来自不同角色，一屏之内的
     * 角色分布均匀；角色内部的顺序（01 → 02 → …）保持不变。
     */
    function interleave(items) {
        var bySlug = {};
        var order = [];
        items.forEach(function (item) {
            var key = item.slug || '';
            if (!bySlug[key]) {
                bySlug[key] = [];
                order.push(key);
            }
            bySlug[key].push(item);
        });

        var out = [];
        for (var round = 0; out.length < items.length; round++) {
            for (var i = 0; i < order.length; i++) {
                var bucket = bySlug[order[i]];
                if (round < bucket.length) out.push(bucket[round]);
            }
        }
        return out;
    }

    function makeTile(item) {
        var img = document.createElement('img');
        img.className = 'hero-gallery-tile';
        img.src = item.url;
        img.alt = '';
        img.decoding = 'async';
        img.draggable = false;
        /* 与角色卡缩略图同一策略：懒加载。首屏是装饰层，不该抢开屏的关键路径；
           loading=lazy 的图也不计入 window 的 load 事件，不会拖慢开屏等待。 */
        img.loading = 'lazy';
        return img;
    }

    /**
     * 定画布尺寸（.hero-gallery-tilt 的宽高）并写回倾斜角。
     *
     * 取景框是视口大小，画布要旋转 tiltDeg 后仍把它盖满。把视口反向旋转、取外接矩形，
     * 就得到两个方向的最小尺寸 needW / needH——这是充要条件，不用凭经验放大。
     *   · 宽度取 max(2×视口宽, needW)：2 倍视口宽是**观感基准**（列宽 = 画布宽/列数，
     *     直接决定瓦片多大），只有极端长宽比时才会被 needW 顶上去。
     *   · 高度只取 needH：这里多出来的每一寸都会换成更多瓦片——多铺的看不见，
     *     只花带宽。早期两轴都用「200% 与 145vmax 取大」的粗口径，在超长视口
     *     （手机 PC 视图）上多铺了近一半的瓦片。
     */
    function layoutBox(host, c) {
        var frame = host.parentNode;                       // .hero-gallery：视口大小的取景框
        var w = frame.offsetWidth;
        var h = frame.offsetHeight;
        if (!w || !h) return null;

        var rad = Math.abs(c.tiltDeg) * Math.PI / 180;
        var needW = w * Math.cos(rad) + h * Math.sin(rad);
        var needH = w * Math.sin(rad) + h * Math.cos(rad);

        var boxW = Math.max(w * 2, needW * COVER);
        var boxH = needH * COVER;

        host.style.width = Math.round(boxW) + 'px';
        host.style.height = Math.round(boxH) + 'px';
        host.style.setProperty('--hero-gallery-tilt', c.tiltDeg + 'deg');
        return { w: boxW, h: boxH };
    }

    /**
     * 由画布尺寸推算列宽、瓦片高与每列张数。
     *
     * 列宽必须**扣掉列间间距**：画布是带 gap 的 flex 行，(画布宽 - (列数-1)×gap)
     * 才是分给列的总宽。漏掉这一项会高估列宽 → 高估瓦片高 → 每列张数算少，
     * 列底露一条空档（间隙越大、列数越多越容易踩到）。
     */
    function metrics(box, c) {
        var colW = Math.max(1, (box.w - c.gap * (c.cols - 1)) / c.cols);
        var tileH = colW * TILE_RATIO + c.gap;
        // +1：多铺一张，吸收取整与亚像素误差，保证分组总高严格大于画布高
        var perCol = Math.max(3, Math.ceil(box.h / tileH) + 1);
        return { colW: colW, tileH: tileH, perCol: perCol };
    }

    /** 列的循环时长：分组高 / 目标速度（秒），并夹在配置的上下限内 */
    function durationOf(index, m, c) {
        var speed = c.speed * (0.8 + 0.4 * hash01(index));   // px/秒，各列 ±20% 差异
        var seconds = (m.perCol * m.tileH) / speed;
        return Math.min(c.maxDuration, Math.max(c.minDuration, seconds));
    }

    function build(host, c) {
        var box = layoutBox(host, c);
        if (!box) return;
        var m = metrics(box, c);

        host.style.setProperty('--hero-gallery-gap', c.gap + 'px');
        host.innerHTML = '';

        for (var col = 0; col < c.cols; col++) {
            var colEl = document.createElement('div');
            colEl.className = 'hero-gallery-col' + (col % 2 ? ' hero-gallery-col--down' : '');
            colEl.style.setProperty('--duration', durationOf(col, m, c).toFixed(1) + 's');

            var inner = document.createElement('div');
            inner.className = 'hero-gallery-col__inner';

            var group = document.createElement('div');
            group.className = 'hero-gallery-col__group';
            for (var i = 0; i < m.perCol; i++) {
                // 每列取连续的一段图池：相邻列不重样，一屏之内尽量都是不同角色
                group.appendChild(makeTile(pool[(col * m.perCol + i) % pool.length]));
            }

            inner.appendChild(group);
            inner.appendChild(group.cloneNode(true));   // 复制一份，-50% 无缝
            colEl.appendChild(inner);
            host.appendChild(colEl);
        }

        host.dataset.perCol = String(m.perCol);
        host.dataset.built = '1';
    }

    /** 窗口尺寸变了：先按新尺寸重定画布；每列张数不够时才重建（重建会让滚动位置跳回起点） */
    function refresh() {
        var host = document.getElementById('heroGallery');
        if (!host || !pool.length) return;
        var c = config();
        // 上次没搭起来（画布量到 0 尺寸）时补搭一次，别把失败状态留着
        if (host.dataset.built !== '1') {
            build(host, c);
            return;
        }
        var box = layoutBox(host, c);
        if (!box) return;
        if (String(metrics(box, c).perCol) === host.dataset.perCol) return;
        build(host, c);
    }

    function bindResize() {
        if (bindResize.bound) return;
        bindResize.bound = true;
        window.addEventListener('resize', function () {
            if (resizeTimer) clearTimeout(resizeTimer);
            resizeTimer = setTimeout(refresh, 240);
        });
    }

    /**
     * 初始化：把 index.json 下发的图池铺成列。
     * 无图池（数据缺失 / 还没生成 gallery/）时整层留空——它只是背景，缺了不影响首屏可用性。
     */
    function init() {
        var host = document.getElementById('heroGallery');
        if (!host) return;

        pool = interleave((window.SITE_DATA && window.SITE_DATA.gallery) || []);
        if (!pool.length) return;

        // 先挂 resize 再搭：万一这次量到的画布是 0 尺寸（没搭起来），下次窗口变化还能补上
        bindResize();
        build(host, config());
    }

    window.HeroGallery = { init: init };
})();
