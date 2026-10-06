import { palette } from '../palette';

const { slate, blue, emerald, amber, rose, sky, white } = palette;

/**
 * Light 主题 Token
 *
 * 对齐 antdv-next 的 AliasToken 命名（camelCase）
 * 详情参考：https://ant.design/docs/react/customize-theme-cn#seedtoken
 */
export const lightToken = {
  /* ============================================================
   * Seed Token（基础色）
   * ============================================================ */
  colorPrimary: blue[600],
  colorSuccess: emerald[500],
  colorWarning: amber[500],
  colorError: rose[500],
  colorInfo: sky[500],
  colorLink: blue[600],

  colorTextBase: slate[900],
  colorBgBase: white,

  /* 预设色板 */
  blue: blue[600],
  purple: '#9333ea', // purple-600
  cyan: '#06b6d4', // cyan-500
  green: '#22c55e', // green-500
  magenta: '#d946ef', // fuchsia-500
  pink: '#ec4899', // pink-500
  red: '#ef4444', // red-500
  orange: '#f97316', // orange-500
  yellow: '#facc15', // yellow-400
  volcano: '#ea580c', // orange-600
  geekblue: '#4f46e5', // indigo-600
  lime: '#84cc16', // lime-500
  gold: '#f59e0b', // amber-500

  /* ============================================================
   * 主色系
   * ============================================================ */
  colorPrimaryHover: blue[500],
  colorPrimaryActive: blue[700],
  colorPrimaryBg: blue[50],
  colorPrimaryBgHover: blue[100],
  colorPrimaryBorder: blue[200],
  colorPrimaryBorderHover: blue[300],
  colorPrimaryText: blue[600],
  colorPrimaryTextHover: blue[500],
  colorPrimaryTextActive: blue[700],

  /* ============================================================
   * 成功色系
   * ============================================================ */
  colorSuccessHover: emerald[400],
  colorSuccessActive: emerald[600],
  colorSuccessBg: emerald[50],
  colorSuccessBgHover: emerald[100],
  colorSuccessBorder: emerald[200],
  colorSuccessBorderHover: emerald[300],
  colorSuccessText: emerald[600],
  colorSuccessTextHover: emerald[500],
  colorSuccessTextActive: emerald[700],

  /* ============================================================
   * 警告色系
   * ============================================================ */
  colorWarningHover: amber[400],
  colorWarningActive: amber[600],
  colorWarningAffix: amber[500],
  colorWarningBg: amber[50],
  colorWarningBgHover: amber[100],
  colorWarningBorder: amber[200],
  colorWarningBorderHover: amber[300],
  colorWarningText: amber[600],
  colorWarningTextHover: amber[500],
  colorWarningTextActive: amber[700],
  colorWarningOutline: 'rgba(245, 158, 11, 0.1)',

  /* ============================================================
   * 错误色系
   * ============================================================ */
  colorErrorHover: rose[400],
  colorErrorActive: rose[600],
  colorErrorAffix: rose[500],
  colorErrorBg: rose[50],
  colorErrorBgHover: rose[100],
  colorErrorBgActive: rose[200],
  colorErrorBgFilledHover: rose[100],
  colorErrorBorder: rose[200],
  colorErrorBorderHover: rose[300],
  colorErrorText: rose[600],
  colorErrorTextHover: rose[500],
  colorErrorTextActive: rose[700],
  colorErrorOutline: 'rgba(244, 63, 94, 0.1)',

  /* ============================================================
   * 信息色系
   * ============================================================ */
  colorInfoHover: sky[400],
  colorInfoActive: sky[600],
  colorInfoBg: sky[50],
  colorInfoBgHover: sky[100],
  colorInfoBorder: sky[200],
  colorInfoBorderHover: sky[300],
  colorInfoText: sky[600],
  colorInfoTextHover: sky[500],
  colorInfoTextActive: sky[700],

  /* ============================================================
   * 文本色
   * ============================================================ */
  colorText: slate[800],
  colorTextSecondary: slate[600],
  colorTextTertiary: slate[500],
  colorTextQuaternary: slate[400],
  colorTextDisabled: slate[300],
  colorTextHeading: slate[900],
  colorTextLabel: slate[700],
  colorTextDescription: slate[500],
  colorTextPlaceholder: slate[400],
  colorTextLightSolid: white,

  /* ============================================================
   * 背景色
   * ============================================================ */
  colorBgContainer: white,
  colorBgContainerDisabled: slate[100],
  colorBgElevated: white,
  colorBgLayout: slate[50],
  colorBgMask: 'rgba(15, 23, 42, 0.45)',
  colorBgSpotlight: 'rgba(15, 23, 42, 0.85)',
  colorBgBlur: 'transparent',
  colorBgTextHover: 'rgba(15, 23, 42, 0.06)',
  colorBgTextActive: 'rgba(15, 23, 42, 0.15)',

  colorBgSolid: slate[900],
  colorBgSolidHover: slate[800],
  colorBgSolidActive: slate[700],

  /* ============================================================
   * 边框色
   * ============================================================ */
  colorBorder: slate[300],
  colorBorderSecondary: slate[200],
  colorBorderDisabled: slate[200],
  colorBorderBg: white,
  colorSplit: 'rgba(15, 23, 42, 0.06)',

  /* ============================================================
   * 填充色
   * ============================================================ */
  colorFill: 'rgba(15, 23, 42, 0.15)',
  colorFillSecondary: 'rgba(15, 23, 42, 0.06)',
  colorFillTertiary: 'rgba(15, 23, 42, 0.04)',
  colorFillQuaternary: 'rgba(15, 23, 42, 0.02)',
  colorFillAlter: 'rgba(15, 23, 42, 0.02)',
  colorFillContent: 'rgba(15, 23, 42, 0.06)',
  colorFillContentHover: 'rgba(15, 23, 42, 0.15)',

  /* ============================================================
   * 图标色
   * ============================================================ */
  colorIcon: slate[400],
  colorIconHover: slate[600],

  /* ============================================================
   * 链接色
   * ============================================================ */
  colorLinkHover: blue[500],
  colorLinkActive: blue[700],

  /* ============================================================
   * 交互态
   * ============================================================ */
  controlItemBgActive: blue[50],
  controlItemBgActiveHover: blue[100],
  controlItemBgActiveDisabled: slate[200],
  controlItemBgHover: slate[100],
  controlOutline: 'rgba(37, 99, 235, 0.12)',

  /* ============================================================
   * 其他
   * ============================================================ */
  colorHighlight: rose[500],
  colorShadow: slate[900],
  colorWhite: white,

  /* ============================================================
   * Layout 组件
   * ============================================================ */
  layoutBodyBg: slate[50],
  layoutHeaderBg: white,
  layoutHeaderColor: slate[800],
  layoutFooterBg: slate[50],
  layoutSiderBg: white,
  layoutTriggerBg: white,
  layoutTriggerColor: slate[600],
  layoutLightSiderBg: white,
  layoutLightTriggerBg: slate[100],
  layoutLightTriggerColor: slate[600],
} as const;

export type AntToken = typeof lightToken;
