/**
 * I18N - 文案与代码分离
 * 所有界面文案集中于此配置，HTML 通过 data-i18n 键引用；
 * 动态渲染组件（文件清单 / Q&A / 统计）在 main.js 中经 window.I18N.t() 取词。
 * 支持 zh-CN / en-US，语言偏好持久化于 localStorage。
 */

(function () {
    'use strict';

    var DICT = {
        'zh-CN': {
            'meta.title': 'CHAR//FORGE - 角色扮演 Skill 资源站',

            'topbar.brandSub': '角色工坊',
            'nav.home': '首页',
            'nav.skills': '构建器',
            'nav.chars': '角色库',
            'nav.qa': '问答',
            'nav.footer': '声明',

            'loader.word': 'Loading…',
            'loader.status': '正在装配资源索引',

            'hero.kicker': 'CHARACTER SKILL REPOSITORY // 基于搜索 · agent 必须包含搜索功能',
            'hero.subtitle': '角色工坊 · 扮演 Skill 资源站',
            'hero.description': '两个角色设定构建器 × 七张成品角色卡。全部以 Markdown 设定文件交付，即下即用，可自由修改与分享。',
            'hero.stats.skills': '构建器',
            'hero.stats.chars': '角色卡',
            'hero.stats.files': '设定文件',
            'hero.cta.chars': '浏览角色库',
            'hero.cta.skills': '查看构建器',
            'hero.scroll': '向下滚动',
            'hero.readout1': 'INDEX // 技能与角色全部就绪',
            'hero.readout2': 'LICENSE // 自由分享 · 禁止商用',
            'hero.vertical': 'CHAR//FORGE // CHARACTER WORKSHOP',

            'dl.zip': '打包下载 ZIP',
            'dl.skillmd': '仅下载 SKILL.md',
            'dl.file': '下载此文件',

            'install.copy': '复制至agent安装',
            'install.copied': '已复制',
            'install.copyFailed': '复制失败',

            'skill.flow': '运行流程 // PIPELINE',
            'skill.files': '交付文件 // DELIVERABLES',
            'skill.fileNote': '行尾图标可下载单文件 · 分阶段闸门推进',

            'skills.title': '角色构建器',

            'skillOfficial.title': '官方角色构建器',
            'skillOfficial.desc': '为已有作品中的官方角色构建扮演设定：按「搜索 → 整理查证 → 产出」三阶段执行，强制引用官方来源、孤证不立，素材落盘缓存可跨会话续作，最终交付 10 个各司其职的设定文件。',
            'skillOfficial.flow1': '阶段一 · 检索采集',
            'skillOfficial.flow1Note': '八个维度分批搜索素材并落盘缓存，只留回执不占上下文',
            'skillOfficial.flow2': '阶段二 · 整理查证',
            'skillOfficial.flow2Note': '矛盾逐条裁定，孤证降级、单源不采信，核定设定落盘',
            'skillOfficial.flow3': '阶段三 · 分批产出',
            'skillOfficial.flow3Note': '按分工写满 10 个设定文件，每条素材可溯源至缓存',

            'skillOc.title': '原创角色构建器',
            'skillOc.desc': '为你的原创角色（OC）共创扮演设定：创作主导权始终在用户，未经确认的提议不得写入核定设定，修改设定后全文件同步防漂移，同样交付 10 个设定文件。',
            'skillOc.flow1': '阶段一 · 引导采集',
            'skillOc.flow1Note': '先问后写：空白点要么提问、要么留白，严禁擅自补写',
            'skillOc.flow2': '阶段二 · 确认固化',
            'skillOc.flow2Note': '用户确认是唯一合法性来源，被否决的提议永久留痕',
            'skillOc.flow3': '阶段三 · 分批产出',
            'skillOc.flow3Note': '单一归属展开 10 个文件，每批落盘前执行漂移自查',

            'file.role.skill': '运行规则',
            'file.role.prompt': '我是谁',
            'file.role.profile': '客观硬事实',
            'file.role.world': '世界层背景',
            'file.role.memory': '经历与认知',
            'file.role.personality': '性格锚点',
            'file.role.behavior': '行为逻辑',
            'file.role.relations': '人际关系',
            'file.role.interaction': '语料例句',
            'file.role.conflicts': '纠偏手册',
            'file.role.templates': '模板附件',

            'chars.title': '角色库',
            'chars.index': '全部角色',
            'chars.indexTitle': '角色索引 // CHARACTER INDEX',
            'chars.indexSearch': '搜索 角色名 / 作品 / 公司 / 拼音 / 英文…',
            'chars.facetCompany': '公司',
            'chars.facetWork': '作品',
            'chars.facetAll': '全部',
            'chars.indexEmpty': '无匹配角色',
            'chars.fuzzyHint': '没有精确匹配，你是不是想找：',

            'qa.title': '常见问答',
            'qa.1.q': '什么是角色 Skill？',
            'qa.1.a': '一套 Markdown 设定文件加运行规则：SKILL.md 定义加载顺序与自纠机制，其余文件分别承载世界观、性格、行为、语料等设定，让 AI 稳定、可复现地扮演角色。',
            'qa.2.q': '下载角色卡后怎么用？',
            'qa.2.a': '解压后把角色文件夹放入支持技能加载的 AI 工具目录，对话时要求加载对应角色即可；上下文紧张时按 SKILL.md 的最小加载方案只载入 3 个核心文件。',
            'qa.3.q': '两个构建器有什么区别？',
            'qa.3.a': '官方构建器面向已有作品的角色，流程是「检索 → 验证 → 裁定」，强调孤证不立；原创构建器面向你自己设计的角色，创作主导权在你，未经确认的提议不会写入设定。',
            'qa.4.q': '如何用构建器生成自己的角色？',
            'qa.4.a': '把对应 SKILL.md 放入技能目录，提供作品名与角色名（原创角色直接给设定），跟随三阶段流程逐步确认；素材会缓存到角色目录之外的本地 _溯源 目录（默认不进仓库、不进站点），可跨会话续作。',
            'qa.5.q': '为什么要分批处理？',
            'qa.5.a': '两个原因：部分 agent 会限制单次最大输出上限，一次性产出全部文件容易被截断；分批落盘也让用户可以在每一批结束后及时审查与调整，再继续下一批。',
            'qa.6.q': '可以使用 web 端的 AI 产品吗？',
            'qa.6.a': '可以，但一般web端产品会限制搜索的次数与长度。总体来说，web 端的搜索能力比不上完整 agent，长流程的检索与落盘建议使用支持技能加载的 agent 工具。',
            'qa.7.q': '同一世界观下的角色，world.md 可以通用吗？',
            'qa.7.a': '答案是否定的。world.md 承载的是「角色眼中的世界观」——经过角色经历与立场过滤的世界切片，而不是客观世界设定。同一世界观下，不同角色的 world.md 各自不同。',
            'qa.8.q': '资源可以二次分发吗？',
            'qa.8.a': '可以。构建器与角色卡均为 Markdown 文本，欢迎自由分享与魔改；转载请保留来源说明，且不得用于商业用途。',
            'qa.9.q': '扮演时设定出现冲突怎么办？',
            'qa.9.a': '每张角色卡附带 conflicts.md 纠偏手册：已裁定的冲突以它为准，未决项不作为确定事实输出；模型跑偏时引用该文件即可回正。',

            'footer.title': '感谢支持',
            'footer.subtitle': '感谢每一位下载、使用与反馈的玩家',
            'footer.desc': '构建器与角色卡会持续更新，欢迎魔改后分享你的版本',
            'declare.usage.title': '资源用途',
            'declare.usage.body': '本站所有资源仅供学习研究与个人娱乐使用，禁止转售或用于任何商业用途。',
            'declare.copyright.title': '版权归属',
            'declare.copyright.body': '角色设定素材与官方立绘的版权归各自原作版权方所有。构建器与文档由 LaoBiDeng321 个人维护，转载请注明来源。',
            'declare.disclaimer.title': '免责声明',
            'declare.disclaimer.body': 'AI 扮演产出内容不代表原作官方口径，使用生成内容产生的一切后果由使用者自行承担。卡片缩略图采集自社区，部分未能追溯到原作者；若您是作者并希望署名或下架，请提 Issue，我们会尽快处理。',
            'footer.brandSub': '角色工坊 · CHARACTER WORKSHOP',
            'footer.res.label': '资源总数',
            'footer.style.label': '视觉语言',
            'footer.style.value': '终末地风格 SKILL',
            'footer.lang.label': '支持语言',
            'footer.view.label': '显示模式',
            'footer.view.pc': 'PC 版',
            'footer.view.auto': '自适应',
            'footer.view.hint': '手机端默认按 PC 布局显示；点此切换自适应布局（当前响应式仍在完善）',
            'footer.dev.label': '维护',
            'footer.version.label': '版本号',
            'footer.copy': '© 2026 CHAR//FORGE.',
            'footer.note': '角色版权归原作权利方所有 | 本站为社区资源索引'
        },

        'en-US': {
            'meta.title': 'CHAR//FORGE - Character Skill Repository',

            'topbar.brandSub': 'Character Workshop',
            'nav.home': 'Home',
            'nav.skills': 'Builders',
            'nav.chars': 'Characters',
            'nav.qa': 'Q&A',
            'nav.footer': 'Legal',

            'loader.word': 'Loading…',
            'loader.status': 'ASSEMBLING RESOURCE INDEX',

            'hero.kicker': 'CHARACTER SKILL REPOSITORY // SEARCH-BASED · AGENTS MUST INCLUDE SEARCH',
            'hero.subtitle': 'CHAR WORKSHOP · ROLEPLAY SKILL HUB',
            'hero.description': 'Two profile builders × seven ready-to-run character cards. Everything ships as Markdown setting files — download, tweak and share freely.',
            'hero.stats.skills': 'SKILL PACKS',
            'hero.stats.chars': 'CHAR CARDS',
            'hero.stats.files': 'SETTING FILES',
            'hero.cta.chars': 'Browse Characters',
            'hero.cta.skills': 'View Builders',
            'hero.scroll': 'Scroll',
            'hero.readout1': 'INDEX // ALL SKILLS & CHARS READY',
            'hero.readout2': 'LICENSE // FREE TO SHARE · NO COMMERCIAL',
            'hero.vertical': 'CHAR//FORGE // CHARACTER WORKSHOP',

            'dl.zip': 'Download ZIP',
            'dl.skillmd': 'SKILL.md only',
            'dl.file': 'Download this file',

            'install.copy': 'Copy to Agent Install',
            'install.copied': 'Copied',
            'install.copyFailed': 'Copy failed',

            'skill.flow': 'PIPELINE',
            'skill.files': 'DELIVERABLES',
            'skill.fileNote': 'Click the icon to grab a single file · stage-gated workflow',

            'skills.title': 'Character Builders',

            'skillOfficial.title': 'Official Character Builder',
            'skillOfficial.desc': 'Builds roleplay profiles for official characters of existing works: a 3-stage pipeline of Search, Verify and Produce. Official sources are enforced, single-source claims rejected, materials cached on disk across sessions, and 10 dedicated setting files are delivered.',
            'skillOfficial.flow1': 'Stage 1 · Search & Collect',
            'skillOfficial.flow1Note': '8 dimensions searched in batches, cached to disk with receipts only',
            'skillOfficial.flow2': 'Stage 2 · Verify & Decide',
            'skillOfficial.flow2Note': 'Contradictions adjudicated; lone sources downgraded, canon finalized',
            'skillOfficial.flow3': 'Stage 3 · Produce in Batches',
            'skillOfficial.flow3Note': 'All 10 files written per ownership rules, every claim traceable',

            'skillOc.title': 'Original Character Builder',
            'skillOc.desc': 'Co-creates roleplay profiles for your original characters: the user always holds creative authority, unconfirmed proposals never enter canon, and any edit syncs across all files to prevent drift. Also delivers 10 setting files.',
            'skillOc.flow1': 'Stage 1 · Guided Collection',
            'skillOc.flow1Note': 'Ask first, write later: blanks are either asked or left empty',
            'skillOc.flow2': 'Stage 2 · Confirm & Freeze',
            'skillOc.flow2Note': 'User confirmation is the only source of legitimacy; vetoes are logged',
            'skillOc.flow3': 'Stage 3 · Produce in Batches',
            'skillOc.flow3Note': 'Single-ownership files with a drift self-check before each batch',

            'file.role.skill': 'Run rules',
            'file.role.prompt': 'Who am I',
            'file.role.profile': 'Hard facts',
            'file.role.world': 'World layer',
            'file.role.memory': 'History & memory',
            'file.role.personality': 'Personality anchors',
            'file.role.behavior': 'Behavior logic',
            'file.role.relations': 'Relations',
            'file.role.interaction': 'Corpus & lines',
            'file.role.conflicts': 'Drift manual',
            'file.role.templates': 'Template pack',

            'chars.title': 'Character Cards',
            'chars.index': 'ALL CHARS',
            'chars.indexTitle': 'CHARACTER INDEX // JUMP TO CARD',
            'chars.indexSearch': 'Search character / work / company / pinyin / EN…',
            'chars.facetCompany': 'Company',
            'chars.facetWork': 'Work',
            'chars.facetAll': 'All',
            'chars.indexEmpty': 'No matching characters',
            'chars.fuzzyHint': 'No exact match — did you mean:',

            'qa.title': 'Q&A',
            'qa.1.q': 'What is a character skill?',
            'qa.1.a': 'A set of Markdown setting files plus run rules: SKILL.md defines load order and self-correction, while the other files carry world, personality, behavior and corpus settings, so an AI can portray the character consistently and reproducibly.',
            'qa.2.q': 'How do I use a downloaded character card?',
            'qa.2.a': 'Unzip the character folder into the skill directory of an AI tool that supports skill loading, then ask it to load that character in chat. When context is tight, load only the 3 core files per the minimal scheme in SKILL.md.',
            'qa.3.q': 'What is the difference between the two builders?',
            'qa.3.a': 'The official builder targets characters of existing works via Search -> Verify -> Decide and enforces the no-single-source rule. The original builder targets characters you design: you hold creative authority and unconfirmed proposals never enter canon.',
            'qa.4.q': 'How do I create my own character with a builder?',
            'qa.4.a': 'Put the SKILL.md into your skills directory, provide the work title and character name (or your OC draft directly), then follow the 3-stage gates. Materials are cached locally in a _溯源 directory outside the character folder (not committed, not published) and can resume across sessions.',
            'qa.5.q': 'Why is the output produced in batches?',
            'qa.5.a': 'Two reasons: some agents cap the maximum output per turn, so writing all files at once risks truncation; batch-based writing also lets you review and adjust after each batch before continuing.',
            'qa.6.q': 'Can I use web-based AI products?',
            'qa.6.a': 'Yes, but web products usually limit the number and length of searches. Overall, their search capability falls short of a full agent — for long retrieval-and-disk workflows, an agent tool with skill loading is recommended.',
            'qa.7.q': 'Is world.md shareable between characters of the same worldview?',
            'qa.7.a': 'No. world.md carries the worldview as seen by the character — a slice of the world filtered through their experience and stance, not an objective world setting. Characters under the same worldview each have their own world.md.',
            'qa.8.q': 'Can I redistribute these resources?',
            'qa.8.a': 'Yes. Builders and character cards are plain Markdown — feel free to share and remix. Keep the source note when reuploading, and never use them commercially.',
            'qa.9.q': 'What if the roleplay drifts from the settings?',
            'qa.9.a': 'Every card ships with conflicts.md: adjudicated conflicts follow it, undecided items are never stated as fact, and citing that file pulls the model back on track.',

            'footer.title': 'Thank You',
            'footer.subtitle': 'Thanks to everyone who downloads, plays and gives feedback',
            'footer.desc': 'Builders and cards keep updating — remix and share your own versions',
            'declare.usage.title': 'Intended Use',
            'declare.usage.body': 'All resources here are for learning, research and personal entertainment only. Reselling or commercial use is prohibited.',
            'declare.copyright.title': 'Copyright',
            'declare.copyright.body': 'Character materials and official key art belong to their respective rights holders. Builders and docs are maintained personally by LaoBiDeng321 — attribute the source when reuploading.',
            'declare.disclaimer.title': 'Disclaimer',
            'declare.disclaimer.body': 'AI roleplay output does not represent any official stance of the original works. Users bear full responsibility for generated content. Card thumbnails were collected from community sources and some could not be traced back to their authors — if you are one of them and want credit or removal, open an issue and we will handle it promptly.',
            'footer.brandSub': 'CHARACTER WORKSHOP',
            'footer.res.label': 'Resources',
            'footer.style.label': 'Visual Language',
            'footer.style.value': 'ENDFIELD STYLE SKILL',
            'footer.lang.label': 'Languages',
            'footer.view.label': 'Display',
            'footer.view.pc': 'PC',
            'footer.view.auto': 'Responsive',
            'footer.view.hint': 'Phones default to the PC layout; click to switch to the responsive layout (still being improved)',
            'footer.dev.label': 'Maintained by',
            'footer.version.label': 'Version',
            'footer.copy': '© 2026 CHAR//FORGE.',
            'footer.note': 'Characters belong to their rights holders | Community resource index'
        }
    };

    var STORAGE_KEY = 'charforge-lang';

    /** 取当前语言（localStorage > 浏览器语言 > 默认中文） */
    function getLang() {
        var saved = null;
        try {
            saved = localStorage.getItem(STORAGE_KEY);
        } catch (e) { /* 隐私模式下忽略 */ }
        if (saved && DICT[saved]) return saved;
        var nav = (navigator.language || 'zh-CN');
        return DICT[nav] ? nav : (nav.toLowerCase().indexOf('zh') === 0 ? 'zh-CN' : 'en-US');
    }

    /** 取词条，缺失时回落中文 */
    function t(lang, key) {
        return (DICT[lang] && DICT[lang][key]) || (DICT['zh-CN'][key] || key);
    }

    /** 将词条应用到所有 [data-i18n] 节点，并更新 <html lang> 与标题 */
    function apply(lang) {
        document.documentElement.lang = lang;
        document.title = t(lang, 'meta.title');

        document.querySelectorAll('[data-i18n]').forEach(function (el) {
            var key = el.getAttribute('data-i18n');
            var text = t(lang, key);
            if (text) el.textContent = text;
        });

        /* 语言按钮激活态 */
        document.querySelectorAll('.lang-btn').forEach(function (btn) {
            btn.classList.toggle('active', btn.dataset.lang === lang);
        });

        try {
            localStorage.setItem(STORAGE_KEY, lang);
        } catch (e) { /* 忽略 */ }

        document.dispatchEvent(new CustomEvent('i18n:applied', { detail: { lang: lang } }));
    }

    /* 暴露给 main.js：初始化与切换 */
    window.I18N = {
        apply: apply,
        getLang: getLang,
        t: function (key) { return t(getLang(), key); }
    };
})();
