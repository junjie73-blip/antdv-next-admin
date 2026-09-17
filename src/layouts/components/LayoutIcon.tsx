
import { theme } from "antdv-next";

import type { LayoutMode } from "../composables/useLayout";

import { cn } from "@/utils/cn";

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
function VerticalIcon({ active, colors }: { active?: boolean; colors: Colors }) {
  const c = getColors(active, colors);
  return (
    <svg viewBox="0 0 48 36" class="w-full h-auto">
      {/* 左侧菜单栏 */}
      <rect x="0" y="0" width="10" height="36" rx="1" fill={c.bar} />
      <rect x="2" y="4" width="6" height="1.5" rx="0.5" fill={c.menuLine} />
      <rect x="2" y="7" width="5" height="1.5" rx="0.5" fill={c.menuLineSoft} />

      {/* 顶部横栏 */}
      <rect x="10" y="0" width="38" height="6" fill={c.bar} />
      <rect x="13" y="2" width="6" height="2" rx="0.5" fill={c.menuLine} />

      {/* 主内容 */}
      <rect x="10" y="6" width="38" height="30" fill={c.surface} />
      <rect x="13" y="10" width="12" height="2" rx="0.5" fill={c.accent} />
      <rect x="13" y="14" width="8" height="2" rx="0.5" fill={c.accentSoft} />
      <rect x="13" y="18" width="10" height="2" rx="0.5" fill={c.accentSoft} />
    </svg>
  );
}

// ============================================================
// 横向
// ============================================================
function HorizontalIcon({ active, colors }: { active?: boolean; colors: Colors }) {
  const c = getColors(active, colors);
  return (
    <svg viewBox="0 0 48 36" class="w-full h-auto">
      {/* 顶部菜单栏 */}
      <rect x="0" y="0" width="48" height="6" rx="1" fill={c.bar} />
      <rect x="3" y="2" width="4" height="2" rx="0.5" fill={c.menuLine} />
      <rect x="14" y="2" width="6" height="2" rx="0.5" fill={c.menuLineSoft} />
      <rect x="22" y="2" width="6" height="2" rx="0.5" fill={c.menuLineSoft} />
      <rect x="30" y="2" width="6" height="2" rx="0.5" fill={c.menuLineSoft} />

      {/* 主内容 */}
      <rect x="0" y="6" width="48" height="30" fill={c.surface} />
      <rect x="3" y="10" width="12" height="2" rx="0.5" fill={c.accent} />
      <rect x="3" y="14" width="8" height="2" rx="0.5" fill={c.accentSoft} />
      <rect x="3" y="18" width="10" height="2" rx="0.5" fill={c.accentSoft} />
    </svg>
  );
}

// ============================================================
// 混合
// ============================================================
function MixedIcon({ active, colors }: { active?: boolean; colors: Colors }) {
  const c = getColors(active, colors);
  return (
    <svg viewBox="0 0 48 36" class="w-full h-auto">
      {/* 顶栏 */}
      <rect x="0" y="0" width="48" height="6" rx="1" fill={c.bar} />
      <rect x="3" y="2" width="4" height="2" rx="0.5" fill={c.menuLine} />
      <rect x="20" y="2" width="6" height="2" rx="0.5" fill={c.menuLineSoft} />
      <rect x="28" y="2" width="6" height="2" rx="0.5" fill={c.menuLineSoft} />

      {/* 左侧菜单 */}
      <rect x="0" y="6" width="10" height="30" fill={c.barSoft} />
      <rect x="2" y="10" width="6" height="1.5" rx="0.5" fill={c.accent} />
      <rect x="2" y="13" width="5" height="1.5" rx="0.5" fill={c.accentSoft} />

      {/* 主内容 */}
      <rect x="10" y="6" width="38" height="30" fill={c.surface} />
      <rect x="13" y="10" width="10" height="2" rx="0.5" fill={c.accent} />
    </svg>
  );
}

// ============================================================
// 经典（左上 logo + 顶部菜单 + 左侧菜单）
// ============================================================
function ClassicIcon({ active, colors }: { active?: boolean; colors: Colors }) {
  const c = getColors(active, colors);
  return (
    <svg viewBox="0 0 48 36" class="w-full h-auto">
      {/* 左上 logo */}
      <rect x="0" y="0" width="10" height="6" fill={c.bar} />
      <rect x="3" y="2" width="4" height="2" rx="0.5" fill={c.menuLine} />

      {/* 顶部菜单 */}
      <rect x="10" y="0" width="38" height="6" fill={c.bar} />
      <rect x="13" y="2" width="6" height="2" rx="0.5" fill={c.menuLineSoft} />
      <rect x="21" y="2" width="6" height="2" rx="0.5" fill={c.menuLineSoft} />

      {/* 左侧菜单 */}
      <rect x="0" y="6" width="10" height="30" fill={c.barSoft} />
      <rect x="2" y="10" width="6" height="1.5" rx="0.5" fill={c.accent} />
      <rect x="2" y="13" width="5" height="1.5" rx="0.5" fill={c.accentSoft} />
      <rect x="2" y="16" width="6" height="1.5" rx="0.5" fill={c.accentSoft} />

      {/* 主内容 */}
      <rect x="10" y="6" width="38" height="30" fill={c.surface} />
      <rect x="13" y="10" width="12" height="2" rx="0.5" fill={c.accent} />
      <rect x="13" y="14" width="8" height="2" rx="0.5" fill={c.accentSoft} />
    </svg>
  );
}

// ============================================================
// 双栏
// ============================================================
function DoubleIcon({ active, colors }: { active?: boolean; colors: Colors }) {
  const c = getColors(active, colors);
  return (
    <svg viewBox="0 0 48 36" class="w-full h-auto">
      {/* 左窄栏 */}
      <rect x="0" y="0" width="6" height="36" rx="1" fill={c.bar} />
      <rect x="1.5" y="4" width="3" height="1.5" rx="0.5" fill={c.menuLine} />
      <rect x="1.5" y="7" width="3" height="1.5" rx="0.5" fill={c.menuLineSoft} />

      {/* 中菜单栏 */}
      <rect x="6" y="0" width="12" height="36" fill={c.barSoft} />
      <rect x="8" y="4" width="8" height="2" rx="0.5" fill={c.accent} />
      <rect x="8" y="8" width="6" height="1.5" rx="0.5" fill={c.accentSoft} />
      <rect x="8" y="11" width="7" height="1.5" rx="0.5" fill={c.accentSoft} />
      <rect x="8" y="14" width="5" height="1.5" rx="0.5" fill={c.accentSoft} />

      {/* 主内容 */}
      <rect x="18" y="0" width="30" height="36" fill={c.surface} />
      <rect x="21" y="4" width="12" height="2" rx="0.5" fill={c.accent} />
      <rect x="21" y="8" width="8" height="2" rx="0.5" fill={c.accentSoft} />
      <rect x="21" y="12" width="10" height="2" rx="0.5" fill={c.accentSoft} />
    </svg>
  );
}

// ============================================================
// 分栏（左侧上 logo + 下菜单）
// ============================================================
function SplitIcon({ active, colors }: { active?: boolean; colors: Colors }) {
  const c = getColors(active, colors);

  return (
    <svg viewBox="0 0 48 36" class="w-full h-auto">
      {/* 左上 logo */}
      <rect x="0" y="0" width="10" height="10" rx="1" fill={c.bar} />
      <rect x="3" y="4" width="4" height="2" rx="0.5" fill={c.menuLine} />

      {/* 左下菜单 */}
      <rect x="0" y="10" width="10" height="26" rx="1" fill={c.barSoft} />
      <rect x="2" y="14" width="6" height="1.5" rx="0.5" fill={c.accent} />
      <rect x="2" y="17" width="5" height="1.5" rx="0.5" fill={c.accentSoft} />
      <rect x="2" y="20" width="6" height="1.5" rx="0.5" fill={c.accentSoft} />
      <rect x="2" y="23" width="4" height="1.5" rx="0.5" fill={c.accentSoft} />

      {/* 主内容 */}
      <rect x="10" y="0" width="38" height="36" fill={c.surface} />
      <rect x="13" y="4" width="12" height="2" rx="0.5" fill={c.accent} />
      <rect x="13" y="8" width="8" height="2" rx="0.5" fill={c.accentSoft} />
      <rect x="13" y="12" width="10" height="2" rx="0.5" fill={c.accentSoft} />
    </svg>
  );
}

function getColors(active: boolean | undefined, c: Colors) {
  return {
    bar: active ? c.primary : c.primaryBg,
    barSoft: active ? c.primaryHover : c.primaryBorder,
    accent: active ? c.primary : c.primaryBorder,
    accentSoft: active ? c.primaryBorder : c.primaryBg,
    menuLine: active ? "rgba(255,255,255,0.85)" : c.primaryBorder,
    menuLineSoft: active ? "rgba(255,255,255,0.4)" : c.primaryBg,
    content: "#ffffff",
    surface: "#f8fafc",
  };
}
// ============================================================
// 主组件
// ============================================================
export function LayoutIcon(props: LayoutIconProps) {
  const { token } = theme.useToken();
  const { type, active, class: className } = props;
  const containerClassName = cn("w-full aspect-[4/3]", className);

  // ⭐ 从 antdv 直接读 token，不依赖 CSS 变量
  const colors = {
    primary: token.value.colorPrimary,
    primaryHover: token.value.colorPrimaryHover,
    primaryBg: token.value.colorPrimaryBg,
    primaryBorder: token.value.colorPrimaryBorder,
  };

  const renderIcon = () => {
    switch (type) {
      case "vertical":
        return <VerticalIcon active={active} colors={colors} />;
      case "horizontal":
        return <HorizontalIcon active={active} colors={colors} />;
      case "mixed":
        return <MixedIcon active={active} colors={colors} />;
      default:
        return null;
    }
  };

  return <div class={containerClassName}>{renderIcon()}</div>;
}

export const LAYOUT_OPTIONS: { value: LayoutMode; label: string }[] = [
  { value: "vertical", label: "纵向" },
  // { value: "split", label: "分栏" },
  // { value: "double", label: "双栏" },
  // { value: "classic", label: "经典" },
  { value: "mixed", label: "混合" },
  { value: "horizontal", label: "横向" },
];
