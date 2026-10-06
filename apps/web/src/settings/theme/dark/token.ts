import { palette } from '../palette';

const { slate, blue, emerald, amber, rose, sky, white, black } = palette;

/**
 * Dark 主题 Token
 * 说明：与 Light 结构完全一致，只是色值不同
 */
export const darkToken = {
  /* ============================================================
   * Seed
   * ============================================================ */
  colorPrimary: blue[400],
  colorSuccess: emerald[400],
  colorWarning: amber[400],
  colorError: rose[400],
  colorInfo: sky[400],
  colorLink: blue[400],

  colorTextBase: slate[100],
  colorBgBase: slate[950],

  /* 预设色板（暗色下提亮一档） */
  blue: blue[400],
  purple: '#a855f7', // purple-500
  cyan: '#22d3ee', // cyan-400
  green: '#4ade80', // green-400
  magenta: '#e879f9', // fuchsia-400
  pink: '#f472b6', // pink-400
  red: '#f87171', // red-400
  orange: '#fb923c', // orange-400
  yellow: '#fde047', // yellow-300
  volcano: '#fb923c', // orange-400
  geekblue: '#818cf8', // indigo-400
  lime: '#a3e635', // lime-400
  gold: '#fbbf24', // amber-400

  /* ============================================================
   * 主色系
   * ============================================================ */
  colorPrimaryHover: blue[300],
  colorPrimaryActive: blue[500],
  colorPrimaryBg: 'rgba(59, 130, 246, 0.15)',
  colorPrimaryBgHover: 'rgba(59, 130, 246, 0.25)',
  colorPrimaryBorder: blue[700],
  colorPrimaryBorderHover: blue[600],
  colorPrimaryText: blue[400],
  colorPrimaryTextHover: blue[300],
  colorPrimaryTextActive: blue[500],

  /* ============================================================
   * 成功色系
   * ============================================================ */
  colorSuccessHover: emerald[300],
  colorSuccessActive: emerald[500],
  colorSuccessBg: 'rgba(16, 185, 129, 0.15)',
  colorSuccessBgHover: 'rgba(16, 185, 129, 0.25)',
  colorSuccessBorder: emerald[700],
  colorSuccessBorderHover: emerald[600],
  colorSuccessText: emerald[400],
  colorSuccessTextHover: emerald[300],
  colorSuccessTextActive: emerald[500],

  /* ============================================================
   * 警告色系
   * ============================================================ */
  colorWarningHover: amber[300],
  colorWarningActive: amber[500],
  colorWarningAffix: amber[400],
  colorWarningBg: 'rgba(245, 158, 11, 0.15)',
  colorWarningBgHover: 'rgba(245, 158, 11, 0.25)',
  colorWarningBorder: amber[700],
  colorWarningBorderHover: amber[600],
  colorWarningText: amber[400],
  colorWarningTextHover: amber[300],
  colorWarningTextActive: amber[500],
  colorWarningOutline: 'rgba(251, 191, 36, 0.15)',

  /* ============================================================
   * 错误色系
   * ============================================================ */
  colorErrorHover: rose[300],
  colorErrorActive: rose[500],
  colorErrorAffix: rose[400],
  colorErrorBg: 'rgba(244, 63, 94, 0.15)',
  colorErrorBgHover: 'rgba(244, 63, 94, 0.25)',
  colorErrorBgActive: 'rgba(244, 63, 94, 0.35)',
  colorErrorBgFilledHover: 'rgba(244, 63, 94, 0.25)',
  colorErrorBorder: rose[700],
  colorErrorBorderHover: rose[600],
  colorErrorText: rose[400],
  colorErrorTextHover: rose[300],
  colorErrorTextActive: rose[500],
  colorErrorOutline: 'rgba(251, 113, 133, 0.15)',

  /* ============================================================
   * 信息色系
   * ============================================================ */
  colorInfoHover: sky[300],
  colorInfoActive: sky[500],
  colorInfoBg: 'rgba(14, 165, 233, 0.15)',
  colorInfoBgHover: 'rgba(14, 165, 233, 0.25)',
  colorInfoBorder: sky[700],
  colorInfoBorderHover: sky[600],
  colorInfoText: sky[400],
  colorInfoTextHover: sky[300],
  colorInfoTextActive: sky[500],

  /* ============================================================
   * 文本色
   * ============================================================ */
  colorText: slate[100],
  colorTextSecondary: slate[300],
  colorTextTertiary: slate[400],
  colorTextQuaternary: slate[500],
  colorTextDisabled: slate[600],
  colorTextHeading: slate[50],
  colorTextLabel: slate[200],
  colorTextDescription: slate[400],
  colorTextPlaceholder: slate[500],
  colorTextLightSolid: white,

  /* ============================================================
   * 背景色
   * ============================================================ */
  colorBgContainer: slate[900],
  colorBgContainerDisabled: slate[800],
  colorBgElevated: slate[800],
  colorBgLayout: slate[950],
  colorBgMask: 'rgba(0, 0, 0, 0.65)',
  colorBgSpotlight: 'rgba(0, 0, 0, 0.85)',
  colorBgBlur: 'transparent',
  colorBgTextHover: 'rgba(255, 255, 255, 0.08)',
  colorBgTextActive: 'rgba(255, 255, 255, 0.15)',

  colorBgSolid: slate[100],
  colorBgSolidHover: white,
  colorBgSolidActive: slate[200],

  /* ============================================================
   * 边框色
   * ============================================================ */
  colorBorder: slate[700],
  colorBorderSecondary: slate[800],
  colorBorderDisabled: slate[800],
  colorBorderBg: slate[900],
  colorSplit: 'rgba(255, 255, 255, 0.06)',

  /* ============================================================
   * 填充色
   * ============================================================ */
  colorFill: 'rgba(255, 255, 255, 0.18)',
  colorFillSecondary: 'rgba(255, 255, 255, 0.12)',
  colorFillTertiary: 'rgba(255, 255, 255, 0.08)',
  colorFillQuaternary: 'rgba(255, 255, 255, 0.04)',
  colorFillAlter: 'rgba(255, 255, 255, 0.04)',
  colorFillContent: 'rgba(255, 255, 255, 0.12)',
  colorFillContentHover: 'rgba(255, 255, 255, 0.18)',

  /* ============================================================
   * 图标色
   * ============================================================ */
  colorIcon: slate[500],
  colorIconHover: slate[300],

  /* ============================================================
   * 链接色
   * ============================================================ */
  colorLinkHover: blue[300],
  colorLinkActive: blue[500],

  /* ============================================================
   * 交互态
   * ============================================================ */
  controlItemBgActive: 'rgba(59, 130, 246, 0.15)',
  controlItemBgActiveHover: 'rgba(59, 130, 246, 0.25)',
  controlItemBgActiveDisabled: slate[800],
  controlItemBgHover: slate[800],
  controlOutline: 'rgba(96, 165, 250, 0.15)',

  /* ============================================================
   * 其他
   * ============================================================ */
  colorHighlight: rose[400],
  colorShadow: black,
  colorWhite: white,

  /* ============================================================
   * Layout 组件
   * ============================================================ */
  layoutBodyBg: slate[950],
  layoutHeaderBg: slate[900],
  layoutHeaderColor: slate[100],
  layoutFooterBg: slate[900],
  layoutSiderBg: slate[900],
  layoutTriggerBg: slate[800],
  layoutTriggerColor: slate[300],
  layoutLightSiderBg: slate[900],
  layoutLightTriggerBg: slate[800],
  layoutLightTriggerColor: slate[300],
} as const;
