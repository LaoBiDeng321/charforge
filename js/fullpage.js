/**
 * FullPage Scroll Module
 * 全屏滚动核心模块
 */

class FullPage {
    constructor(options = {}) {
        this.container = document.getElementById(options.containerId || 'fullpage');
        this.sections = this.container ? this.container.querySelectorAll('.fp-section') : [];
        this.navLinks = document.querySelectorAll('.fp-nav-link');
        
        this.currentIndex = 0;
        this.isScrolling = false;
        this.pendingIndex = null;
        this.touchStartY = 0;
        this.touchEndY = 0;
        
        this.options = {
            scrollSpeed: options.scrollSpeed || 800,
            scrollDelay: options.scrollDelay || 1000,
            easing: options.easing || 'cubic-bezier(0.645, 0.045, 0.355, 1)',
            loop: options.loop !== undefined ? options.loop : false,
            keyboard: options.keyboard !== undefined ? options.keyboard : true,
            touch: options.touch !== undefined ? options.touch : true,
            mousewheel: options.mousewheel !== undefined ? options.mousewheel : true,
            ...options
        };
        
        this.init();
    }
    
    init() {
        if (!this.container || this.sections.length === 0) return;
        
        this.setupStyles();
        this.bindEvents();
        
        // 有 #anchor 时从对应分区启动，否则从第一屏开始
        const initialAnchor = (location.hash || '').replace(/^#/, '');
        let initialIndex = 0;
        this.sections.forEach((section, i) => {
            if (section.dataset.anchor === initialAnchor) initialIndex = i;
        });
        this.goToSection(initialIndex, false);

        // 避免浏览器在初始化时把页面滚到锚点位置
        window.scrollTo(0, 0);
        
        // 触发初始化完成事件
        this.emit('init');
    }
    
    setupStyles() {
        // 设置body样式
        document.body.style.overflow = 'hidden';
        document.body.style.height = '100vh';
        
        // 设置容器样式
        this.container.style.position = 'relative';
        this.container.style.width = '100%';
        this.container.style.height = '100%';
        this.container.style.transition = `transform ${this.options.scrollSpeed}ms ${this.options.easing}`;
        
        // 设置每个section的样式
        this.sections.forEach((section) => {
            section.style.position = 'relative';
            section.style.width = '100%';
            section.style.height = '100vh';
            section.style.flexShrink = '0';
        });
    }
    
    bindEvents() {
        // 整屏切换锁：加载动画期间，以及角色索引面板打开时。
        // 索引面板是覆盖在轮播区上的检索浮层，面板内的滑动/按键不该触发翻页。
        const navLocked = () => document.body.classList.contains('is-loading') ||
                                document.body.classList.contains('is-index-open');

        // 内部滚动区判定：事件目标位于 [data-scrollable] 内且该方向仍可滚动时，
        // 放行给内部滚动（如轮播卡的文件列表），不触发整屏切换
        const isInnerScroll = (target, deltaY) => {
            const el = target && target.closest ? target.closest('[data-scrollable]') : null;
            if (!el) return false;
            const canDown = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
            const canUp = el.scrollTop > 1;
            return deltaY > 0 ? canDown : canUp;
        };

        // 鼠标滚轮事件 - 使用window监听
        if (this.options.mousewheel) {
            let wheelTimeout;
            let wheelAccumulator = 0;
            const wheelThreshold = 50;

            window.addEventListener('wheel', (e) => {
                // 内部滚动区优先放行：索引面板打开时，条目网格仍要能用滚轮滚动
                if (isInnerScroll(e.target, e.deltaY)) {
                    return;
                }
                if (navLocked()) {
                    e.preventDefault();
                    return;
                }
                if (this.isScrolling) {
                    e.preventDefault();
                    return;
                }
                
                wheelAccumulator += e.deltaY;
                
                clearTimeout(wheelTimeout);
                wheelTimeout = setTimeout(() => {
                    wheelAccumulator = 0;
                }, 150);
                
                if (Math.abs(wheelAccumulator) > wheelThreshold) {
                    e.preventDefault();
                    
                    if (wheelAccumulator > 0) {
                        this.next();
                    } else {
                        this.prev();
                    }
                    
                    wheelAccumulator = 0;
                }
            }, { passive: false });
        }
        
        // 键盘事件
        if (this.options.keyboard) {
            window.addEventListener('keydown', (e) => {
                // 表单控件内打字不翻页（否则搜索框里按 ↑/↓ 会把整屏翻走）
                const el = e.target;
                if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName || ''))) return;
                if (navLocked() || this.isScrolling) return;
                
                switch(e.key) {
                    case 'ArrowDown':
                    case 'PageDown':
                        e.preventDefault();
                        this.next();
                        break;
                    case 'ArrowUp':
                    case 'PageUp':
                        e.preventDefault();
                        this.prev();
                        break;
                    case 'Home':
                        e.preventDefault();
                        this.goToSection(0);
                        break;
                    case 'End':
                        e.preventDefault();
                        this.goToSection(this.sections.length - 1);
                        break;
                }
            });
        }
        
        // 触摸事件（起点位于内部滚动区内时跳过整屏滑动）
        let touchTarget = null;
        if (this.options.touch) {
            window.addEventListener('touchstart', (e) => {
                this.touchStartY = e.touches[0].clientY;
                touchTarget = e.target;
            }, { passive: true });
            
            window.addEventListener('touchend', (e) => {
                if (navLocked() || this.isScrolling) return;
                if (touchTarget && touchTarget.closest && touchTarget.closest('[data-scrollable]')) {
                    touchTarget = null;
                    return;
                }
                touchTarget = null;
                this.touchEndY = e.changedTouches[0].clientY;
                this.handleSwipe();
            }, { passive: true });
        }
        
        // 导航链接点击
        this.navLinks.forEach((link) => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const index = parseInt(link.dataset.section);
                this.goToSection(index);
            });
        });
        
        // 窗口大小改变
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.goToSection(this.currentIndex, false);
            }, 250);
        });
    }
    
    handleSwipe() {
        const diff = this.touchStartY - this.touchEndY;
        const threshold = 50;
        
        if (Math.abs(diff) > threshold) {
            if (diff > 0) {
                this.next();
            } else {
                this.prev();
            }
        }
    }
    
    next() {
        if (this.currentIndex < this.sections.length - 1) {
            this.goToSection(this.currentIndex + 1);
        } else if (this.options.loop) {
            this.goToSection(0);
        }
    }
    
    prev() {
        if (this.currentIndex > 0) {
            this.goToSection(this.currentIndex - 1);
        } else if (this.options.loop) {
            this.goToSection(this.sections.length - 1);
        }
    }
    
    goToSection(index, animate = true) {
        if (index < 0 || index >= this.sections.length) return;

        // 动画进行中再次点击：记录最后一次目标，当前动画结束后再补跳，
        // 避免点击被直接吞掉、或默认锚点跳转把页面卡在半路。
        if (this.isScrolling) {
            this.pendingIndex = index;
            return;
        }

        if (index === this.currentIndex && animate) return;
        this.pendingIndex = null;
        
        this.isScrolling = true;
        const previousIndex = this.currentIndex;
        this.currentIndex = index;
        
        // 计算偏移量
        const offset = index * 100;
        
        // 应用变换
        if (animate) {
            this.container.style.transition = `transform ${this.options.scrollSpeed}ms ${this.options.easing}`;
        } else {
            this.container.style.transition = 'none';
        }
        this.container.style.transform = `translateY(-${offset}vh)`;
        
        // 更新导航
        this.updateNavigation();
        
        // 触发动画
        setTimeout(() => {
            this.animateSection(index);
        }, animate ? 100 : 0);
        
        // 触发事件
        this.emit('sectionChange', {
            currentIndex: index,
            previousIndex: previousIndex,
            currentSection: this.sections[index],
            previousSection: this.sections[previousIndex]
        });
        
        // 重置滚动状态；若动画期间又点了别的区块，补执行最后那个目标
        setTimeout(() => {
            this.isScrolling = false;
            if (this.pendingIndex !== null) {
                const next = this.pendingIndex;
                this.pendingIndex = null;
                if (next !== this.currentIndex) this.goToSection(next);
            }
        }, this.options.scrollDelay);
        
        // 更新URL锚点
        const anchor = this.sections[index].dataset.anchor;
        if (anchor) {
            history.replaceState(null, null, `#${anchor}`);
        }
    }
    
    updateNavigation() {
        this.navLinks.forEach((link, index) => {
            link.classList.toggle('active', index === this.currentIndex);
        });
    }
    
    animateSection(index) {
        // 加载动画期间不提前触发入场动画（由 loader:done 统一驱动）
        if (document.body.classList.contains('is-loading')) return;

        const section = this.sections[index];
        const animatedElements = section.querySelectorAll('.animate-on-scroll');
        
        // 先移除所有动画类
        animatedElements.forEach(el => {
            el.classList.remove('is-visible');
        });
        
        // 重新添加动画类
        animatedElements.forEach((el, i) => {
            setTimeout(() => {
                el.classList.add('is-visible');
            }, i * 100 + 50);
        });
    }
    
    emit(eventName, data = {}) {
        const event = new CustomEvent(`fp:${eventName}`, {
            detail: data,
            bubbles: true
        });
        this.container.dispatchEvent(event);
    }
    
    // 公共API
    getCurrentIndex() {
        return this.currentIndex;
    }
    
    getCurrentSection() {
        return this.sections[this.currentIndex];
    }
    
    getTotalSections() {
        return this.sections.length;
    }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FullPage;
}
