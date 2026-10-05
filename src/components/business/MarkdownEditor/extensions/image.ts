import { Image } from '@tiptap/extension-image'

const LENGTH_RE = /^(\d+(?:\.\d+)?)(px)?$/

/** wangEditor 把尺寸写成 `style="width: 100px;height: 50px"`，统一归一化成 px */
function normalizeLength(value: string | null | undefined): string | null {
  if (!value) return null
  const matched = LENGTH_RE.exec(value.trim())
  return matched ? `${matched[1]}px` : null
}

function readLength(element: HTMLElement, prop: 'width' | 'height'): string | null {
  return normalizeLength(element.style[prop]) ?? normalizeLength(element.getAttribute(prop))
}

/**
 * 图片
 *
 * wangEditor 的图片是行内 `<img>`、尺寸写在 style 上，并额外带 `data-href`。
 * 保持同样的行内语义与序列化格式，避免存量内容回填后结构错乱。
 */
export const EditorImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => readLength(element as HTMLElement, 'width'),
        renderHTML: (attributes) => (attributes.width ? { style: `width: ${attributes.width}` } : {}),
      },
      height: {
        default: null,
        parseHTML: (element) => readLength(element as HTMLElement, 'height'),
        renderHTML: (attributes) => (attributes.height ? { style: `height: ${attributes.height}` } : {}),
      },
      dataHref: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-href'),
        renderHTML: (attributes) => (attributes.dataHref ? { 'data-href': attributes.dataHref } : {}),
      },
    }
  },
}).configure({
  inline: true,
  allowBase64: true,
  resize: false,
})
