import type { Rgb } from '../color/convert';

/**
 * 主题默认值：主色。
 *
 * antd 亮色主题的默认主色，也是所有"脏值兜底"的落点——偏好面板的
 * `<input type="color">` 解析失败、色值换算遇到无法识别的字符串时都退回它。
 */
export const DEFAULT_PRIMARY_COLOR = '#1677ff';
export const DEFAULT_PRIMARY_RGB: Rgb = { b: 255, g: 119, r: 22 };

/** 圆角倍率的基准：偏好里存 0~1 的倍率，`--radius-lg` 档按 16px 换算成 px */
export const BORDER_RADIUS_BASE = 16;

/**
 * 正文的像素值：偏好里 `fontSize`（默认 14）指的是"正文要多大"，不是根字号。
 * 正文用的是 `text-sm` = 0.875rem，所以 14px 正文对应根字号 16px = 100%，
 * 偏好写侧按这个基准把 px 折算成百分比（见 @antdv/preferences）。
 */
export const BASE_FONT_SIZE = 14;
