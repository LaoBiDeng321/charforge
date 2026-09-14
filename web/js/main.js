/**
 * CHAR//FORGE - Main JavaScript
 * 主应用逻辑：i18n、全屏滚动、数据渲染（统计/文件清单/Q&A）、下载绑定、入场动画
 */

document.addEventListener('DOMContentLoaded', () => {
    // 初始化文案（先于一切 UI 渲染）
    initI18n();

    // 数据驱动渲染：统计 / 文件清单 / Q&A
    renderDynamic();

    // 初始化角色轮播
    if (window.CharCarousel) window.CharCarousel.init();

    // 初始化全屏滚动
    initFullPage();

    // 绑定下载与跳转按钮
    bindActions();

    // 加载动画完成后，触发首屏渐显
    initRevealAfterLoader();

    // 语言切换后重渲染动态组件
    document.addEventListener('i18n:applied', renderDynamic);
});

/**
 * 初始化多语言：应用当前语言，绑定语言切换按钮
 */
function initI18n() {
    if (window.I18N) {
        window.I18N.apply(window.I18N.getLang());
    }

    document.querySelectorAll('.lang-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            if (window.I18N) {
                window.I18N.apply(btn.dataset.lang);
            }
        });
    });
}

/**
 * 数据驱动渲染：Hero 统计 / Skill 文件清单 / Q&A 列表
 * （角色卡由 carousel.js 渲染，语言切换时自行刷新）
 */
function renderDynamic() {
    const data = window.SITE_DATA;

    // 页脚社交链接（仅依赖 SITE_CONFIG，语言无关）
    renderSocials();

    // Q&A 仅依赖 i18n 词条，数据缺失时也必须渲染
    renderQA();

    if (!data) return;
    renderStats(data);
    renderFileTables(data);
}

/**
 * 页脚社交图标行（来源：js/config.js → SITE_CONFIG.socials / icons）
 */
function renderSocials() {
    const box = document.getElementById('footerSocials');
    if (!box) return;
    const cfg = window.SITE_CONFIG || { socials: [], icons: {} };
    box.innerHTML = '';
    cfg.socials.forEach(function (item) {
        const a = document.createElement('a');
        a.className = 'social-link';
        a.href = item.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.title = item.label;
        a.setAttribute('aria-label', item.label);
        a.innerHTML = cfg.icons[item.id] || '';
        box.appendChild(a);
    });
}

/**
 * Hero 统计数字 + Footer 资源总数（等宽两位补零）
 */
function renderStats(data) {
    const skillCount = data.skills.length;
    const charCount = data.chars.length;
    const fileCount =
        data.skills.reduce((sum, s) => sum + s.files.length, 0) +
        data.chars.reduce((sum, c) => sum + c.files.length, 0);

    const pad2 = (n) => String(n).padStart(2, '0');
    const set = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    set('statSkills', pad2(skillCount));
    set('statChars', pad2(charCount));
    set('statFiles', String(fileCount));
    set('footerRes', `${skillCount} SKILLS / ${charCount} CHARS`);
}

/**
 * Skill 区文件清单：文件名 + 职责 + 行内下载
 */
function renderFileTables(data) {
    // 文件名 → i18n 职责键
    const roleKey = (name) => {
        const base = name.split('/').pop().replace('.md', '');
        if (base === 'SKILL') return 'file.role.skill';
        if (name.startsWith('reference/')) return 'file.role.templates';
        return 'file.role.' + base.toLowerCase();
    };

    document.querySelectorAll('[data-file-table]').forEach((list) => {
        const slug = list.dataset.fileTable;
        const entry = data.skills.find((s) => s.slug === slug);
        if (!entry) return;

        list.innerHTML = entry.files.map((file) => {
            // 显示层只用文件名：下载保存的也是单个文件，不展示目录前缀
            const base = file.name.split('/').pop();
            return (
                '<li class="file-row">' +
                    '<span class="file-name">' + base + '</span>' +
                    '<span class="file-role">' + window.I18N.t(roleKey(file.name)) + '</span>' +
                    '<button type="button" class="file-dl" data-file-dl="' + slug + '/' + file.name + '" title="' + window.I18N.t('dl.file') + '" aria-label="' + base + '">' +
                        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3v12"/><path d="m6 11 6 6 6-6"/><path d="M5 21h14"/></svg>' +
                    '</button>' +
                '</li>'
            );
        }).join('');
    });
}

/**
 * Q&A 列表：details 折叠项（默认第一项展开）
 */
function renderQA() {
    const list = document.getElementById('qaList');
    if (!list) return;

    let html = '';
    for (let i = 1; i <= 9; i++) {
        const q = window.I18N.t('qa.' + i + '.q');
        const a = window.I18N.t('qa.' + i + '.a');
        if (q === 'qa.' + i + '.q') break; // 词条缺失即停止
        const no = String(i).padStart(2, '0');
        html +=
            '<details class="qa-item animate-on-scroll"' + (i === 1 ? ' open' : '') + '>' +
                '<summary>' +
                    '<span class="qa-q">Q.' + no + '</span>' +
                    '<span class="qa-question">' + q + '</span>' +
                    '<span class="qa-marker" aria-hidden="true">+</span>' +
                '</summary>' +
                '<p class="qa-answer">' + a + '</p>' +
            '</details>';
    }
    list.innerHTML = html;
}

/**
 * 初始化全屏滚动
 */
function initFullPage() {
    const fp = new FullPage({
        containerId: 'fullpage',
        scrollSpeed: 800,
        scrollDelay: 1000,
        easing: 'cubic-bezier(0.645, 0.045, 0.355, 1)',
        loop: false,
        keyboard: true,
        touch: true,
        mousewheel: true
    });

    // 监听 section 变化事件：激活态 + 入场动画
    document.getElementById('fullpage').addEventListener('fp:sectionChange', (e) => {
        const { currentIndex, currentSection } = e.detail;

        document.querySelectorAll('.fp-section').forEach((section, index) => {
            section.classList.toggle('is-active', index === currentIndex);
        });

        // 同步顶栏导航激活态
        document.querySelectorAll('.tb-link').forEach((link, index) => {
            link.classList.toggle('active', index === currentIndex);
        });

        animateSectionElements(currentSection);
    });

    window.fullpage = fp;
}

/**
 * 绑定下载按钮与 data-goto 跳转按钮（含动态渲染生成的节点）
 */
function bindActions() {
    document.addEventListener('click', (e) => {
        // 整包 ZIP
        const zipBtn = e.target.closest('[data-download-zip]');
        if (zipBtn && window.Downloader) {
            window.Downloader.downloadZip(zipBtn.dataset.downloadZip);
            return;
        }

        // 单文件
        const fileBtn = e.target.closest('[data-file-dl]');
        if (fileBtn && window.Downloader) {
            // 非当前轮播卡内的文件按钮不响应（邻卡仅为视觉预览）
            const card = fileBtn.closest('.char-card');
            if (card && !card.classList.contains('is-active')) return;
            const ref = fileBtn.dataset.fileDl;
            const sep = ref.indexOf('/');
            window.Downloader.downloadFile(ref.slice(0, sep), ref.slice(sep + 1));
            return;
        }

        // 区块跳转（Hero CTA 等）
        const gotoBtn = e.target.closest('[data-goto]');
        if (gotoBtn && window.fullpage) {
            window.fullpage.goToSection(parseInt(gotoBtn.dataset.goto, 10));
        }
    });
}

/**
 * 加载动画完成后触发首屏入场
 * 时序由 loader.js 派发的 loader:done 事件驱动
 */
function initRevealAfterLoader() {
    const firstSection = document.querySelector('.fp-section');

    const reveal = () => {
        if (firstSection) {
            animateSectionElements(firstSection);
        }
        // 顶栏随入场淡入
        document.querySelector('.topbar')?.classList.add('is-visible');
    };

    // 若加载动画缺失（如调试禁用），直接入场
    if (!document.getElementById('loader')) {
        reveal();
        return;
    }

    document.addEventListener('loader:done', reveal, { once: true });
}

/**
 * Section 元素动画：逐个渐显
 */
function animateSectionElements(section) {
    if (!section) return;
    const elements = section.querySelectorAll('.animate-on-scroll');

    elements.forEach((el) => {
        el.classList.remove('is-visible');
    });

    elements.forEach((el, index) => {
        setTimeout(() => {
            el.classList.add('is-visible');
        }, index * 110 + 120);
    });
}
