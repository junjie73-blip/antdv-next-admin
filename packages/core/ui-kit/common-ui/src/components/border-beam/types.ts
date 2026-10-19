import type { CSSProperties } from 'vue';

export interface BorderBeamProps {
  /** 光带粗细，数字按 px 处理 */
  borderWidth?: number;
  class?: string;
  /** 光带头部颜色，接受任意 CSS 颜色（含 `var(...)`） */
  color?: string;
  /** 出发前的延迟，单位秒 */
  delay?: number;
  /** 绕容器一圈的时长，单位秒 */
  duration?: number;
  /** 圆角：数字按 px，字符串原样写入 CSS（默认跟随全局 `--app-border-radius`） */
  radius?: number | string;
  /** 光带长度，占一圈角度的百分比 */
  size?: number;
  style?: CSSProperties;
  /** 光带尾部颜色：默认透明，于是头部从背景里淡出来 */
  tailColor?: string;
}
