import { mergeAttributes, Node } from '@tiptap/vue-3'

const VIDEO_TAG = 'div[data-w-e-type="video"]'

function readVideo(element: HTMLElement): HTMLVideoElement | null {
  return element.tagName === 'VIDEO' ? (element as HTMLVideoElement) : element.querySelector('video')
}

function readAttr(element: HTMLElement, name: string): string | null {
  return readVideo(element)?.getAttribute(name) ?? null
}

/**
 * 视频块
 *
 * 对齐 wangEditor 的 `<div data-w-e-type="video">` 快照结构，
 * 同时兼容外部直接粘贴的裸 `<video src>`。
 */
export const Video = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (element) => {
          const video = readVideo(element as HTMLElement)
          if (!video) return null
          return video.getAttribute('src') ?? video.querySelector('source')?.getAttribute('src') ?? null
        },
      },
      poster: { default: null, parseHTML: (element) => readAttr(element as HTMLElement, 'poster') },
      width: { default: null, parseHTML: (element) => readAttr(element as HTMLElement, 'width') },
      height: { default: null, parseHTML: (element) => readAttr(element as HTMLElement, 'height') },
    }
  },

  parseHTML() {
    return [{ tag: VIDEO_TAG }, { tag: 'video' }]
  },

  renderHTML({ HTMLAttributes }) {
    const { src, poster, width, height, ...rest } = HTMLAttributes

    // 与 wangEditor 一致：地址放在 <source> 上，video 只承载展示属性
    return [
      'div',
      mergeAttributes({ 'data-w-e-type': 'video', 'data-w-e-is-void': '' }, rest),
      ['video', { controls: 'true', poster, width, height }, ['source', { src, type: 'video/mp4' }]],
    ]
  },
})
