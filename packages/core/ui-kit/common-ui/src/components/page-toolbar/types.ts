export interface PageToolbarProps {
  /**
   * 窄屏时操作区是否独占一行（右对齐）而不是和筛选挤在同一行。
   *
   * 默认 `true`：筛选控件本来就会换行，操作区继续钉在右侧会被顶出可视区。
   */
  stackOnNarrow?: boolean;
}

export interface ToolbarFieldProps {
  /** 控件前的小标签（如「关键词」「状态」）；不传就只剩控件本身，用于纯输入框占位 */
  label?: string;
}
