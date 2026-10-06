declare module 'watermark-plus' {
  export interface WatermarkOptions {
    content?: string;
    image?: string;
    tip?: string;
    imageWidth?: number | string;
    imageHeight?: number | string;
    fontWeight?: number | string;
    fontSize?: number | string;
    fontFamily?: string;
    color?: string;
    alpha?: number | string;
    width?: number | string;
    height?: number | string;
    maxWidth?: number | string;
    maxHeight?: number | string;
    rotate?: number | string;
    zIndex?: number | string;
    onSuccess?: () => void;
    onWatermarkNull?: () => void;
  }

  export default class Watermark {
    constructor(options?: Partial<WatermarkOptions>);
    create(): void;
    destroy(): void;
  }
}
