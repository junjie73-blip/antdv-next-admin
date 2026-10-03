import { Node, mergeAttributes } from '@tiptap/core'

export interface VariableNodeOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    variable: {
      insertVariable: (name: string) => ReturnType
    }
  }
}

/**
 * 变量节点（atom，不可直接编辑）
 * - 显示：圆角 chip
 * - 序列化：<span data-variable="userName">${userName}</span>
 *   保证后端 ${var} 正则替换继续有效
 */
export const VariableNode = Node.create<VariableNodeOptions>({
  name: 'variable',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addOptions() {
    return { HTMLAttributes: {} }
  },

  addAttributes() {
    return {
      name: { default: '' },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-variable]',
        getAttrs: (el) => ({
          name: (el as HTMLElement).getAttribute('data-variable') ?? '',
        }),
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    const name = node.attrs.name as string
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-variable': name,
        class: 'tt-variable-chip',
      }),
      `\${${name}}`,
    ]
  },

  renderText({ node }) {
    return `\${${node.attrs.name}}`
  },

  addCommands() {
    return {
      insertVariable:
        (name: string) =>
        ({ commands }) => {
          if (!name) return false
          return commands.insertContent({
            type: this.name,
            attrs: { name },
          })
        },
    }
  },
})
