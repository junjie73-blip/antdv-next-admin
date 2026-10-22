export interface PageHeaderProps {
  /** 标题下一行的说明文字；空串则整行不渲染 */
  description?: string;
  /** iconify 图标名。给了就渲染一枚主色徽标底，没有就纯文字标题 */
  icon?: string;
  /** 页面标题。也可以用 `#title` 插槽覆盖（要塞徽标、计数这类行内元素时） */
  title?: string;
}
