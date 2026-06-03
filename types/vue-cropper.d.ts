declare module 'vue-cropper' {
  import type { DefineComponent } from 'vue'

  interface VueCropperProps {
    img: string | Blob | File | null
    outputSize?: number
    outputType?: string
    info?: boolean
    canScale?: boolean
    autoCrop?: boolean
    autoCropWidth?: number | string
    autoCropHeight?: number | string
    fixed?: boolean
    fixedNumber?: [number, number]
    fixedBox?: boolean
    full?: boolean
    canMove?: boolean
    canMoveBox?: boolean
    original?: boolean
    centerBox?: boolean
    high?: boolean
    infoTrue?: boolean
    maxImgSize?: number | string
    enlarge?: number | string
    preW?: number | string
    mode?: string
    limitMinSize?: number | [number, number] | string
    fillColor?: string
  }

  interface VueCropperMethods {
    startCrop(): void
    stopCrop(): void
    clearCrop(): void
    refresh(): void
    rotateLeft(): void
    rotateRight(): void
    rotateClear(): void
    changeScale(num: number): void
    getCropData(cb: (data: string) => void): void
    getCropBlob(cb: (blob: Blob) => void): void
    getImgAxis(): { x1: number; x2: number; y1: number; y2: number }
    getCropAxis(): { x1: number; x2: number; y1: number; y2: number }
    changeCrop(w: number, h: number): void
    goAutoCrop(cw?: number, ch?: number): void
  }

  export const VueCropper: DefineComponent<VueCropperProps, VueCropperMethods>
}