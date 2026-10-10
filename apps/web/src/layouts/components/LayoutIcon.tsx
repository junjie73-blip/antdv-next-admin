import type { LayoutMode } from '@antdv/types';

import { cn } from '@antdv/shared/cn';
import { theme } from 'antdv-next';

/**
 * 图示例子的种类。
 *
 * 7 个布局形态来自 `LayoutMode`；两个"内容宽度"（流式 / 定宽）与形态正交，
 * 只在这套示意图里出现，所以用额外的字面量补上，而不是污染偏好类型。
 */
export type LayoutIconType = 'content-fixed' | 'content-full' | LayoutMode;

interface LayoutIconProps {
  type: LayoutIconType;
  active?: boolean;
  class?: string;
}
interface Colors {
  primary: string;
  primaryHover: string;
  primaryBg: string;
  primaryBorder: string;
}

// ============================================================
// 纵向
// ============================================================
function VerticalIcon({
  active,
  colors,
}: {
  active?: boolean;
  colors: Colors;
}) {
  const c = getColors(active, colors);
  return (
    <svg class="h-auto w-full" viewBox="0 0 48 36">
      {/* 左侧菜单栏 */}
      <rect fill={c.bar} height="36" rx="1" width="10" x="0" y="0" />
      <rect fill={c.menuLine} height="1.5" rx="0.5" width="6" x="2" y="4" />
      <rect fill={c.menuLineSoft} height="1.5" rx="0.5" width="5" x="2" y="7" />

      {/* 顶部横栏 */}
      <rect fill={c.bar} height="6" width="38" x="10" y="0" />
      <rect fill={c.menuLine} height="2" rx="0.5" width="6" x="13" y="2" />

      {/* 主内容 */}
      <rect fill={c.surface} height="30" width="38" x="10" y="6" />
      <rect fill={c.accent} height="2" rx="0.5" width="12" x="13" y="10" />
      <rect fill={c.accentSoft} height="2" rx="0.5" width="8" x="13" y="14" />
      <rect fill={c.accentSoft} height="2" rx="0.5" width="10" x="13" y="18" />
    </svg>
  );
}

// ============================================================
// 横向
// ============================================================
function HorizontalIcon({
  active,
  colors,
}: {
  active?: boolean;
  colors: Colors;
}) {
  const c = getColors(active, colors);
  return (
    <svg class="h-auto w-full" viewBox="0 0 48 36">
      {/* 顶部菜单栏 */}
      <rect fill={c.bar} height="6" rx="1" width="48" x="0" y="0" />
      <rect fill={c.menuLine} height="2" rx="0.5" width="4" x="3" y="2" />
      <rect fill={c.menuLineSoft} height="2" rx="0.5" width="6" x="14" y="2" />
      <rect fill={c.menuLineSoft} height="2" rx="0.5" width="6" x="22" y="2" />
      <rect fill={c.menuLineSoft} height="2" rx="0.5" width="6" x="30" y="2" />

      {/* 主内容 */}
      <rect fill={c.surface} height="30" width="48" x="0" y="6" />
      <rect fill={c.accent} height="2" rx="0.5" width="12" x="3" y="10" />
      <rect fill={c.accentSoft} height="2" rx="0.5" width="8" x="3" y="14" />
      <rect fill={c.accentSoft} height="2" rx="0.5" width="10" x="3" y="18" />
    </svg>
  );
}

// ============================================================
// 混合
// ============================================================
function MixedIcon({ active, colors }: { active?: boolean; colors: Colors }) {
  const c = getColors(active, colors);
  return (
    <svg class="h-auto w-full" viewBox="0 0 48 36">
      {/* 顶栏 */}
      <rect fill={c.bar} height="6" rx="1" width="48" x="0" y="0" />
      <rect fill={c.menuLine} height="2" rx="0.5" width="4" x="3" y="2" />
      <rect fill={c.menuLineSoft} height="2" rx="0.5" width="6" x="20" y="2" />
      <rect fill={c.menuLineSoft} height="2" rx="0.5" width="6" x="28" y="2" />

      {/* 左侧菜单 */}
      <rect fill={c.barSoft} height="30" width="10" x="0" y="6" />
      <rect fill={c.accent} height="1.5" rx="0.5" width="6" x="2" y="10" />
      <rect fill={c.accentSoft} height="1.5" rx="0.5" width="5" x="2" y="13" />

      {/* 主内容 */}
      <rect fill={c.surface} height="30" width="38" x="10" y="6" />
      <rect fill={c.accent} height="2" rx="0.5" width="10" x="13" y="10" />
    </svg>
  );
}

// ============================================================
// 经典（左上 logo + 顶部菜单 + 左侧菜单）
// ============================================================
function ClassicIcon({ active, colors }: { active?: boolean; colors: Colors }) {
  const c = getColors(active, colors);
  return (
    <svg class="h-auto w-full" viewBox="0 0 48 36">
      {/* 左上 logo */}
      <rect fill={c.bar} height="6" width="10" x="0" y="0" />
      <rect fill={c.menuLine} height="2" rx="0.5" width="4" x="3" y="2" />

      {/* 顶部菜单 */}
      <rect fill={c.bar} height="6" width="38" x="10" y="0" />
      <rect fill={c.menuLineSoft} height="2" rx="0.5" width="6" x="13" y="2" />
      <rect fill={c.menuLineSoft} height="2" rx="0.5" width="6" x="21" y="2" />

      {/* 左侧菜单 */}
      <rect fill={c.barSoft} height="30" width="10" x="0" y="6" />
      <rect fill={c.accent} height="1.5" rx="0.5" width="6" x="2" y="10" />
      <rect fill={c.accentSoft} height="1.5" rx="0.5" width="5" x="2" y="13" />
      <rect fill={c.accentSoft} height="1.5" rx="0.5" width="6" x="2" y="16" />

      {/* 主内容 */}
      <rect fill={c.surface} height="30" width="38" x="10" y="6" />
      <rect fill={c.accent} height="2" rx="0.5" width="12" x="13" y="10" />
      <rect fill={c.accentSoft} height="2" rx="0.5" width="8" x="13" y="14" />
    </svg>
  );
}

// ============================================================
// 双栏
// ============================================================
function DoubleIcon({ active, colors }: { active?: boolean; colors: Colors }) {
  const c = getColors(active, colors);
  return (
    <svg class="h-auto w-full" viewBox="0 0 48 36">
      {/* 左窄栏 */}
      <rect fill={c.bar} height="36" rx="1" width="6" x="0" y="0" />
      <rect fill={c.menuLine} height="1.5" rx="0.5" width="3" x="1.5" y="4" />
      <rect
        fill={c.menuLineSoft}
        height="1.5"
        rx="0.5"
        width="3"
        x="1.5"
        y="7"
      />

      {/* 中菜单栏 */}
      <rect fill={c.barSoft} height="36" width="12" x="6" y="0" />
      <rect fill={c.accent} height="2" rx="0.5" width="8" x="8" y="4" />
      <rect fill={c.accentSoft} height="1.5" rx="0.5" width="6" x="8" y="8" />
      <rect fill={c.accentSoft} height="1.5" rx="0.5" width="7" x="8" y="11" />
      <rect fill={c.accentSoft} height="1.5" rx="0.5" width="5" x="8" y="14" />

      {/* 主内容 */}
      <rect fill={c.surface} height="36" width="30" x="18" y="0" />
      <rect fill={c.accent} height="2" rx="0.5" width="12" x="21" y="4" />
      <rect fill={c.accentSoft} height="2" rx="0.5" width="8" x="21" y="8" />
      <rect fill={c.accentSoft} height="2" rx="0.5" width="10" x="21" y="12" />
    </svg>
  );
}

// ============================================================
// 分栏（左侧上 logo + 下菜单）
// ============================================================
function SplitIcon({ active, colors }: { active?: boolean; colors: Colors }) {
  const c = getColors(active, colors);

  return (
    <svg class="h-auto w-full" viewBox="0 0 48 36">
      {/* 左上 logo */}
      <rect fill={c.bar} height="10" rx="1" width="10" x="0" y="0" />
      <rect fill={c.menuLine} height="2" rx="0.5" width="4" x="3" y="4" />

      {/* 左下菜单 */}
      <rect fill={c.barSoft} height="26" rx="1" width="10" x="0" y="10" />
      <rect fill={c.accent} height="1.5" rx="0.5" width="6" x="2" y="14" />
      <rect fill={c.accentSoft} height="1.5" rx="0.5" width="5" x="2" y="17" />
      <rect fill={c.accentSoft} height="1.5" rx="0.5" width="6" x="2" y="20" />
      <rect fill={c.accentSoft} height="1.5" rx="0.5" width="4" x="2" y="23" />

      {/* 主内容 */}
      <rect fill={c.surface} height="36" width="38" x="10" y="0" />
      <rect fill={c.accent} height="2" rx="0.5" width="12" x="13" y="4" />
      <rect fill={c.accentSoft} height="2" rx="0.5" width="8" x="13" y="8" />
      <rect fill={c.accentSoft} height="2" rx="0.5" width="10" x="13" y="12" />
    </svg>
  );
}

// ============================================================
// 混合双列（顶栏一级 + 图标栏二级 + 侧栏三级）
// ============================================================
function MixedTwoColumnIcon({
  active,
  colors,
}: {
  active?: boolean;
  colors: Colors;
}) {
  const c = getColors(active, colors);
  return (
    <svg class="h-auto w-full" viewBox="0 0 48 36">
      {/* 顶栏：一级导航 */}
      <rect fill={c.bar} height="6" rx="1" width="48" x="0" y="0" />
      <rect fill={c.menuLine} height="2" rx="0.5" width="4" x="3" y="2" />
      <rect fill={c.menuLineSoft} height="2" rx="0.5" width="6" x="20" y="2" />
      <rect fill={c.menuLineSoft} height="2" rx="0.5" width="6" x="28" y="2" />

      {/* 图标栏：二级 */}
      <rect fill={c.bar} height="30" width="6" x="0" y="6" />
      <rect fill={c.menuLine} height="1.5" rx="0.5" width="3" x="1.5" y="10" />
      <rect
        fill={c.menuLineSoft}
        height="1.5"
        rx="0.5"
        width="3"
        x="1.5"
        y="13"
      />

      {/* 侧栏：三级 */}
      <rect fill={c.barSoft} height="30" width="10" x="6" y="6" />
      <rect fill={c.accent} height="1.5" rx="0.5" width="6" x="8" y="10" />
      <rect fill={c.accentSoft} height="1.5" rx="0.5" width="5" x="8" y="13" />

      {/* 主内容 */}
      <rect fill={c.surface} height="30" width="32" x="16" y="6" />
      <rect fill={c.accent} height="2" rx="0.5" width="10" x="19" y="10" />
    </svg>
  );
}

// ============================================================
// 内容全屏（外壳全部隐去，只剩内容）
// ============================================================
function FullContentIcon({
  active,
  colors,
}: {
  active?: boolean;
  colors: Colors;
}) {
  const c = getColors(active, colors);
  return (
    <svg class="h-auto w-full" viewBox="0 0 48 36">
      {/* 双层矩形模拟描边：外壳只剩一圈边界，中间全是内容 */}
      <rect fill={c.accent} height="36" rx="1" width="48" x="0" y="0" />
      <rect fill={c.surface} height="33" rx="1" width="45" x="1.5" y="1.5" />
      <rect fill={c.accent} height="2" rx="0.5" width="14" x="4" y="6" />
      <rect fill={c.accentSoft} height="2" rx="0.5" width="24" x="4" y="12" />
      <rect fill={c.accentSoft} height="2" rx="0.5" width="20" x="4" y="16" />
      <rect fill={c.accentSoft} height="2" rx="0.5" width="22" x="4" y="20" />
    </svg>
  );
}

// ============================================================
// 内容区宽度：流式 / 定宽
// ============================================================
function ContentWidthIcon({
  active,
  colors,
  fixed,
}: {
  active?: boolean;
  colors: Colors;
  fixed?: boolean;
}) {
  const c = getColors(active, colors);
  return (
    <svg class="h-auto w-full" viewBox="0 0 48 36">
      <rect fill={c.barSoft} height="36" rx="1" width="48" x="0" y="0" />
      {/* 定宽时两侧留白，流式时铺满 */}
      <rect
        fill={c.surface}
        height="36"
        rx="1"
        width={fixed ? 28 : 48}
        x={fixed ? 10 : 0}
        y="0"
      />
      <rect fill={c.accent} height="2" rx="0.5" width="12" x={fixed ? 13 : 3} y="6" />
      <rect fill={c.accentSoft} height="2" rx="0.5" width="18" x={fixed ? 13 : 3} y="12" />
      <rect fill={c.accentSoft} height="2" rx="0.5" width="14" x={fixed ? 13 : 3} y="16" />
      {fixed && (
        <rect fill={c.barSoft} height="36" rx="1" width="8" x="40" y="0" />
      )}
      {fixed && (
        <rect fill={c.barSoft} height="36" rx="1" width="8" x="0" y="0" />
      )}
    </svg>
  );
}

function getColors(active: boolean | undefined, c: Colors) {
  return {
    bar: active ? c.primary : c.primaryBg,
    barSoft: active ? c.primaryHover : c.primaryBorder,
    accent: active ? c.primary : c.primaryBorder,
    accentSoft: active ? c.primaryBorder : c.primaryBg,
    menuLine: active ? 'rgba(255,255,255,0.85)' : c.primaryBorder,
    menuLineSoft: active ? 'rgba(255,255,255,0.4)' : c.primaryBg,
    content: '#ffffff',
    surface: '#f8fafc',
  };
}
// ============================================================
// 主组件
// ============================================================
export function LayoutIcon(props: LayoutIconProps) {
  const { token } = theme.useToken();
  const { type, active, class: className } = props;
  const containerClassName = cn('aspect-[4/3] w-full', className);

  // ⭐ 从 antdv 直接读 token，不依赖 CSS 变量
  const colors = {
    primary: token.value.colorPrimary,
    primaryHover: token.value.colorPrimaryHover,
    primaryBg: token.value.colorPrimaryBg,
    primaryBorder: token.value.colorPrimaryBorder,
  };

  const renderIcon = () => {
    switch (type) {
      /* ---------- 内容区宽度 ---------- */
      case 'content-fixed': {
        return <ContentWidthIcon active={active} colors={colors} fixed />;
      }
      case 'content-full': {
        return <ContentWidthIcon active={active} colors={colors} />;
      }
      /* ---------- 布局形态 ---------- */
      case 'full-content': {
        return <FullContentIcon active={active} colors={colors} />;
      }
      case 'horizontal': {
        return <HorizontalIcon active={active} colors={colors} />;
      }
      case 'mixed-two-column': {
        return <MixedTwoColumnIcon active={active} colors={colors} />;
      }
      case 'mixed-vertical': {
        return <MixedIcon active={active} colors={colors} />;
      }
      case 'side-nav': {
        return <SplitIcon active={active} colors={colors} />;
      }
      case 'two-column': {
        return <DoubleIcon active={active} colors={colors} />;
      }
      case 'vertical': {
        return <VerticalIcon active={active} colors={colors} />;
      }
      default: {
        return <ClassicIcon active={active} colors={colors} />;
      }
    }
  };

  return <div class={containerClassName}>{renderIcon()}</div>;
}
