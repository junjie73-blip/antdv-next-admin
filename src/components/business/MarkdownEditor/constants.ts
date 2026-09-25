import type { MarkdownEditorToolbarKey } from './types'

/* ============================================================
 * 工具栏按键
 * ============================================================ */

/** 默认按键顺序，与迁移前 wangEditor 的 toolbarKeys 完全一致 */
export const DEFAULT_TOOLBAR_KEYS: MarkdownEditorToolbarKey[] = [
  'headerSelect',
  '|',
  'bold',
  'italic',
  'underline',
  'through',
  'color',
  'bgColor',
  '|',
  'fontSize',
  'fontFamily',
  'lineHeight',
  '|',
  'bulletedList',
  'numberedList',
  'todo',
  'justifyLeft',
  'justifyCenter',
  'justifyRight',
  '|',
  'insertLink',
  'uploadImage',
  'uploadVideo',
  'insertTable',
  'codeBlock',
  '|',
  'undo',
  'redo',
  '|',
  'fullScreen',
]

/* ============================================================
 * 下拉选项
 * ============================================================ */

export interface ToolbarOption {
  label: string
  value: string
}

/** 块级样式：正文 + 标题 1~5（与 wangEditor headerSelect 一致） */
export const HEADER_OPTIONS: ToolbarOption[] = [
  { label: '正文', value: 'paragraph' },
  { label: '标题 1', value: '1' },
  { label: '标题 2', value: '2' },
  { label: '标题 3', value: '3' },
  { label: '标题 4', value: '4' },
  { label: '标题 5', value: '5' },
]

export const FONT_FAMILIES: ToolbarOption[] = [
  { label: '默认字体', value: '' },
  { label: '宋体', value: 'SimSun' },
  { label: '黑体', value: 'SimHei' },
  { label: '楷体', value: 'KaiTi' },
  { label: '微软雅黑', value: 'Microsoft YaHei' },
  { label: 'Arial', value: 'Arial' },
  { label: 'Tahoma', value: 'Tahoma' },
  { label: 'Verdana', value: 'Verdana' },
]

export const FONT_SIZES: ToolbarOption[] = [
  { label: '默认字号', value: '' },
  ...['12px', '13px', '14px', '15px', '16px', '18px', '20px', '24px', '28px', '32px', '36px'].map((size) => ({
    label: size,
    value: size,
  })),
]

/** wangEditor 只在行高属于该白名单时才解析，保持一致避免格式错乱 */
export const LINE_HEIGHTS: ToolbarOption[] = [
  { label: '默认行高', value: '' },
  ...['1', '1.15', '1.5', '2', '2.5', '3'].map((value) => ({ label: value, value })),
]

const COLOR_PALETTE = [
  '#000000',
  '#262626',
  '#595959',
  '#8c8c8c',
  '#bfbfbf',
  '#d9d9d9',
  '#f5f5f5',
  '#ffffff',
  '#f5222d',
  '#fa541c',
  '#fa8c16',
  '#faad14',
  '#fadb14',
  '#a0d911',
  '#52c41a',
  '#13c2c2',
  '#1677ff',
  '#2f54eb',
  '#722ed1',
  '#eb2f96',
]

export const TEXT_COLORS: string[] = COLOR_PALETTE

export const BACKGROUND_COLORS: string[] = COLOR_PALETTE
