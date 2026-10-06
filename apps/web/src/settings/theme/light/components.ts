import { palette } from '../palette';

const { white, slate, blue, rose } = palette;

/**
 * ☀️ Light 主题 · 组件级 Token
 *
 * 用法：
 *   <a-config-provider :theme="{ components: lightComponents }">
 */
export const lightComponents = {
  /* ============================================================
   * Layout
   * ============================================================ */
  Layout: {
    bodyBg: slate[50],
    headerBg: white,
    headerColor: slate[800],
    headerHeight: 64,
    headerPadding: '0 24px',
    footerBg: white,
    footerPadding: '16px 24px',
    siderBg: white,
    triggerBg: white,
    triggerColor: slate[600],
    triggerHeight: 48,
    zeroTriggerWidth: 40,
    zeroTriggerHeight: 40,
    lightSiderBg: white,
    lightTriggerBg: slate[100],
    lightTriggerColor: slate[600],
  },

  /* ============================================================
   * Menu
   * ============================================================ */
  Menu: {
    /* ---------- 基础 ---------- */
    itemBg: 'transparent',
    itemColor: slate[700],
    itemHoverBg: slate[100],
    itemHoverColor: slate[900],
    itemSelectedBg: blue[50],
    itemSelectedColor: blue[600],
    itemActiveBg: blue[50],
    itemDisabledColor: slate[300],
    itemHeight: 40,
    itemBorderRadius: 8,
    itemMarginInline: 4,
    itemMarginBlock: 4,
    itemPaddingInline: 16,
    itemWidth: 'calc(100% - 8px)',
    subMenuItemBg: 'transparent',
    subMenuItemBorderRadius: 6,
    subMenuItemSelectedColor: blue[600],
    groupTitleColor: slate[400],
    groupTitleFontSize: 12,
    groupTitleLineHeight: 1.5,
    popupBg: white,
    iconSize: 16,
    iconMarginInlineEnd: 10,
    collapsedIconSize: 16,
    collapsedWidth: 80,
    dropdownWidth: 160,
    zIndexPopup: 1050,

    /* ---------- 激活条 ---------- */
    activeBarBorderWidth: 1,
    activeBarWidth: 0,
    activeBarHeight: 2,

    /* ---------- 水平菜单 ---------- */
    horizontalItemHoverBg: 'transparent',
    horizontalItemHoverColor: blue[500],
    horizontalItemSelectedBg: 'transparent',
    horizontalItemSelectedColor: blue[600],
    horizontalItemBorderRadius: 6,
    horizontalLineHeight: '46px',

    /* ---------- 危险项 ---------- */
    dangerItemColor: rose[500],
    dangerItemHoverColor: rose[500],
    dangerItemActiveBg: rose[50],
    dangerItemSelectedBg: rose[50],
    dangerItemSelectedColor: rose[500],

    /* ---------- 暗色菜单（当前是 light，保留深色模式下的菜单使用场景） ---------- */
    darkItemBg: slate[900],
    darkItemColor: slate[300],
    darkItemHoverBg: 'transparent',
    darkItemHoverColor: white,
    darkItemSelectedBg: blue[600],
    darkItemSelectedColor: white,
    darkItemDisabledColor: slate[600],
    darkPopupBg: slate[900],
    darkSubMenuItemBg: slate[950],
    darkGroupTitleColor: slate[500],
    darkDangerItemColor: rose[400],
    darkDangerItemHoverColor: rose[300],
    darkDangerItemActiveBg: 'rgba(244, 63, 94, 0.15)',
    darkDangerItemSelectedBg: rose[500],
    darkDangerItemSelectedColor: white,
  },

  /* ============================================================
   * Button
   * ============================================================ */
  Button: {
    /* ---------- 尺寸 ---------- */
    contentFontSize: 14,
    contentFontSizeLG: 16,
    contentFontSizeSM: 14,
    fontWeight: 400,
    iconGap: 8,
    onlyIconSize: 'inherit',
    onlyIconSizeLG: 'inherit',
    onlyIconSizeSM: 'inherit',
    paddingInline: 15,
    paddingInlineLG: 15,
    paddingInlineSM: 7,

    /* ---------- default 按钮 ---------- */
    defaultBg: white,
    defaultColor: slate[800],
    defaultBorderColor: slate[300],
    defaultHoverBg: white,
    defaultHoverColor: blue[500],
    defaultHoverBorderColor: blue[300],
    defaultActiveBg: white,
    defaultActiveColor: blue[700],
    defaultActiveBorderColor: blue[700],
    defaultBgDisabled: 'rgba(15, 23, 42, 0.04)',
    dashedBgDisabled: 'rgba(15, 23, 42, 0.04)',
    defaultShadow: '0 2px 0 rgba(15, 23, 42, 0.02)',

    /* ---------- primary 按钮 ---------- */
    primaryColor: white,
    primaryShadow: '0 2px 0 rgba(37, 99, 235, 0.1)',

    /* ---------- danger 按钮 ---------- */
    dangerColor: white,
    dangerShadow: '0 2px 0 rgba(244, 63, 94, 0.06)',
    solidTextColor: white,

    /* ---------- ghost 按钮 ---------- */
    ghostBg: 'transparent',
    defaultGhostColor: white,
    defaultGhostBorderColor: white,

    /* ---------- text / link 按钮 ---------- */
    textHoverBg: 'rgba(15, 23, 42, 0.06)',
    textTextColor: slate[800],
    textTextHoverColor: slate[800],
    textTextActiveColor: slate[800],
    linkHoverBg: 'transparent',
  },

  /* ============================================================
   * Input
   * ============================================================ */
  Input: {
    paddingBlock: 4,
    paddingBlockLG: 7,
    paddingBlockSM: 0,
    paddingInline: 11,
    paddingInlineLG: 11,
    paddingInlineSM: 7,

    inputFontSize: 14,
    inputFontSizeLG: 16,
    inputFontSizeSM: 14,

    activeBg: white,
    hoverBg: white,
    addonBg: 'rgba(15, 23, 42, 0.02)',

    activeBorderColor: blue[600],
    hoverBorderColor: blue[400],
    activeShadow: '0 0 0 2px rgba(37, 99, 235, 0.1)',
    errorActiveShadow: '0 0 0 2px rgba(244, 63, 94, 0.06)',
    warningActiveShadow: '0 0 0 2px rgba(245, 158, 11, 0.1)',
  },

  /* ============================================================
   * Select
   * ============================================================ */
  Select: {
    /* ---------- 尺寸 ---------- */
    optionHeight: 32,
    optionFontSize: 14,
    optionLineHeight: 1.5714285714285714,
    optionPadding: '5px 12px',
    menuPadding: 4,
    dropdownHeight: 180,
    controlItemWidth: 111,
    controlWidth: 184,

    /* ---------- 颜色 ---------- */
    selectorBg: white,
    clearBg: white,
    optionSelectedBg: blue[50],
    optionSelectedColor: slate[800],
    optionSelectedFontWeight: 600,
    optionActiveBg: 'rgba(15, 23, 42, 0.04)',

    hoverBorderColor: blue[400],
    activeBorderColor: blue[600],
    activeOutlineColor: 'rgba(37, 99, 235, 0.12)',

    multipleItemBg: 'rgba(15, 23, 42, 0.06)',
    multipleItemBorderColor: 'transparent',
    multipleItemColorDisabled: slate[300],
    multipleItemBorderColorDisabled: 'transparent',
    multipleItemHeight: 24,
    multipleItemHeightLG: 32,
    multipleItemHeightSM: 16,
    multipleSelectorBgDisabled: 'rgba(15, 23, 42, 0.04)',

    showArrowPaddingInlineEnd: 18,
    singleItemHeightLG: 40,
    zIndexPopup: 1050,
  },

  /* ============================================================
   * Cascader
   * ============================================================ */
  Cascader: {
    controlItemWidth: 111,
    controlWidth: 184,
    dropdownHeight: 180,
    menuPadding: 4,
    optionPadding: '5px 12px',
    optionSelectedBg: blue[50],
    optionSelectedColor: slate[800],
    optionSelectedFontWeight: 600,
  },

  /* ============================================================
   * DatePicker
   * ============================================================ */
  DatePicker: {
    /* ---------- 尺寸 ---------- */
    paddingBlock: 4,
    paddingBlockLG: 7,
    paddingBlockSM: 0,
    paddingInline: 11,
    paddingInlineLG: 11,
    paddingInlineSM: 7,
    inputFontSize: 14,
    inputFontSizeLG: 16,
    inputFontSizeSM: 14,
    textHeight: 40,
    cellHeight: 24,
    cellWidth: 36,
    timeColumnHeight: 224,
    timeColumnWidth: 56,
    timeCellHeight: 28,
    withoutTimeCellHeight: 66,
    presetsWidth: 120,
    presetsMaxWidth: 200,

    /* ---------- 颜色 ---------- */
    activeBg: white,
    hoverBg: white,
    addonBg: 'rgba(15, 23, 42, 0.02)',

    activeBorderColor: blue[600],
    hoverBorderColor: blue[400],
    activeShadow: '0 0 0 2px rgba(37, 99, 235, 0.1)',
    errorActiveShadow: '0 0 0 2px rgba(244, 63, 94, 0.06)',
    warningActiveShadow: '0 0 0 2px rgba(245, 158, 11, 0.1)',

    cellHoverBg: 'rgba(15, 23, 42, 0.04)',
    cellActiveWithRangeBg: blue[50],
    cellHoverWithRangeBg: blue[100],
    cellRangeBorderColor: blue[200],
    cellBgDisabled: 'rgba(15, 23, 42, 0.04)',

    multipleItemBg: 'rgba(15, 23, 42, 0.06)',
    multipleItemBorderColor: 'transparent',
    multipleItemColorDisabled: slate[300],
    multipleItemBorderColorDisabled: 'transparent',
    multipleItemHeight: 24,
    multipleItemHeightLG: 32,
    multipleItemHeightSM: 16,
    multipleSelectorBgDisabled: 'rgba(15, 23, 42, 0.04)',

    /* ---------- 箭头 ---------- */
    arrowPath:
      'path(M 0 8 A 4 4 0 0 0 2.82842712474619 6.82842712474619 L 6.585786437626905 3.0710678118654755 A 2 2 0 0 1 9.414213562373096 3.0710678118654755 L 13.17157287525381 6.82842712474619 A 4 4 0 0 0 16 8 Z)',
    arrowPolygon:
      'polygon(1.6568542494923806px 100%, 50% 1.6568542494923806px, 14.34314575050762px 100%, 1.6568542494923806px 100%)',
    arrowShadowWidth: 8.970562748477143,

    zIndexPopup: 1050,
  },

  /* ============================================================
   * Pagination
   * ============================================================ */
  Pagination: {
    itemSize: 32,
    itemSizeLG: 40,
    itemSizeSM: 24,
    miniOptionsSizeChangerTop: 0,

    itemBg: white,
    itemActiveBg: blue[600],
    itemActiveColor: white,
    itemActiveColorHover: blue[400],
    itemActiveBgDisabled: 'rgba(15, 23, 42, 0.15)',
    itemActiveColorDisabled: 'rgba(15, 23, 42, 0.25)',
    itemInputBg: white,
    itemLinkBg: white,
  },

  /* ============================================================
   * Steps
   * ============================================================ */
  Steps: {
    iconSize: 32,
    iconSizeSM: 24,
    iconFontSize: 14,
    iconTop: -0.5,
    customIconSize: 32,
    customIconFontSize: 24,
    customIconTop: 0,
    dotSize: 8,
    dotCurrentSize: 10,
    navArrowColor: slate[300],
    navContentMaxWidth: 'unset',
  },

  /* ============================================================
   * Tabs
   * ============================================================ */
  Tabs: {
    /* ---------- 尺寸 ---------- */
    cardGutter: 2,
    cardHeight: 40,
    cardHeightLG: 48,
    cardHeightSM: 32,
    cardPadding: '8px 16px',
    cardPaddingLG: '11px 16px',
    cardPaddingSM: '4px 8px',
    horizontalItemGutter: 32,
    horizontalItemMargin: '',
    horizontalItemMarginRTL: '',
    horizontalItemPadding: '12px 0',
    horizontalItemPaddingLG: '16px 0',
    horizontalItemPaddingSM: '8px 0',
    horizontalMargin: '0 0 16px 0',
    verticalItemMargin: '16px 0 0 0',
    verticalItemPadding: '8px 24px',
    titleFontSize: 14,
    titleFontSizeLG: 16,
    titleFontSizeSM: 14,

    /* ---------- 颜色 ---------- */
    cardBg: 'rgba(15, 23, 42, 0.02)',
    inkBarColor: blue[600],
    itemColor: slate[800],
    itemHoverColor: blue[500],
    itemActiveColor: blue[700],
    itemSelectedColor: blue[600],
    zIndexPopup: 1050,
  },

  /* ============================================================
   * Breadcrumb
   * ============================================================ */
  Breadcrumb: {
    iconFontSize: 14,
    itemColor: slate[400],
    lastItemColor: slate[800],
    linkColor: slate[500],
    linkHoverColor: slate[800],
    separatorColor: slate[400],
    separatorMargin: 8,
  },

  /* ============================================================
   * Dropdown
   * ============================================================ */
  Dropdown: {
    arrowOffsetHorizontal: 12,
    arrowOffsetVertical: 8,
    arrowPath:
      'path(M 0 8 A 4 4 0 0 0 2.82842712474619 6.82842712474619 L 6.585786437626905 3.0710678118654755 A 2 2 0 0 1 9.414213562373096 3.0710678118654755 L 13.17157287525381 6.82842712474619 A 4 4 0 0 0 16 8 Z)',
    arrowPolygon:
      'polygon(1.6568542494923806px 100%, 50% 1.6568542494923806px, 14.34314575050762px 100%, 1.6568542494923806px 100%)',
    arrowShadowWidth: 8.970562748477143,
    paddingBlock: 5,
    zIndexPopup: 1050,
  },

  /* ============================================================
   * Form
   * ============================================================ */
  Form: {
    inlineItemMarginBottom: 0,
    itemMarginBottom: 24,
    labelColonMarginInlineEnd: 8,
    labelColonMarginInlineStart: 2,
    labelColor: slate[800],
    labelFontSize: 14,
    labelHeight: 32,
    labelRequiredMarkColor: rose[500],
    verticalLabelHeight: 'auto',
    verticalLabelMargin: 0,
    verticalLabelPadding: '0 0 8px',
  },

  /* ============================================================
   * Divider
   * ============================================================ */
  Divider: {
    orientationMargin: 0.05,
    textPaddingInline: '1em',
    verticalMarginInline: 8,
  },

  /* ============================================================
   * Space
   * ============================================================ */
  Space: {
    addonPaddingBlock: '',
    addonPaddingInline: '',
  },

  /* ============================================================
   * Splitter
   * ============================================================ */
  Splitter: {
    splitBarDraggableSize: 20,
    splitBarSize: 2,
    splitTriggerSize: 6,
  },

  /* ============================================================
   * Anchor
   * ============================================================ */
  Anchor: {
    linkPaddingBlock: 4,
    linkPaddingInlineStart: 16,
  },

  /* ============================================================
   * Typography
   * ============================================================ */
  Typography: {
    titleMarginBottom: '0.5em',
    titleMarginTop: '1.2em',
  },
} as const;
