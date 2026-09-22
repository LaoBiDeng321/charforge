/**
 * CharCarousel - 角色卡环形轮播 + 角色索引面板
 * 数据来源：window.SITE_DATA.chars（由 build_data.py 生成）
 *
 * 轮播行为：
 *   1. 环形距离分类：0 → is-active / ±1 → is-near / ±2 → is-far / 其余 → is-hidden
 *   2. 自动播放（AUTO 可开关），交互后重置计时
 *   3. 手动切换：箭头 / 刻度跳转 / 邻卡点击
 *   4. 语言切换时仅更新文案节点，不打断当前索引
 *
 * ============================ 索引面板检索算法 ============================
 * 结构：搜索框 → 两级定位索引（公司 → 作品）→ 角色卡网格。
 * 三级定位索引两级各带实时计数与「全部」回退；二级栏仅在该公司定义了 work
 * 时出现（单层公司不出现）。选中公司时二级自动归位，避免带着上一个公司的作品筛。
 *
 * 三段式检索（每段都保留展示顺序，不做相关性重排）：
 *
 *   ① 精确 / 前缀 / 片段 / 分词 —— hitIn()
 *      覆盖：中文名、英文名、全拼与首字母、作品、公司、来源、标签。
 *      中文按任意长度子串匹配（只打后半段也能命中）。
 *
 *   ②a 去分隔符重试 —— stageCompact()
 *      治分写或带连字符的拼音：`pei li ka` / `pei-li-ka` → `peilika`。
 *
 *   ②b 音节级重排 —— stageSyllables() / syllableReorderHit()
 *      按**本条目的音节表**切分查询：顺序任意、每个音节最多用它在表中出现的次数，
 *      不要求用完表中所有音节（用户常只敲尾部）。治「音节记错顺序」：
 *      `dayufei` → 大肥鱼（字符级距离要 4 步，判为不匹配；音节级只是换了顺序）。
 *      音节表由构建期用 pypinyin 逐字切好下发为 pinyinSyllables（名称/公司/作品
 *      各一份，多音字 reading 覆盖同样生效）——这也是它必须和 pinyin 同源的原因，
 *      否则 `茜特菈莉` 会下发成 `qian-te-la-li`。前端不需要自带音节词典。
 *
 *   ③ 兜底候选 —— dlCandidates() / subseqCandidates()
 *      先 Damerau-Levenshtein（错字/漏字/换位/同音字/繁体），零候选时再用子序列
 *      （跳字缩写、首字母尾片段，**仅限 ≤3 字**）。
 *      **只出「你是不是想找」候选，不进入结果列表**。
 *
 * ①②b 都是精确约束，所以能直接进结果列表；③ 是不可靠的近似匹配，只做候选提示。
 *
 * 三条安全边界：
 *   · DL 按查询长度自适应阈值：≤2 字不放行 / 3–5 字距离 1 / ≥6 字距离 2。
 *   · 子序列只对 ≤3 字开放 —— 查询越长，「碰巧是某串子序列」的概率越大，
 *     长词走这条路等于随机捞结果。
 *   · ③ 只在 ①② 零命中时触发 —— 所以 `zzz` 什么都不命中，`ys` 也不会被 `lys`
 *     这类首字母串吃掉。
 *
 * 检索键分组（searchOf()）：
 *   通用字段（名称/来源/标签/首字母）拉丁子串需 ≥3 位；纯全拼字段放宽到 ≥2 位
 *   （`yu` → 大肥鱼）。分组原因是语义不同：全拼串里的短子串是「一个音节的一部分」，
 *   首字母串里的短子串是「跨两个字声母的偶然相邻」（`ys` ⊂ `lys`），只会制造误匹配。
 *
 * localeVals() 遇到值是数组时（tags 就是这种结构）必须**摊平成独立条目**，不能
 * String() 成 `a,b,c` —— 那会拼出一个大长串，让子串/子序列跨越本不相邻的字段乱命中。
 *
 * 手机端面板全屏化（--panel-zoom）：
 *   PC 视图把整页缩到约 0.3 倍，而「输入框聚焦是否自动放大」判定的是**缩放后的
 *   有效字号**（阈值约 16pt）：14px 的检索框实际只剩 ~5pt，必然被浏览器放大，
 *   再叠加整屏滚动就很容易误操作。只把字号写大挡不住（要 ~60px 才够），观感也崩。
 *   所以只对检索面板还原设备比例：
 *     1. 打开面板时若「触屏 + .view-pc」，把 #charIndex 临时移入 document.body 并加
 *        is-device-scale。必须搬出全屏滚动容器——容器上有 transform，不搬的话
 *        position: fixed 会退化成 absolute。
 *     2. carousel.css 用 zoom: var(--panel-zoom) 配
 *        width/height: calc(100vw|100vh / var(--panel-zoom)) 反向抵消整页缩放：
 *        面板铺满整屏，内部字号与间距回到设备真实尺寸，检索框用正常移动端字号
 *        （17px）即可，不再触发聚焦放大。
 *     3. --panel-zoom = 布局宽 / 设备宽，由 index.html 在 load / resize /
 *        orientationchange 时同步；自适应模式下恒为 1，面板保持原卡片形态。
 *     4. 关闭时还原 DOM 位置与 class；桌面与自适应模式完全不进这套逻辑。
 *   已知取舍：面板内部沿用桌面端间距 token，在 390pt 宽的屏上留白偏大；面板里的
 *   @media (max-width: 768px) 也不会命中（布局视口仍是 1280）。真响应式改造待办。
 * ==========================================================================
 */

(function () {
    'use strict';

    var AUTOPLAY_DELAY = 5000;   // 自动轮播间隔
    var COMPACT_DOTS = 12;       // 超过此数量刻度转为密排样式
    var locale = function () { return (window.I18N && window.I18N.getLang()) || 'zh-CN'; };

    /* ---------- 展示排序：中文按拼音、英文按首字母 ---------- */
    /* 排序在渲染期计算：cards / dots / indexItems 共用同一个有序数组，
       索引面板的 goTo(index) 按下标跳转，三处顺序必须一致，故集中在此。 */
    var collators = {};
    function collatorFor(lang) {
        if (lang in collators) return collators[lang];
        var c = null;
        try {
            /* zh-Hans-u-co-pinyin：显式指定拼音排序，不依赖各引擎对 zh 的默认 collation */
            c = (lang === 'en-US')
                ? new Intl.Collator('en', { sensitivity: 'base', numeric: true })
                : new Intl.Collator('zh-Hans-u-co-pinyin', { sensitivity: 'base' });
        } catch (e) { c = null; }
        collators[lang] = c;
        return c;
    }

    /** 排序键：build_data.py 可为多音字下发 sort 覆盖键（如「茜特菈莉」应读 xī，ICU 默认按 qiàn 排） */
    function sortKeyOf(char, lang) {
        if (char.sort && char.sort[lang]) return char.sort[lang];
        return (lang === 'en-US' ? (char.nameEn || char.alias || char.name) : char.name) || '';
    }

    /** 展示用主名：中文名 / 英文名随语言切换（英文名缺失时回退 alias，再回退中文名） */
    function nameOf(char) {
        if (locale() === 'en-US') return char.nameEn || char.alias || char.name || '';
        return char.name || char.nameEn || '';
    }

    function orderedChars(lang) {
        var list = (((window.SITE_DATA || {}).chars) || []).slice();
        var coll = collatorFor(lang);
        list.sort(function (a, b) {
            var ka = sortKeyOf(a, lang);
            var kb = sortKeyOf(b, lang);
            var r = coll ? coll.compare(ka, kb) : (ka < kb ? -1 : (ka > kb ? 1 : 0));
            /* 同键时用 slug 兜底，保证顺序稳定可复现 */
            return r || (a.slug < b.slug ? -1 : (a.slug > b.slug ? 1 : 0));
        });
        return list;
    }

    var stage = null;
    var chars = [];              // 当前语言下的展示顺序（cards / dots / indexItems 共用）
    var cards = [];              // { root, slug, refs }
    var dots = [];
    var indexItems = [];         // 索引面板条目 { root, char, index, keys, cid, wid }
    var indexOpen = false;
    var indexQuery = '';         // 搜索框当前词
    var activeCompany = null;    // 两级定位索引：选中的公司 id（null = 全部）
    var activeWork = null;       // 两级定位索引：选中的作品 id（null = 该公司全部）
    var facets = { order: [], map: {} };   // 公司 → 作品 两级结构，由 chars 归纳
    var current = 0;
    var total = 0;
    var timer = null;
    var playing = true;          // AUTO 开关状态
    var started = false;         // loader 完成后才启动计时

    /* ---------- 渲染 ---------- */

    function t(key) { return window.I18N ? window.I18N.t(key) : key; }

    /* 文件大小由 index.json 直接提供，不再从内联正文计算 */
    function formatSize(bytes) {
        var n = Number(bytes) || 0;
        if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB';
        return (n / 1024).toFixed(1) + ' KB';
    }

    function buildCard(char, index) {
        var lang = locale();
        var card = document.createElement('article');
        card.className = 'char-card';
        card.dataset.slug = char.slug;

        var filesHtml = char.files.map(function (file) {
            // 只展示文件名，不展示目录前缀；单文件下载入口已移除，只保留整包 ZIP
            var base = file.name.split('/').pop();
            return (
                '<li class="char-file">' +
                    '<span class="file-name">' + base + '</span>' +
                    '<span class="file-size">' + formatSize(file.size) + '</span>' +
                '</li>'
            );
        }).join('');

        var thumbHtml = char.thumbnail
            ? '<div class="char-thumb"><img src="' + char.thumbnail + '" alt="' + nameOf(char) + '" loading="lazy"></div>'
            : '<div class="char-thumb char-thumb-empty" aria-hidden="true"><span>NO IMG</span></div>';

        /* Token 预估来自 index.json，前端只负责展示；title 在 applyLocale 中写入，
           避免把说明文案拼进 HTML 时还要额外做属性转义。 */
        var tokenLabel = (window.TokenEstimate && char.tokenEstimate)
            ? window.TokenEstimate.label(char)
            : '';

        card.innerHTML =
            '<div class="char-card-top">' +
                thumbHtml +
                '<div class="char-card-top-main">' +
                    '<div class="char-card-head">' +
                        '<span class="char-no">C.' + String(index + 1).padStart(2, '0') + '</span>' +
                    '</div>' +
                    '<span class="char-origin"></span>' +
                    '<h3 class="char-name"></h3>' +
                    '<span class="char-alias"></span>' +
                    '<div class="char-tags"></div>' +
                '</div>' +
            '</div>' +
            '<ul class="char-files" data-scrollable>' + filesHtml + '</ul>' +
            '<div class="char-card-foot">' +
                '<span class="char-count">' + char.files.length + ' FILES</span>' +
                (tokenLabel ? '<span class="char-count char-count-token">' + tokenLabel + '</span>' : '') +
                '<button type="button" class="btn btn-secondary" data-copy-prompt="' + char.slug + '">' +
                    '<span></span>' +
                '</button>' +
                '<button type="button" class="btn btn-primary" data-download-zip="' + char.slug + '">' +
                    '<svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3v12"/><path d="m6 11 6 6 6-6"/><path d="M5 21h14"/></svg>' +
                    '<span></span>' +
                '</button>' +
            '</div>';

        return card;
    }

    /** 仅更新随语言变化的文案（origin / tags / 下载按钮文字） */
    function applyLocale() {
        cards.forEach(function (item, index) {
            var char = chars[index];
            if (!char) return;
            var lang = locale();
            var origin = char.origin ? (char.origin[lang] || char.origin['zh-CN'] || char.origin.zh) : '';
            var tagList = (char.tags && (char.tags[lang] || char.tags['zh-CN'] || char.tags.zh)) || [];
            item.refs.origin.textContent = origin || '';
            /* 主名随语言切换；副名位置显示"另一种语言的名字"，避免英文模式下主名仍是中文 */
            item.refs.name.textContent = nameOf(char);
            item.refs.alias.textContent = (locale() === 'en-US' ? char.name : char.alias) || '';
            item.refs.tags.innerHTML = tagList
                .map(function (tag) { return '<span class="char-tag"></span>'; })
                .join('');
            var tagEls = item.refs.tags.querySelectorAll('.char-tag');
            tagList.forEach(function (tag, i) {
                tagEls[i].textContent = tag;
            });
            item.refs.dlText.textContent = t('dl.zip');
            if (item.refs.copyText) item.refs.copyText.textContent = t('install.copy');
            if (item.refs.tokenText && window.TokenEstimate) {
                item.refs.tokenText.textContent = window.TokenEstimate.label(char);
            }
            if (item.refs.thumbImg) item.refs.thumbImg.alt = nameOf(char);
        });
        renderIndexTexts();
    }

    function render() {
        var data = window.SITE_DATA || { chars: [] };
        if (!stage || data.chars.length === 0) return;

        /* 按当前语言排序（中文拼音 / 英文首字母），三处渲染共用 chars */
        chars = orderedChars(locale());

        stage.innerHTML = '';
        cards = chars.map(function (char, index) {
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
                    dlText: card.querySelector('[data-download-zip] span'),
                    copyText: card.querySelector('[data-copy-prompt] span'),
                    tokenText: card.querySelector('.char-count-token'),
                    thumbImg: card.querySelector('.char-thumb img')
                }
            };
        });
        total = cards.length;

        /* 刻度指示器 */
        var dotsBox = document.getElementById('charDots');
        dotsBox.innerHTML = '';
        dots = chars.map(function (char, index) {
            var dot = document.createElement('button');
            dot.type = 'button';
            dot.className = 'char-dot';
            dot.setAttribute('aria-label', nameOf(char));
            dot.addEventListener('click', function () { goTo(index); });
            dotsBox.appendChild(dot);
            return dot;
        });

        document.getElementById('charTotal').textContent = String(total).padStart(2, '0');

        /* 角色多时刻度密排，避免占满控制行 */
        var dotsBox = document.getElementById('charDots');
        dotsBox.classList.toggle('is-dense', total > COMPACT_DOTS);

        buildIndexGrid();

        applyLocale();
        classify(true);
    }

    /* ---------- 角色索引面板（数量增长时的检索入口） ---------- */

    /** 取多语言对象的所有取值（兼容 legacy zh/en 键），用于跨语言检索。
     *  注意：值是数组时（tags 就是这种结构）必须**摊平成独立条目**，
     *  不能 String() 成 "a,b,c" ——那会拼出一个大长串，
     *  让子串/子序列匹配跨越本不相邻的字段乱命中。 */
    function localeVals(val) {
        if (!val) return [];
        if (typeof val === 'string') return [val];
        if (Object.prototype.toString.call(val) === '[object Array]') {
            return val.filter(Boolean).map(String);
        }
        var out = [];
        Object.keys(val).forEach(function (k) {
            var v = val[k];
            if (!v) return;
            if (Object.prototype.toString.call(v) === '[object Array]') {
                out = out.concat(v.filter(Boolean).map(String));
            } else {
                out.push(String(v));
            }
        });
        return out;
    }

    /** 字段归一化：字段内去空格与分隔符（使 "starrail" 能命中 "Honkai: Star Rail"） */
    function normalizeKey(s) {
        return String(s == null ? '' : s).toLowerCase().replace(/[\s:：·・\-_/]+/g, '');
    }

    /** 把一组字段整理成「原始 + 归一化」两份候选串 */
    function expandKeys(fields, into) {
        fields.forEach(function (f) {
            if (!f) return;
            var raw = String(f).toLowerCase();
            if (into.indexOf(raw) === -1) into.push(raw);
            var n = normalizeKey(f);
            if (n && into.indexOf(n) === -1) into.push(n);
        });
        return into;
    }

    /** 检索素材，分两组：
     *  keys —— 通用字段（名称/来源/标签/首字母…）：前缀任意，拉丁子串需 ≥3 位
     *  py   —— 纯全拼字段：拉丁子串放宽到 ≥2 位
     *
     *  为什么要分开：全拼串里的短子串是「一个音节的一部分」（"fy" 命中 dafeiyu），
     *  语义清晰；首字母串里的短子串是「跨两个字声母的偶然相邻」（"ys" 命中 lys），
     *  只会制造误匹配——所以只放宽全拼，不动首字母。
     *  字段逐个归一化而不是拼成一个大串，避免相邻字段拼出假匹配（如 乐元素/lys 拼出 "ys"）。 */
    function searchOf(char) {
        var c = char.company || {};
        var w = char.work || {};
        var keys = expandKeys([char.slug, char.name, char.nameEn || '', char.alias || '',
                               char.pinyinInitials || ''], []);
        expandKeys(localeVals(char.origin), keys);
        expandKeys(localeVals(char.tags), keys);
        expandKeys([c['zh-CN'] || '', c['en-US'] || '', c.pinyinInitials || '',
                    w['zh-CN'] || '', w['en-US'] || '', w.pinyinInitials || ''], keys);

        var py = expandKeys([char.pinyin || ''], []);
        expandKeys([c.pinyin || '', w.pinyin || ''], py);

        /* 音节表：构建期由 pypinyin 逐字切好下发（含多音字 reading 覆盖），
           前端不需要自带音节词典。名称 / 公司 / 作品合并成一个池子，
           保留重复次数——DFS 靠"每个位置只能用一次"来表达次数约束。 */
        var syl = [];
        [char.pinyinSyllables, c.pinyinSyllables, w.pinyinSyllables].forEach(function (arr) {
            if (Object.prototype.toString.call(arr) !== '[object Array]') return;
            arr.forEach(function (s) { if (s) syl.push(String(s).toLowerCase()); });
        });

        return { keys: keys, py: py, syl: syl };
    }

    /** 分面显示名：随语言切换，缺英文时回退中文 */
    function facetLabel(obj) {
        if (!obj) return '';
        var zh = obj['zh-CN'] || obj.zh || '';
        var en = obj['en-US'] || obj.en || '';
        return ((locale() === 'en-US' ? (en || zh) : (zh || en)) || obj.id || '');
    }

    function companyIdOf(char) {
        var c = char.company;
        return c ? (c.id || facetLabel(c)) : '';
    }

    function workIdOf(char) {
        var w = char.work;
        return w ? (w.id || facetLabel(w)) : '';
    }

    /* 单个词的命中规则：
       - 前缀命中：任意长度（"plk" → 首字母、"pei" → peilika）
       - 子串命中：中文任意长度（"肥鱼" 应命中 "吃白饭的大肥鱼"）；
         拉丁字母默认需 ≥3 位（否则 "ys" 会被 "lys" 这类首字母串吃出误匹配），
         但**全拼字段**放宽到 ≥2 位（"fy" 应命中 dafeiyu）。 */
    var CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;

    /** 在一组候选串里找一个词：前缀任意长度；子串按 minSubstring 设门槛（中文恒为 1） */
    function hitIn(keys, tok, minSubstring) {
        if (!keys.length || !tok) return false;
        var min = CJK_RE.test(tok) ? 1 : minSubstring;
        for (var i = 0; i < keys.length; i++) {
            var at = keys[i].indexOf(tok);
            if (at === 0) return true;
            if (at > 0 && tok.length >= min) return true;
        }
        return false;
    }

    function tokenHit(item, tok) {
        return hitIn(item.keys, tok, 3) || hitIn(item.py, tok, 2);
    }

    /** 关键词匹配：按空白切词后 AND */
    function matchesTokens(item, tokens) {
        for (var i = 0; i < tokens.length; i++) {
            if (!tokenHit(item, tokens[i])) return false;
        }
        return true;
    }

    /** 定位范围：一级=公司，二级=公司下的作品。两级都为 null 时不限 */
    function inScope(char) {
        if (activeCompany && companyIdOf(char) !== activeCompany) return false;
        if (activeWork && workIdOf(char) !== activeWork) return false;
        return true;
    }

    /** 从角色列表归纳出「公司 → 作品」两级结构（作品缺省的角色只挂在公司下） */
    function buildFacets() {
        var order = [];
        var map = {};
        chars.forEach(function (char) {
            var cid = companyIdOf(char);
            if (!cid) return;
            if (!map[cid]) {
                map[cid] = { meta: char.company, works: [], workMap: {}, total: 0 };
                order.push(cid);
            }
            map[cid].total++;
            var wid = workIdOf(char);
            if (!wid) return;
            if (!map[cid].workMap[wid]) {
                map[cid].workMap[wid] = { meta: char.work, total: 0 };
                map[cid].works.push(wid);
            }
            map[cid].workMap[wid].total++;
        });
        var coll = collatorFor(locale());
        order.sort(function (a, b) { return compareLabel(coll, facetLabel(map[a].meta), facetLabel(map[b].meta)); });
        facets = { order: order, map: map };
    }

    function compareLabel(coll, a, b) {
        if (coll) return coll.compare(a, b);
        return a < b ? -1 : (a > b ? 1 : 0);
    }

    function makeChip(label, count, opts) {
        opts = opts || {};
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'char-facet-chip'
            + (opts.active ? ' is-active' : '')
            + (count === 0 ? ' is-empty' : '');
        btn.setAttribute('aria-pressed', opts.active ? 'true' : 'false');
        var name = document.createElement('span');
        name.className = 'char-facet-name';
        name.textContent = label;
        var num = document.createElement('span');
        num.className = 'char-facet-count';
        num.textContent = count;
        btn.appendChild(name);
        btn.appendChild(num);
        if (opts.onClick) btn.addEventListener('click', opts.onClick);
        return btn;
    }

    /** 重绘两级分面；计数跟随搜索词实时变化，便于"边搜边定位" */
    /** 分面计数直接读 matchedFlags（由 applyFilter 传入），与列表结果同源 */
    function renderFacets(matchedFlags) {
        var companyBox = document.getElementById('charIndexCompanyChips');
        if (!companyBox) return;
        var coll = collatorFor(locale());
        matchedFlags = matchedFlags || {};

        var matchCount = {};
        var grand = 0;
        indexItems.forEach(function (item) {
            if (!matchedFlags[item.index]) return;
            grand++;
            if (item.cid) matchCount[item.cid] = (matchCount[item.cid] || 0) + 1;
        });

        companyBox.innerHTML = '';
        companyBox.appendChild(makeChip(t('chars.facetAll'), grand, {
            active: !activeCompany,
            onClick: function () { selectCompany(null); }
        }));
        facets.order.forEach(function (cid) {
            companyBox.appendChild(makeChip(facetLabel(facets.map[cid].meta), matchCount[cid] || 0, {
                active: activeCompany === cid,
                onClick: function () { selectCompany(cid); }
            }));
        });

        /* 二级栏：只在当前公司有作品时出现（单层公司的深度即到此为止） */
        var workFacet = document.getElementById('charIndexWorkFacet');
        var workBox = document.getElementById('charIndexWorkChips');
        if (!workFacet || !workBox) return;
        var group = activeCompany ? facets.map[activeCompany] : null;
        if (!group || !group.works.length) {
            workFacet.hidden = true;
            workBox.innerHTML = '';
            return;
        }
        workFacet.hidden = false;
        workBox.innerHTML = '';

        var byWork = {};
        var inCompany = 0;
        indexItems.forEach(function (item) {
            if (item.cid !== activeCompany || !matchedFlags[item.index]) return;
            inCompany++;
            if (item.wid) byWork[item.wid] = (byWork[item.wid] || 0) + 1;
        });

        workBox.appendChild(makeChip(t('chars.facetAll'), inCompany, {
            active: !activeWork,
            onClick: function () { selectWork(null); }
        }));
        group.works.slice()
            .sort(function (a, b) {
                return compareLabel(coll, facetLabel(group.workMap[a].meta), facetLabel(group.workMap[b].meta));
            })
            .forEach(function (wid) {
                workBox.appendChild(makeChip(facetLabel(group.workMap[wid].meta), byWork[wid] || 0, {
                    active: activeWork === wid,
                    onClick: function () { selectWork(wid); }
                }));
            });
    }

    function selectCompany(cid) {
        activeCompany = cid;
        activeWork = null;   /* 换公司时二级归位，避免带着上一个公司的作品筛选 */
        applyFilter();
    }

    function selectWork(wid) {
        activeWork = wid;
        applyFilter();
    }

    function currentTokens() {
        var q = (indexQuery || '').trim().toLowerCase();
        return q ? q.split(/\s+/) : [];
    }

    /* ---------- 模糊兜底（Damerau-Levenshtein） ----------
       分工：精确/前缀/子串/分词负责「列表结果」；只有在前两个阶段全部零命中时，
       DL 才出来给候选，且**只作为提示**、不直接替换结果集——否则 1~2 字查询
       （"阿"、"p"）距离 1 会把半个库捞上来。算法见 js/vendor/damerau-levenshtein.js */

    /** 允许的最大编辑距离：短串不放行，否则噪声失控（长度 2 时错一个字就是错一半） */
    function maxDistanceFor(len) {
        if (len <= 2) return 0;
        if (len <= 5) return 1;
        return 2;
    }

    function dl() {
        return (window.DamerauLevenshtein && window.DamerauLevenshtein.limited) || null;
    }

    /** 子序列跨度：查询的字面按序出现在候选串里时，返回「多余跨度」（0 = 完全连续）。
     *  不是子序列返回 -1。
     *  这条兜底专治两类子串匹配覆盖不了的输入：
     *    · 跳字缩写 —— "吃肥鱼" ⊂ "吃白饭的大肥鱼"、"大白鱼" 同理
     *    · 首字母尾片段 —— "fy" ⊂ "cbfddfy"（而首字母串不能放宽子串门槛，
     *      否则 "ys" 会被 "lys" 吃掉；子序列天然区分得开）
     *  只在精确阶段零命中时参与，所以 "ys" 这类已有正确命中的查询不受影响。 */
    function subseqSpan(key, q) {
        var qi = 0, first = -1, last = -1;
        for (var i = 0; i < key.length && qi < q.length; i++) {
            if (key.charAt(i) === q.charAt(qi)) {
                if (first < 0) first = i;
                last = i;
                qi++;
            }
        }
        if (qi < q.length) return -1;
        return last - first + 1 - q.length;
    }

    function bestSubseq(item, q) {
        var all = item.keys.concat(item.py);
        var best = -1;
        for (var i = 0; i < all.length; i++) {
            var s = subseqSpan(all[i], q);
            if (s >= 0 && (best < 0 || s < best)) best = s;
        }
        return best;
    }

    /** 编辑距离候选 */
    function dlCandidates(q) {
        var limited = dl();
        var max = maxDistanceFor(q.length);
        if (!limited || max <= 0) return [];
        var scored = [];
        indexItems.forEach(function (item) {
            var best = Infinity;
            var all = item.keys.concat(item.py);
            for (var i = 0; i < all.length; i++) {
                var d = limited(max, q, all[i]);
                if (d < best) best = d;
                if (best === 0) break;
            }
            if (best <= max) scored.push({ item: item, d: best, span: 0 });
        });
        return scored;
    }

    /** 子序列候选：按「跨度紧 → 展示顺序」排，只取最紧的若干条。
     *
     *  **只对短查询开放（≤3 字）**：子序列是很弱的约束——查询越长，
     *  「碰巧是某个串的子序列」的概率越大，长词走这条路基本等于随机捞结果。
     *  实际需要它的场景全是短的：跳字缩写（吃肥鱼 / 佩卡）、首字母尾片段（fy / lk）。
     *  超过 3 字直接不参与，噪声立刻收住。 */
    function subseqCandidates(q) {
        if (q.length < 2 || q.length > 3) return [];
        var scored = [];
        indexItems.forEach(function (item) {
            var span = bestSubseq(item, q);
            if (span >= 0) scored.push({ item: item, d: 99, span: span });
        });
        scored.sort(function (a, b) {
            return a.span - b.span || a.item.index - b.item.index;
        });
        return scored;
    }

    /** 模糊兜底候选：先编辑距离（精度高），零候选时再用子序列（召回广） */
    function fuzzyCandidates(query, limit) {
        var q = query.toLowerCase();
        var out = dlCandidates(q);
        if (!out.length) out = subseqCandidates(q);
        return out.slice(0, limit || 3);
    }

    /** 渲染「你是不是想找」候选；点一下把名字填进搜索框 */
    function renderFuzzy(cands) {
        var box = document.getElementById('charIndexFuzzy');
        var chips = document.getElementById('charIndexFuzzyChips');
        if (!box || !chips) return;
        if (!cands || !cands.length) {
            box.hidden = true;
            chips.innerHTML = '';
            return;
        }
        chips.innerHTML = '';
        cands.forEach(function (c) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'char-fuzzy-chip';
            btn.textContent = nameOf(c.item.char);
            btn.addEventListener('click', function () {
                var search = document.getElementById('charIndexSearch');
                if (search) search.value = nameOf(c.item.char);
                filterIndex(nameOf(c.item.char));
                if (search) search.focus();
            });
            chips.appendChild(btn);
        });
        box.hidden = false;
    }

    /** 第一阶段：分词 AND 命中（含前缀/子串/跨语言） */
    function stageTokens(tokens) {
        return indexItems.filter(function (item) { return matchesTokens(item, tokens); });
    }

    /** 第二阶段：把整句压成一个整体再试（"pei li ka"→"peilika"、"pei-li-ka"→"peilika"）。
     *  只在第一阶段零命中时启用，因此不会影响 "ys" 这类已有的正确命中。 */
    function stageCompact(raw) {
        var compact = normalizeKey(raw);
        if (!compact) return null;
        var tokens = raw.split(/\s+/);
        /* 查询里本来就带分隔符，或本身就是多词，压缩才有意义 */
        if (tokens.length < 2 && compact === raw) return null;
        return indexItems.filter(function (item) { return tokenHit(item, compact); });
    }

    /** 第二阶段之一：音节级重排匹配。
     *
     *  把查询按「本条目的音节表」切分——顺序任意、每个音节最多用它在表中出现的次数，
     *  不要求用完表里所有音节（用户常常只敲名字的尾部）。
     *
     *  为什么不用字符串距离：字符级的距离对音节换位完全无感——
     *  "dayufei" 与 "dafeiyu" 在字符级要 4 步，在音节级只是 da / fei / yu 换了个顺序。
     *  音节级是精确约束（必须整段切完、且音节都来自本条目），所以能直接进结果列表，
     *  不会像模糊匹配那样误伤。
     *
     *  要求至少切出 2 个音节：单个音节（"da"、"yu"）会命中一大片。
     */
    function syllableReorderHit(q, syllables) {
        if (!syllables.length) return false;
        var used = [];
        for (var i = 0; i < syllables.length; i++) used.push(false);

        function walk(pos, count) {
            if (pos === q.length) return count >= 2;
            for (var i = 0; i < syllables.length; i++) {
                if (used[i]) continue;
                var s = syllables[i];
                if (!s || q.indexOf(s, pos) !== pos) continue;
                used[i] = true;
                if (walk(pos + s.length, count + 1)) { used[i] = false; return true; }
                used[i] = false;
            }
            return false;
        }
        return walk(0, 0);
    }

    function stageSyllables(raw) {
        var q = normalizeKey(raw);          /* 顺带吃掉 "da yu fei" / "da-yu-fei" 里的分隔符 */
        if (!q || !/^[a-z]+$/.test(q)) return null;
        var hits = indexItems.filter(function (item) { return syllableReorderHit(q, item.syl); });
        return hits.length ? hits : null;
    }

    /** 统一过滤入口：搜索词 AND 公司 AND 作品 */
    function applyFilter() {
        var raw = (indexQuery || '').trim().toLowerCase();
        var tokens = currentTokens();

        var matched = stageTokens(tokens);
        if (!matched.length) {
            var compact = stageCompact(raw);
            if (compact && compact.length) matched = compact;
        }
        if (!matched.length) {
            var syl = stageSyllables(raw);
            if (syl && syl.length) matched = syl;
        }

        /* 列表结果：只由确定性阶段决定（前缀 / 片段 / 压缩重试 / 音节重排） */
        var matchedFlags = {};
        matched.forEach(function (item) { matchedFlags[item.index] = true; });

        var visible = 0;
        indexItems.forEach(function (item) {
            var show = !!matchedFlags[item.index] && inScope(item.char);
            item.root.hidden = !show;
            if (show) visible++;
        });

        /* 只在「搜索词本身零命中」时给模糊候选；若只是被公司/作品范围筛掉，
           提示没有意义（点了也还是被范围挡住），此时只显示空态。 */
        if (!matched.length && raw) renderFuzzy(fuzzyCandidates(raw));
        else renderFuzzy(null);

        renderFacets(matchedFlags);
        var empty = document.getElementById('charIndexEmpty');
        if (empty) empty.hidden = visible > 0;
        /* 空态时收掉网格，否则 flex:1 会把「无匹配 / 你是不是想找」压到面板最底部 */
        var panel = document.getElementById('charIndex');
        if (panel) panel.classList.toggle('is-empty', visible === 0);
    }

    function filterIndex(query) {
        indexQuery = query || '';
        applyFilter();
    }

    function buildIndexGrid() {
        var grid = document.getElementById('charIndexGrid');
        if (!grid) return;
        grid.innerHTML = '';
        indexItems = chars.map(function (char, index) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'char-index-item';
            btn.addEventListener('click', function () {
                goTo(index);
                closeIndex();
            });
            grid.appendChild(btn);
            var s = searchOf(char);
            return {
                root: btn, char: char, index: index,
                keys: s.keys, py: s.py, syl: s.syl,
                cid: companyIdOf(char), wid: workIdOf(char)
            };
        });
        buildFacets();
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
            var tokenText = (window.TokenEstimate && char.tokenEstimate)
                ? ' · ~' + window.TokenEstimate.compact(char.tokenEstimate.total)
                : '';
            item.root.innerHTML =
                '<span class="char-index-no">' + String(item.index + 1).padStart(2, '0') + '</span>' +
                '<span class="char-index-origin">' + origin + '</span>' +
                '<span class="char-index-name">' + nameOf(char) + '</span>' +
                '<span class="char-index-count">' + char.files.length + 'F' + tokenText + '</span>';
        });
        updateIndexActive();
        applyFilter();
    }

    function updateIndexActive() {
        indexItems.forEach(function (item) {
            item.root.classList.toggle('is-active', item.index === current);
        });
    }

    /** 触屏判定：PC 视图模式下面板会整块搬到 body 下做全屏化，桌面保持原有行为。 */
    function isCoarsePointer() {
        try {
            return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
        } catch (e) {
            return false;
        }
    }

    /* PC 视图 + 触屏：检索面板全屏化（样式见 css/carousel.css 的 .is-device-scale）。
       PC 视图把整页缩到约 0.3 倍，聚焦却又按缩放后的有效字号判定，
       把输入框字号补到 60px 才挡得住放大——很难看。改成把面板临时挂到 body 下铺满整屏，
       由 CSS 用 zoom 反向抵消整页缩放：面板内部回到设备真实尺寸，
       字号不用放大也不会触发聚焦放大。自适应模式整页没被缩小，保持原卡片面板即可。 */
    var panelHomeParent = null;
    var panelHomeNext = null;

    function needsPanelOverlay() {
        return isCoarsePointer() && document.documentElement.classList.contains('view-pc');
    }

    function enterPanelOverlay(panel) {
        if (!panel || !needsPanelOverlay() || panel.classList.contains('is-device-scale')) return;
        panelHomeParent = panel.parentNode;
        panelHomeNext = panel.nextSibling;
        document.body.appendChild(panel);
        panel.classList.add('is-device-scale');
    }

    function exitPanelOverlay(panel) {
        if (!panel || !panel.classList.contains('is-device-scale')) return;
        panel.classList.remove('is-device-scale');
        if (panelHomeParent) {
            panelHomeParent.insertBefore(panel, panelHomeNext);
            panelHomeParent = null;
            panelHomeNext = null;
        }
    }

    /** 搜索框聚焦后把它摆进可视视口：
     *  键盘会把 visualViewport 压小，默认的自动滚动有时让输入框贴着键盘下沿或停在屏幕外；
     *  这里只在真的被遮住时补一次 scrollIntoView，避免每次聚焦都抖一下。 */
    function keepSearchInView(input) {
        if (!isCoarsePointer()) return;

        var reposition = function () {
            if (document.activeElement !== input) return;
            var vv = window.visualViewport;
            var rect = input.getBoundingClientRect();
            var top = vv ? vv.offsetTop : 0;
            var height = vv ? vv.height : window.innerHeight;
            var pad = 16;
            if (rect.top >= top + pad && rect.bottom <= top + height - pad) return;
            try {
                input.scrollIntoView({ block: 'center', behavior: 'smooth' });
            } catch (e) {
                input.scrollIntoView();
            }
        };

        /* 键盘动画约 300ms，等它稳定后再判断；visualViewport 可用时以它为准再补一次 */
        setTimeout(reposition, 320);
        if (window.visualViewport) {
            var vv = window.visualViewport;
            var onResize = function () {
                vv.removeEventListener('resize', onResize);
                setTimeout(reposition, 60);
            };
            vv.addEventListener('resize', onResize);
        }
    }

    function openIndex() {
        var panel = document.getElementById('charIndex');
        if (!panel) return;
        indexOpen = true;
        panel.hidden = false;
        /* PC 视图 + 触屏：整块面板全屏化（搬到 body 下 + zoom 抵消整页缩放） */
        enterPanelOverlay(panel);
        /* 锁定整屏切换：面板内滑动/按键不应翻页（fullpage.js 监听这个 class） */
        document.body.classList.add('is-index-open');
        document.getElementById('charIndexBtn').setAttribute('aria-expanded', 'true');
        stopTimer();
        /* 每次打开回到干净状态：清搜索词、清两级定位 */
        activeCompany = null;
        activeWork = null;
        indexQuery = '';
        renderIndexTexts();
        var search = document.getElementById('charIndexSearch');
        if (search) {
            search.value = '';
            applyFilter();
            search.focus();
        }
    }

    function closeIndex() {
        if (!indexOpen) return;
        indexOpen = false;
        var panel = document.getElementById('charIndex');
        /* 先归位再隐藏，避免在 body 下留着全屏面板闪一帧 */
        exitPanelOverlay(panel);
        if (panel) panel.hidden = true;
        document.body.classList.remove('is-index-open');
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

    /** 当前是否停留在角色库分区。
     *
     * 鼠标移出舞台、页面重新可见、关闭索引面板等事件都会调用 startTimer()；
     * 如果这里只检查 playing/started，切到问答页后鼠标离开舞台或页面重新可见时
     * 会把轮播定时器重新启动——角色卡已经滚出视口，setInterval 却仍在跑，
     * 每 5 秒更新一次卡片状态并触发 560ms 过渡，造成无谓的渲染开销。
     */
    function isCarouselActive() {
        var charsIndex = indexOfSection('chars');
        if (charsIndex < 0) return false;
        if (window.fullpage && typeof window.fullpage.getCurrentIndex === 'function') {
            return window.fullpage.getCurrentIndex() === charsIndex;
        }
        var section = document.getElementById('chars');
        return !!(section && section.classList.contains('is-active'));
    }

    function startTimer() {
        if (!playing || !started || document.hidden) return;
        if (indexOpen || !isCarouselActive()) return;
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
        var searchInput = document.getElementById('charIndexSearch');
        searchInput.addEventListener('input', function (e) {
            filterIndex(e.target.value);
        });
        /* 触屏聚焦后保证输入框在可视视口里（键盘弹出场景） */
        searchInput.addEventListener('focus', function () { keepSearchInView(searchInput); });
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

        /* 语言切换：排序键随语言变化（中文拼音 / 英文首字母），需重建以更新顺序；
           用 slug 记住当前卡，重建后回到同一张，避免切换语言时"跳卡" */
        document.addEventListener('i18n:applied', function () {
            var prevSlug = cards[current] ? cards[current].slug : null;
            render();
            if (prevSlug) {
                chars.forEach(function (char, i) { if (char.slug === prevSlug) current = i; });
            }
            classify(true);
        });
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
