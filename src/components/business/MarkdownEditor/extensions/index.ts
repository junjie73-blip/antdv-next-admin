import type { Extensions } from '@tiptap/vue-3'

import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyleKit } from '@tiptap/extension-text-style'
import { Placeholder } from '@tiptap/extensions'
import StarterKit from '@tiptap/starter-kit'

import { BlockStyle } from './block-style'
import { EditorImage } from './image'
import { Todo } from './todo'
import { Video } from './video'

export interface EditorExtensionOptions {
  placeholder: string
}

/**
 * 组装 tiptap 扩展集合
 *
 * 选型说明：
 *  - link / underline / list / undoRedo 已内置在 StarterKit 中，不再重复注册
 *  - 行高用自研的 BlockStyle（块级），不使用内置 LineHeight（行内 textStyle）
 *  - 待办 / 视频为 wangEditor 私有格式，用自定义节点保证存量数据可解析
 */
export function createEditorExtensions(options: EditorExtensionOptions): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5] },
      // 链接在编辑态只落光标不跳转，与 wangEditor 一致
      link: {
        openOnClick: false,
        autolink: false,
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
      },
      // 不在文档尾部自动补空段落，避免凭空多出 <p></p>
      trailingNode: false,
      undoRedo: { depth: 200 },
    }),
    TextStyleKit.configure({ lineHeight: false }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    BlockStyle,
    Todo,
    Video,
    EditorImage,
    Placeholder.configure({ placeholder: options.placeholder }),
  ]
}
