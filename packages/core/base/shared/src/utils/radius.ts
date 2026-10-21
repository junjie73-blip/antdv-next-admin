import { REM_BASE_PX } from '../constants/theme';

/**
 * px → rem 的圆角换算。
 *
 * 全站圆角只认 rem 一种单位（`--radius`、偏好写侧、ConfigProvider 的
 * `theme.radius` 都从这里出口），写侧收敛成一处是必须的：px 与 rem 混写时
 * 根字号一缩放就会出现"卡片圆角跟着变、按钮没变"的两套尺度，而这种分裂不报错。
 *
 * 数值按 4 位小数取整（0.25rem 这类档位是精确值），入参已是 rem 的字符串原样返回，
 * 便于 `var(--radius)` 这种"跟随全局"的写法直接透传。
 */
export function radiusToRem(radius: number | string): string {
  if (typeof radius === 'string') return radius;
  const rem = Math.round((radius / REM_BASE_PX) * 10_000) / 10_000;
  return `${rem}rem`;
}
