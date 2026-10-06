declare module 'watermark-plus' {
  export interface WatermarkOptions {
    content?: string
    image?: string
    tip?: string
    imageWidth?: string | number
    imageHeight?: string | number
    fontWeight?: string | number
    fontSize?: string | number
    fontFamily?: string
    color?: string
    alpha?: string | number
    width?: string | number
    height?: string | number
    maxWidth?: string | number
    maxHeight?: string | number
    rotate?: string | number
    zIndex?: string | number
    onSuccess?: () => void
    onWatermarkNull?: () => void
  }

  export default class Watermark {
    constructor(options?: Partial<WatermarkOptions>)
    create(): void
    destroy(): void
  }
}
