---
name: "endfield-style"
description: "Transforms any web project into Arknights: Endfield (明日方舟：终末地) industrial-editorial style with 6 levels: loading-screen scope (full/boot-only/no-boot) x color scope (Endfield palette/keep original). Invoke when user asks for 终末地风格/Endfield style redesign, opening loading animation, or industrial style conversion."
---

# Endfield Style - 终末地风格改造技能

将任意 Web 项目改造为《明日方舟：终末地》官网风格。核心设计语言：**工业编辑风**——纸与墨是主体，强调色是信号；全直角；数字等宽。

参考品牌资料：`https://endfield.hypergryph.com/#home`、`https://github.com/ymh0000123/dsh-theme-endfield`（docs/design-language.md）

## 第一步：确定等级（2×3=6）

向用户确认或根据需求推断两个维度：

| 等级 | 开屏范围 | 颜色维度 |
|---|---|---|
| L1 | 含开屏（整站+加载动画） | 终末地配色 |
| L2 | 含开屏 | 保留原配色 |
| L3 | 不含开屏（仅整站） | 终末地配色 |
| L4 | 不含开屏 | 保留原配色 |
| L5 | 仅开屏（只做加载动画） | 终末地配色 |
| L6 | 仅开屏 | 保留原配色 |

- **含开屏 / 仅开屏**：实现"开屏三阶段"动画（见第三节）
- **不含开屏**：跳过加载层，页面直接呈现，入场动画首屏立即触发
- **终末地配色**：替换为第二节色板
- **保留原配色**：不改动任何颜色令牌，仅应用形态语言（直角/角标/等宽/动效/HUD），原主色继续充当"信号色"角色

**禁止在源文件上修改**：一律先复制项目到新工作区（如 `<name>-endfield`，排除 `.git`）再动手。

## 第二步：设计令牌

### 颜色（仅 L1/L3/L5；L2/L4/L6 保留原色）

```css
:root {
    --color-bg-primary: #101110;
    --color-bg-secondary: #181a18;
    --color-bg-tertiary: #1e201d;
    --color-text-primary: #f5f5f0;
    --color-text-secondary: #898d89;
    --color-text-muted: #5a5d59;
    --color-accent: #fff500;
    --color-accent-deep: #e8e000;
    --color-accent-subtle: rgba(255, 245, 0, 0.08);
    --color-border: #343633;
    --color-border-strong: #4a4d49;
    --color-signal-pink: #DF52AC;   
    --color-signal-blue: #5A7EFD;   
    --color-signal-red: #FA294B;    
    --color-signal-green: #7ADDB5;  
    --color-signal-orange: #FF8C42;   
    --color-signal-cyan: #00E5FF;     
    --color-signal-purple: #B287F8;   
    --color-signal-steel: #8E959E;    
}
```

### 形态（全部等级通用）

1. **全直角**：`--radius-*: 0px`，圆角令牌清零
2. **等宽数字**：`font-variant-numeric: tabular-nums`，百分比/版本号/配置表不抖动
3. **字体栈**：界面用系统无衬线黑体，注记/数字用等宽栈 `"Cascadia Code", "SF Mono", Consolas, monospace`
4. **工程网格背景**：72px 网格线，透明度 ≤0.03
5. **角标 L 形刻线**：卡片左上/右下 2px 实线角标（强调色），悬停微移
6. **序号大字**：section 标题配描边空心序号（`-webkit-text-stroke: 1px 边线色`）+ 等宽英文注记（`// ABOUT`）+ 标题下 72px 强调色短杠
7. **切角按钮**：主按钮 `clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%)`，强调色实底 + 深色文字
8. **黄黑警示条纹**：`repeating-linear-gradient(-45deg, 强调色 0 12px, 底色 12px 24px)`，仅作分隔点缀（footer 顶、分隔线）
9. **HUD 元素**：左下坐标/状态等宽读数、右缘竖排注记、`[REC]` 闪烁红点、视口四角取景刻线、滚动提示细线+光点下坠
10. **阴影克制**：只允许低透明度黑投影，禁止霓虹 glow

## 第三步：开屏三阶段（L1/L2/L5/L6）

时序（可微调 ±20%）：

1. **充填**（约 1900ms）：最左侧竖向加载条（8px 宽、全视口高、`transform-origin: top` + `scaleY`）自最上方压向最下方 0→100；同步驱动底部细进度线与三位等宽百分比读数（`000`→`100`，`padStart(3,'0')`）；进度模拟上限 99，必须等 `window.load` 后才放行到 100
2. **右滑**（约 780ms，`cubic-bezier(0.76, 0, 0.24, 1)`）：满值停顿约 320ms 后，遮罩整体 `translateX(102%)` 从最左侧滑向最右侧，遮罩左缘 3px 强调色边线作为扫场前缘
3. **渐显**：滑场到位后停顿约 460ms，移除加载层，派发 `loader:done` 事件，首屏元素逐个渐显（每项延迟约 110ms）、顶栏淡入

实现要点：

- 加载期间 `body.is-loading` 锁定滚轮/键盘/触摸输入（在 fullpage/wheel/key/touch 处理器入口统一拦截）
- HUD 布局：左上品牌字标、右上 `[REC]` 红点闪烁、左下大号百分比+状态行+版本号、底部细进度线
- `prefers-reduced-motion: reduce` 时跳过模拟与扫场，直接快速淡出
- 加载层 `display:flex` 之上的整站元素默认 `opacity:0`，仅在 `loader:done` 后触发入场，避免遮罩滑开前内容提前曝光

## 第四步：整站改造清单（L1-L4）

- **顶栏**：56px 固定顶栏，高透明底+高斯模糊（`rgba(16,17,16,0.78)` + `blur(12px)`），左品牌字标，右等宽小字导航+语言切换（CN|EN 等权按钮）
- **右侧导航指示器**：短横线刻度（20px→激活 32px 强调色），替换圆点
- **Hero**：左对齐大字排版，`clamp(3rem, 9vw, 6.5rem)` 黑体 900；背景图压暗去饱和（`grayscale(65%) contrast(1.08) brightness(0.5)`）+ 深色双向渐变遮罩
- **卡片**：直角细线边框 + 角标刻线 + 等宽序号角标；hover 仅边框变色+微移
- **需求/规格列表**：虚线分隔行，标签用弱色、值用等宽字体
- **弹窗**：顶部 3px 强调色边线；**强制选择**（禁止点击遮罩关闭），同级按钮等权重描边样式
- **滚动条**：轨道透明、滑块边线色、hover 强调色；`::selection` 强调色底+深色字

通用约束（用户规则，就项目基础而定）：

- 文案与代码分离：所有可见文案收进 i18n 资源（`data-i18n` 键 + zh-CN/en-US 字典），禁止硬编码
- 移动端 ≤768px：断点覆盖、grid 固定列数（3→2→1，禁 auto-fit）、`html/body` 限宽防横向溢出
- 图标一律 SVG；第三方品牌 logo（如 TapTap）**不得染色/加滤镜**，用官方色板原色，周边留白