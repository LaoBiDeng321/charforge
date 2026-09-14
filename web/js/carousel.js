/**
 * CharCarousel - 角色卡环形轮播
 * 数据来源：window.SITE_DATA.chars（由 build_data.py 生成）
 * 行为：
 *   1. 环形距离分类：0 → is-active / ±1 → is-near / ±2 → is-far / 其余 → is-hidden
 *   2. 自动播放（AUTO 可开关），交互后重置计时
 *   3. 手动切换：箭头 / 刻度跳转 / 邻卡点击
 *   4. 语言切换时仅更新文案节点，不打断当前索引
 */

(function () {
    'use strict';

    var AUTOPLAY_DELAY = 5000;   // 自动轮播间隔
    var COMPACT_DOTS = 12;       // 超过此数量刻度转为密排样式
    var locale = function () { return (window.I18N && window.I18N.getLang()) || 'zh-CN'; };

    var stage = null;
    var cards = [];              // { root, slug, refs }
    var dots = [];
    var indexItems = [];         // 索引面板条目 { root, char }
    var indexOpen = false;
    var current = 0;
    var total = 0;
    var timer = null;
    var playing = true;          // AUTO 开关状态
    var started = false;         // loader 完成后才启动计时

    /* ---------- 渲染 ---------- */

    function t(key) { return window.I18N ? window.I18N.t(key) : key; }

    function formatSize(content) {
        var kb = content.length / 1024;
        return (kb >= 100 ? Math.round(kb) : kb.toFixed(1)) + ' KB';
    }

    function buildCard(char, index) {
        var lang = locale();
        var card = document.createElement('article');
        card.className = 'char-card';
        card.dataset.slug = char.slug;

        var filesHtml = char.files.map(function (file) {
            return (
                '<li class="char-file">' +
                    '<button type="button" class="file-dl" data-file-dl="' + char.slug + '/' + file.name + '" aria-label="' + file.name + '" title="' + t('dl.file') + '">' +
                        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3v12"/><path d="m6 11 6 6 6-6"/><path d="M5 21h14"/></svg>' +
                    '</button>' +
                    '<span class="file-name">' + file.name + '</span>' +
                    '<span class="file-size">' + formatSize(file.content) + '</span>' +
                '</li>'
            );
        }).join('');

        card.innerHTML =
            '<div class="char-card-head">' +
                '<span class="char-no">C.' + String(index + 1).padStart(2, '0') + '</span>' +
                '<span class="char-origin"></span>' +
            '</div>' +
            '<h3 class="char-name"></h3>' +
            '<span class="char-alias"></span>' +
            '<div class="char-tags"></div>' +
            '<ul class="char-files" data-scrollable>' + filesHtml + '</ul>' +
            '<div class="char-card-foot">' +
                '<span class="char-count">' + char.files.length + ' FILES</span>' +
                '<button type="button" class="btn btn-primary" data-download-zip="' + char.slug + '">' +
                    '<svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3v12"/><path d="m6 11 6 6 6-6"/><path d="M5 21h14"/></svg>' +
                    '<span></span>' +
                '</button>' +
            '</div>';

        return card;
    }

    /** 仅更新随语言变化的文案（origin / tags / 下载按钮文字） */
    function applyLocale() {
        var data = window.SITE_DATA || { chars: [] };
        cards.forEach(function (item, index) {
            var char = data.chars[index];
            if (!char) return;
            var lang = locale();
            var origin = char.origin ? (char.origin[lang] || char.origin['zh-CN'] || char.origin.zh) : '';
            var tagList = (char.tags && (char.tags[lang] || char.tags['zh-CN'] || char.tags.zh)) || [];
            item.refs.origin.textContent = origin || '';
            item.refs.alias.textContent = char.alias || '';
            item.refs.name.textContent = char.name || '';
            item.refs.tags.innerHTML = tagList
                .map(function (tag) { return '<span class="char-tag"></span>'; })
                .join('');
            var tagEls = item.refs.tags.querySelectorAll('.char-tag');
            tagList.forEach(function (tag, i) {
                tagEls[i].textContent = tag;
            });
            item.refs.dlText.textContent = t('dl.zip');
        });
        renderIndexTexts();
    }

    function render() {
        var data = window.SITE_DATA || { chars: [] };
        if (!stage || data.chars.length === 0) return;

        stage.innerHTML = '';
        cards = data.chars.map(function (char, index) {
            var card = buildCard(char, index);
            stage.appendChild(card);
            return {
                root: card,
                slug: char.slug,
                refs: {
                    origin: card.querySelector('.char-origin'),
                    name: card.querySelector('.char-name'),
                    alias: card.querySelector('.char-alias'),
                    tags: card.querySelector('.char-tags'),
                    dlText: card.querySelector('[data-download-zip] span')
                }
            };
        });
        total = cards.length;

        /* 刻度指示器 */
        var dotsBox = document.getElementById('charDots');
        dotsBox.innerHTML = '';
        dots = data.chars.map(function (char, index) {
            var dot = document.createElement('button');
            dot.type = 'button';
            dot.className = 'char-dot';
            dot.setAttribute('aria-label', char.name);
            dot.addEventListener('click', function () { goTo(index); });
            dotsBox.appendChild(dot);
            return dot;
        });

        document.getElementById('charTotal').textContent = String(total).padStart(2, '0');

        /* 角色多时刻度密排，避免占满控制行 */
        var dotsBox = document.getElementById('charDots');
        dotsBox.classList.toggle('is-dense', total > COMPACT_DOTS);

        buildIndexGrid(data);

        applyLocale();
        classify(true);
    }

    /* ---------- 角色索引面板（数量增长时的检索入口） ---------- */

    /** 取多语言对象的所有取值（兼容 legacy zh/en 键），用于跨语言检索 */
    function localeVals(val) {
        if (!val) return [];
        if (typeof val === 'string') return [val];
        return Object.keys(val).map(function (k) { return String(val[k]); });
    }

    function buildIndexGrid(data) {
        var grid = document.getElementById('charIndexGrid');
        if (!grid) return;
        grid.innerHTML = '';
        indexItems = data.chars.map(function (char, index) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'char-index-item';
            btn.addEventListener('click', function () {
                goTo(index);
                closeIndex();
            });
            grid.appendChild(btn);
            return { root: btn, char: char, index: index };
        });
        renderIndexTexts();
    }

    /** 按当前语言重建条目文案（打开/切换语言时调用） */
    function renderIndexTexts() {
        var search = document.getElementById('charIndexSearch');
        if (search) search.placeholder = t('chars.indexSearch');
        var empty = document.getElementById('charIndexEmpty');
        if (empty) empty.textContent = t('chars.indexEmpty');
        indexItems.forEach(function (item) {
            var char = item.char;
            var origin = char.origin ? (char.origin[locale()] || char.origin['zh-CN'] || char.origin.zh || '') : '';
            item.root.innerHTML =
                '<span class="char-index-no">' + String(item.index + 1).padStart(2, '0') + '</span>' +
                '<span class="char-index-origin">' + origin + '</span>' +
                '<span class="char-index-name">' + char.name + '</span>' +
                '<span class="char-index-count">' + char.files.length + 'F</span>';
        });
        updateIndexActive();
    }

    /** 检索过滤：名称 / 来源 / 标签 / slug，跨语言匹配 */
    function filterIndex(query) {
        var q = (query || '').trim().toLowerCase();
        var visible = 0;
        indexItems.forEach(function (item) {
            var char = item.char;
            var hay = [char.slug, char.name]
                .concat(localeVals(char.origin), localeVals(char.tags))
                .join(' ').toLowerCase();
            var match = !q || hay.indexOf(q) !== -1;
            item.root.hidden = !match;
            if (match) visible++;
        });
        var empty = document.getElementById('charIndexEmpty');
        if (empty) empty.hidden = visible > 0;
    }

    function updateIndexActive() {
        indexItems.forEach(function (item) {
            item.root.classList.toggle('is-active', item.index === current);
        });
    }

    function openIndex() {
        var panel = document.getElementById('charIndex');
        if (!panel) return;
        indexOpen = true;
        panel.hidden = false;
        document.getElementById('charIndexBtn').setAttribute('aria-expanded', 'true');
        stopTimer();
        renderIndexTexts();
        var search = document.getElementById('charIndexSearch');
        if (search) {
            search.value = '';
            filterIndex('');
            search.focus();
        }
    }

    function closeIndex() {
        if (!indexOpen) return;
        indexOpen = false;
        var panel = document.getElementById('charIndex');
        if (panel) panel.hidden = true;
        document.getElementById('charIndexBtn').setAttribute('aria-expanded', 'false');
        if (playing) startTimer();
    }

    /* ---------- 环形位置分类 ---------- */

    /** 环形距离：current=2, total=5 时，i=4 → -1（在左侧） */
    function ringOffset(index) {
        var d = (index - current) % total;
        if (d > total / 2) d -= total;
        if (d < -total / 2) d += total;
        return d;
    }

    function classify(instant) {
        cards.forEach(function (item, index) {
            var card = item.root;
            var d = ringOffset(index);
            var abs = Math.abs(d);

            card.classList.remove('is-active', 'is-near', 'is-far', 'is-hidden');
            if (d === 0) {
                card.classList.add('is-active');
            } else if (abs === 1) {
                card.classList.add('is-near');
                card.style.setProperty('--dir', d > 0 ? '1' : '-1');
            } else if (abs === 2) {
                card.classList.add('is-far');
                card.style.setProperty('--dir', d > 0 ? '1' : '-1');
            } else {
                card.classList.add('is-hidden');
            }

            /* 邻卡可点击跳转（仅当前卡交互） */
            card.style.cursor = d === 0 ? '' : 'pointer';
        });

        /* 计数与刻度 */
        document.getElementById('charCurrent').textContent = String(current + 1).padStart(2, '0');
        dots.forEach(function (dot, index) {
            dot.classList.toggle('active', index === current);
        });
        updateIndexActive();
    }

    /* ---------- 切换 ---------- */

    function goTo(index) {
        current = ((index % total) + total) % total;
        classify();
        restartTimer();
    }

    function next() { goTo(current + 1); }
    function prev() { goTo(current - 1); }

    /* ---------- 自动播放 ---------- */

    function startTimer() {
        if (!playing || !started || document.hidden) return;
        stopTimer();
        timer = setInterval(next, AUTOPLAY_DELAY);
    }

    function stopTimer() {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
    }

    function restartTimer() {
        stopTimer();
        startTimer();
    }

    function setPlaying(on) {
        playing = on;
        var btn = document.getElementById('charAutoplay');
        if (btn) {
            btn.classList.toggle('is-on', on);
            btn.setAttribute('aria-checked', on ? 'true' : 'false');
        }
        if (on) startTimer();
        else stopTimer();
    }

    /* ---------- 事件绑定 ---------- */

    function bindEvents() {
        document.getElementById('charNext').addEventListener('click', next);
        document.getElementById('charPrev').addEventListener('click', prev);

        var autoBtn = document.getElementById('charAutoplay');
        if (autoBtn) {
            autoBtn.addEventListener('click', function () { setPlaying(!playing); });
        }

        /* 索引面板：开关 / 关闭 / 检索 / Esc */
        document.getElementById('charIndexBtn').addEventListener('click', function () {
            if (indexOpen) closeIndex();
            else openIndex();
        });
        document.getElementById('charIndexClose').addEventListener('click', closeIndex);
        document.getElementById('charIndexSearch').addEventListener('input', function (e) {
            filterIndex(e.target.value);
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && indexOpen) closeIndex();
        });

        /* 邻卡点击跳转 + 邻卡模糊视觉下禁用其内部交互 */
        stage.addEventListener('click', function (e) {
            var cardEl = e.target.closest('.char-card');
            if (!cardEl) return;
            var index = cards.findIndex(function (item) { return item.root === cardEl; });
            if (index === -1) return;
            if (index !== current) {
                e.preventDefault();
                goTo(index);
            }
        });

        /* 邻卡与隐藏卡不响应内部下载等交互（由 main.js 全局委托处理下载） */

        /* 悬停暂停（桌面） */
        stage.addEventListener('mouseenter', stopTimer);
        stage.addEventListener('mouseleave', startTimer);

        /* 页面隐藏 / section 切换时暂停 */
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) stopTimer();
            else startTimer();
        });

        document.getElementById('fullpage').addEventListener('fp:sectionChange', function (e) {
            var charsIndex = document.getElementById('chars') ? indexOfSection('chars') : 3;
            if (e.detail.currentIndex === charsIndex) startTimer();
            else stopTimer();
        });

        /* 语言切换：仅刷新文案 */
        document.addEventListener('i18n:applied', applyLocale);
    }

    function indexOfSection(anchor) {
        var sections = document.querySelectorAll('.fp-section');
        for (var i = 0; i < sections.length; i++) {
            if (sections[i].dataset.anchor === anchor) return i;
        }
        return -1;
    }

    /* ---------- 启动 ---------- */

    function init() {
        stage = document.getElementById('charStage');
        if (!stage) return;

        render();
        bindEvents();

        /* loader 完成后才开始自动计时，避免遮罩期间空转 */
        document.addEventListener('loader:done', function () {
            started = true;
            startTimer();
        }, { once: true });

        /* 数据缺失兜底：无 loader（调试）时直接启动 */
        if (!document.getElementById('loader')) {
            started = true;
            startTimer();
        }
    }

    window.CharCarousel = { init: init };
})();
