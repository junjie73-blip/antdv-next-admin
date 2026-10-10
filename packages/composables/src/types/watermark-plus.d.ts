/**
 * watermark-plus 1.6.1 不带任何 .d.ts（package.json 里没有 types 字段），
 * 直接 import 会在 noImplicitAny 下报 TS7016。
 *
 * 这里只声明本项目真正用到的那一小块 API，而不是把整个库的 option 抄一遍：
 * 库以后扩了字段不影响我们，我们也不会误以为它支持没实现的能力。
 * 包内部用这份声明拿类型，对外导出的都是本地类型，
 * 于是 dist 的 .d.ts 不会把 `watermark-plus` 这个无类型模块泄漏给调用方。
 */
declare module 'watermark-plus' {
  export interface WatermarkStyleOptions {
    alpha?: number;
    color?: string;
    fontFamily?: string;
    fontSize?: number | string;
    fontWeight?: number | string;
    height?: number;
    rotate?: number;
    width?: number;
    [key: string]: unknown;
  }

  export default class Watermark {
    constructor(options: WatermarkStyleOptions);
    create(): void;
    destroy(): void;
  }
}
