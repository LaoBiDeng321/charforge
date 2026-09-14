/**
 * Loader - 启动加载动画控制器
 * 时序：
 *   Phase 1  最左侧竖向加载条自上而下 0 → 100（进度模拟 + 等待资源就绪）
 *   Phase 2  满值停顿后，遮罩自最左侧滑向最右侧（黄色前缘扫场）
 *   Phase 3  停顿片刻，派发 loader:done，主体元素渐显
 */

(function () {
    'use strict';

    var PREFERS_REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* 时序参数（毫秒） */
    var TIMING = {
        fill: 1900,        // 加载条 0 → 99 的模拟时长
        snap: 220,         // 99 → 100 的收尾时长
        holdAtFull: 320,   // 满值后停顿
        wipe: 780,         // 遮罩左 → 右滑场时长（与 CSS 过渡一致）
        pauseAfterWipe: 460 // 滑场后的停顿，随后渐显主体
    };

    /** 就绪等待：模拟进度跑完且 window 资源加载完成后才允许满值 */
    var windowLoaded = document.readyState === 'complete';
    window.addEventListener('load', function () { windowLoaded = true; });

    /**
     * 缓动：easeInOutSine，前段缓入后段缓出
     * @param {number} t 归一化进度 0-1
     */
    function easeInOutSine(t) {
        return 0.5 - Math.cos(Math.PI * t) / 2;
    }

    /** 三位数补零显示，如 007 */
    function pad3(n) {
        return String(Math.round(n)).padStart(3, '0');
    }

    function initLoader() {
        var loader = document.getElementById('loader');
        if (!loader) {
            finish(null);
            return;
        }

        var fill = loader.querySelector('.loader-bar-fill');
        var trackFill = loader.querySelector('.loader-track-fill');
        var count = document.getElementById('loaderCount');
        var finished = false;

        document.body.classList.add('is-loading');

        /* 兜底：后台标签页等场景 requestAnimationFrame 可能被节流停摆，
           超时后强制完成开屏，保证任何环境下都能进入主页面 */
        var failSafe = setTimeout(function () {
            if (!finished) finish(loader);
        }, 5000);

        /** 包一层：记录完成态并清除兜底 */
        var finishOnce = function (el) {
            if (finished) return;
            finished = true;
            clearTimeout(failSafe);
            finish(el);
        };

        /* 页面处于后台时直接快速完成，不做扫场 */
        if (document.hidden) {
            if (fill) fill.style.transform = 'scaleY(1)';
            if (trackFill) trackFill.style.transform = 'scaleX(1)';
            if (count) count.textContent = '100';
            finishOnce(loader);
            return;
        }

        /* 减少动态效果：跳过模拟与扫场，直接快速淡出 */
        if (PREFERS_REDUCED_MOTION) {
            if (fill) fill.style.transform = 'scaleY(1)';
            if (trackFill) trackFill.style.transform = 'scaleX(1)';
            if (count) count.textContent = '100';
            loader.classList.add('is-leaving');
            setTimeout(function () { finishOnce(loader); }, 150);
            return;
        }

        var start = null;

        function frame(now) {
            if (start === null) start = now;
            var elapsed = now - start;
            var t = Math.min(elapsed / TIMING.fill, 1);

            /* 模拟进度上限 99，等待真实资源就绪后才放行到 100 */
            var cap = windowLoaded ? 99.5 : 99;
            var progress = Math.min(easeInOutSine(t) * 100, cap);

            render(progress);

            if (t < 1 || !windowLoaded) {
                requestAnimationFrame(frame);
            } else {
                /* 收尾：99 → 100 */
                var snapStart = null;
                requestAnimationFrame(function snapFrame(now2) {
                    if (snapStart === null) snapStart = now2;
                    var t2 = Math.min((now2 - snapStart) / TIMING.snap, 1);
                    render(99 + easeInOutSine(t2));
                    if (t2 < 1) {
                        requestAnimationFrame(snapFrame);
                    } else {
                        onFull();
                    }
                });
            }
        }

        /** 渲染进度到加载条与百分比读数 */
        function render(progress) {
            if (fill) fill.style.transform = 'scaleY(' + (progress / 100) + ')';
            if (trackFill) trackFill.style.transform = 'scaleX(' + (progress / 100) + ')';
            if (count) count.textContent = pad3(progress);
        }

        /** 满值停顿后触发扫场 */
        function onFull() {
            render(100);
            if (count) count.textContent = '100';
            setTimeout(startWipe, TIMING.holdAtFull);
        }

        /** 遮罩自最左侧滑向最右侧 */
        function startWipe() {
            loader.classList.add('is-wiping');
            setTimeout(function () {
                /* 滑场到位后的停顿，随后渐显主体 */
                setTimeout(function () { finishOnce(loader); }, TIMING.pauseAfterWipe);
            }, TIMING.wipe);
        }

        requestAnimationFrame(frame);
    }

    /** 结束加载：解锁交互，派发完成事件，移除节点 */
    function finish(loader) {
        document.body.classList.remove('is-loading');
        document.body.classList.add('is-booted');

        if (loader) {
            loader.classList.add('is-leaving');
            setTimeout(function () {
                loader.remove();
            }, 340);
        }

        /* 通知 main.js 开始主体渐显动画 */
        document.dispatchEvent(new CustomEvent('loader:done'));
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLoader);
    } else {
        initLoader();
    }
})();
