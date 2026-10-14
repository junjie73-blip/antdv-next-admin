import { palette } from '../palette';

const { white, slate, rose } = palette;

/**
 * 🌙 Dark 主题 · 组件级 Token
 */
export const darkComponents = {
  /* ============================================================
   * Layout
   * ============================================================ */
  Layout: {
    bodyBg: slate[950],
    headerBg: slate[900],
    headerColor: slate[100],
    headerHeight: 64,
    headerPadding: '0 24px',
    footerBg: slate[900],
    footerPadding: '16px 24px',
    siderBg: slate[900],
    triggerBg: slate[800],
    triggerColor: slate[300],
    triggerHeight: 48,
    zeroTriggerWidth: 40,
    zeroTriggerHeight: 40,
    lightSiderBg: slate[900],
    lightTriggerBg: slate[800],
    lightTriggerColor: slate[300],
  },

  /* ============================================================
   * Menu
   *
   * 选中态一律交还给 antd：`itemSelectedColor: colorPrimary`、
   * `itemSelectedBg: controlItemBgActive`、`subMenuItemSelectedColor: colorPrimary`。
   * 这一组钉死成蓝，正是"换了主题色，父级菜单选中还是蓝的"的直接原因。
   * ============================================================ */
  Menu: {
    itemBg: 'transparent',
    itemColor: slate[300],
    itemHoverBg: slate[800],
    itemHoverColor: white,
    itemDisabledColor: slate[600],
    itemHeight: 40,
    itemBorderRadius: 8,
    itemMarginInline: 4,
    itemMarginBlock: 4,
    itemPaddingInline: 16,
    itemWidth: 'calc(100% - 8px)',
    subMenuItemBg: 'transparent',
    subMenuItemBorderRadius: 6,
    groupTitleColor: slate[500],
    groupTitleFontSize: 12,
    groupTitleLineHeight: 1.5,
    popupBg: slate[800],
    iconSize: 16,
    iconMarginInlineEnd: 10,
    collapsedIconSize: 16,
    collapsedWidth: 80,
    dropdownWidth: 160,
    zIndexPopup: 1050,

    activeBarBorderWidth: 1,
    activeBarWidth: 0,
    activeBarHeight: 2,

    horizontalItemHoverBg: 'transparent',
    horizontalItemSelectedBg: 'transparent',
    horizontalItemBorderRadius: 6,
    horizontalLineHeight: '46px',

    dangerItemColor: rose[400],
    dangerItemHoverColor: rose[300],
    dangerItemActiveBg: 'rgba(244, 63, 94, 0.15)',
    dangerItemSelectedBg: 'rgba(244, 63, 94, 0.15)',
    dangerItemSelectedColor: rose[400],

    /* 暗色菜单 */
    darkItemBg: slate[900],
    darkItemColor: slate[300],
    darkItemHoverBg: 'transparent',
    darkItemHoverColor: white,
    darkItemSelectedColor: white,
    darkItemDisabledColor: slate[600],
    darkPopupBg: slate[900],
    darkSubMenuItemBg: slate[950],
    darkGroupTitleColor: slate[500],
    darkDangerItemColor: rose[400],
    darkDangerItemHoverColor: rose[300],
    darkDangerItemActiveBg: 'rgba(244, 63, 94, 0.2)',
    darkDangerItemSelectedBg: rose[500],
    darkDangerItemSelectedColor: white,
  },

  /* ============================================================
   * Button
   * ============================================================ */
  Button: {
    contentFontSize: 14,
    contentFontSizeLG: 16,
    contentFontSizeSM: 14,
    fontWeight: 400,
    iconGap: 8,
    paddingInline: 15,
    paddingInlineLG: 15,
    paddingInlineSM: 7,

    defaultBg: slate[900],
    defaultColor: slate[100],
    defaultBorderColor: slate[700],
    /* hover / active 的字色与边框交还给 antd（取 colorPrimaryHover / colorPrimaryActive 一族） */
    defaultHoverBg: slate[800],
    defaultActiveBg: slate[800],
    defaultBgDisabled: 'rgba(255, 255, 255, 0.04)',
    dashedBgDisabled: 'rgba(255, 255, 255, 0.04)',
    defaultShadow: '0 2px 0 rgba(0, 0, 0, 0.2)',

    primaryColor: white,

    dangerColor: white,
    dangerShadow: '0 2px 0 rgba(244, 63, 94, 0.15)',
    solidTextColor: white,

    ghostBg: 'transparent',
    defaultGhostColor: white,
    defaultGhostBorderColor: white,

    textHoverBg: 'rgba(255, 255, 255, 0.08)',
    textTextColor: slate[100],
    textTextHoverColor: white,
    textTextActiveColor: white,
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

    activeBg: slate[800],
    hoverBg: slate[800],
    addonBg: 'rgba(255, 255, 255, 0.04)',

    /* 聚焦边框与光晕交还给 antd（colorPrimary / alpha(colorPrimary, .2)） */
    errorActiveShadow: '0 0 0 2px rgba(251, 113, 133, 0.15)',
    warningActiveShadow: '0 0 0 2px rgba(251, 191, 36, 0.15)',
  },

  /* ============================================================
   * Select
   * ============================================================ */
  Select: {
    optionHeight: 32,
    optionFontSize: 14,
    optionLineHeight: 1.5714285714285714,
    optionPadding: '5px 12px',
    menuPadding: 4,
    dropdownHeight: 180,
    controlItemWidth: 111,
    controlWidth: 184,

    selectorBg: slate[800],
    clearBg: slate[800],
    optionSelectedColor: slate[100],
    optionSelectedFontWeight: 600,
    optionActiveBg: 'rgba(255, 255, 255, 0.06)',

    multipleItemBg: 'rgba(255, 255, 255, 0.12)',
    multipleItemBorderColor: 'transparent',
    multipleItemColorDisabled: slate[600],
    multipleItemBorderColorDisabled: 'transparent',
    multipleItemHeight: 24,
    multipleItemHeightLG: 32,
    multipleItemHeightSM: 16,
    multipleSelectorBgDisabled: 'rgba(255, 255, 255, 0.04)',

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
    optionSelectedColor: slate[100],
    optionSelectedFontWeight: 600,
  },

  /* ============================================================
   * DatePicker
   * ============================================================ */
  DatePicker: {
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

    activeBg: slate[800],
    hoverBg: slate[800],
    addonBg: 'rgba(255, 255, 255, 0.04)',

    /* 聚焦边框与光晕交还给 antd（colorPrimary / alpha(colorPrimary, .2)） */
    errorActiveShadow: '0 0 0 2px rgba(251, 113, 133, 0.15)',
    warningActiveShadow: '0 0 0 2px rgba(251, 191, 36, 0.15)',

    /* 区间格的底色/悬浮色交还给 antd，它们取自主色系 */
    cellHoverBg: 'rgba(255, 255, 255, 0.06)',
    cellBgDisabled: 'rgba(255, 255, 255, 0.04)',

    multipleItemBg: 'rgba(255, 255, 255, 0.12)',
    multipleItemBorderColor: 'transparent',
    multipleItemColorDisabled: slate[600],
    multipleItemBorderColorDisabled: 'transparent',
    multipleItemHeight: 24,
    multipleItemHeightLG: 32,
    multipleItemHeightSM: 16,
    multipleSelectorBgDisabled: 'rgba(255, 255, 255, 0.04)',

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

    itemBg: slate[900],
    /* 当前页字色/底色/悬浮色交还给 antd（`itemActiveColor: colorPrimary` 那一套） */
    itemActiveBgDisabled: 'rgba(255, 255, 255, 0.15)',
    itemActiveColorDisabled: 'rgba(255, 255, 255, 0.25)',
    itemInputBg: slate[900],
    itemLinkBg: slate[900],
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
    navArrowColor: slate[600],
    navContentMaxWidth: 'unset',
  },

  /* ============================================================
   * Tabs
   * ============================================================ */
  Tabs: {
    cardGutter: 2,
    cardHeight: 40,
    cardHeightLG: 48,
    cardHeightSM: 32,
    cardPadding: '8px 16px',
    cardPaddingLG: '11px 16px',
    cardPaddingSM: '4px 8px',
    horizontalItemGutter: 32,
    horizontalItemPadding: '12px 0',
    horizontalItemPaddingLG: '16px 0',
    horizontalItemPaddingSM: '8px 0',
    horizontalMargin: '0 0 16px 0',
    verticalItemMargin: '16px 0 0 0',
    verticalItemPadding: '8px 24px',
    titleFontSize: 14,
    titleFontSizeLG: 16,
    titleFontSizeSM: 14,

    cardBg: 'rgba(255, 255, 255, 0.04)',
    /* 下划线与选中/悬浮/按下字色交还给 antd（colorPrimary 一族） */
    itemColor: slate[300],
    zIndexPopup: 1050,
  },

  /* ============================================================
   * Breadcrumb
   * ============================================================ */
  Breadcrumb: {
    iconFontSize: 14,
    itemColor: slate[500],
    lastItemColor: slate[100],
    linkColor: slate[400],
    linkHoverColor: slate[100],
    separatorColor: slate[500],
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
    labelColor: slate[200],
    labelFontSize: 14,
    labelHeight: 32,
    labelRequiredMarkColor: rose[400],
    verticalLabelHeight: 'auto',
    verticalLabelMargin: 0,
    verticalLabelPadding: '0 0 8px',
  },

  /* ============================================================
   * Divider / Space / Splitter / Anchor / Typography
   * ============================================================ */
  Divider: {
    orientationMargin: 0.05,
    textPaddingInline: '1em',
    verticalMarginInline: 8,
  },

  Space: {
    addonPaddingBlock: '',
    addonPaddingInline: '',
  },

  Splitter: {
    splitBarDraggableSize: 20,
    splitBarSize: 2,
    splitTriggerSize: 6,
  },

  Anchor: {
    linkPaddingBlock: 4,
    linkPaddingInlineStart: 16,
  },

  Typography: {
    titleMarginBottom: '0.5em',
    titleMarginTop: '1.2em',
  },
} as const;
