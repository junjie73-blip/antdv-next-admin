import { Extension } from '@tiptap/vue-3'

/**
 * 块级行高
 *
 * wangEditor 的行高写在块元素上（`<p style="line-height: 1.5">`），
 * 而 tiptap 自带的 LineHeight 是行内 textStyle 标记（`<span>`），
 * 两者序列化结果不同，因此这里改用全局属性保持块级语义。
 */
export const BlockStyle = Extension.create({
  name: 'blockStyle',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element) => element.style.lineHeight || null,
            renderHTML: (attributes) =>
              attributes.lineHeight ? { style: `line-height: ${attributes.lineHeight}` } : {},
          },
        },
      },
    ]
  },
})
