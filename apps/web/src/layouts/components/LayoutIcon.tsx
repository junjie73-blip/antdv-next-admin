import type { LayoutMode } from '@antdv/types';

import { theme } from 'antdv-next';
import { cn } from '~/utils/cn';

interface LayoutIconProps {
  type: LayoutMode;
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
      case 'vertical': {
        return <VerticalIcon active={active} colors={colors} />;
      }
      case 'horizontal': {
        return <HorizontalIcon active={active} colors={colors} />;
      }
      case 'mixed': {
        return <MixedIcon active={active} colors={colors} />;
      }
      default: {
        return null;
      }
    }
  };

  return <div class={containerClassName}>{renderIcon()}</div>;
}

export const LAYOUT_OPTIONS: { value: LayoutMode; label: string }[] = [
  { value: 'vertical', label: '纵向' },
  // { value: "split", label: "分栏" },
  // { value: "double", label: "双栏" },
  // { value: "classic", label: "经典" },
  { value: 'mixed', label: '混合' },
  { value: 'horizontal', label: '横向' },
];
