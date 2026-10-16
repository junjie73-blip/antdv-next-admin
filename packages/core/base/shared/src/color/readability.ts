import { TinyColor } from './convert';

/**
 * 明暗判定用的是 WCAG 相对亮度（阈值 0.179），不是"人眼看着暗不暗"。
 * 主题侧需要的是可复算的判定：同一个主色在浅底上要配白字还是黑字，只有这个口径给得出稳定答案。
 */
export function isDarkColor(color: string): boolean {
  return new TinyColor(color).isDark();
}

export function isLightColor(color: string): boolean {
  return new TinyColor(color).isLight();
}
