import { mergeAttributes, Node, VueNodeViewRenderer } from '@tiptap/vue-3'

import TodoNodeView from '../components/TodoNodeView.vue'

const TODO_TAG = 'div[data-w-e-type="todo"]'

function readChecked(element: HTMLElement): boolean {
  const input = element.querySelector<HTMLInputElement>('input[type="checkbox"]')
  return input ? input.hasAttribute('checked') : false
}

/**
 * 待办块
 *
 * wangEditor 的待办是块级快照 `<div data-w-e-type="todo">`，并非 tiptap 的
 * TaskList（`<ul data-type="taskList">`）。用自定义节点才能让存量数据解析后
 * 不降级、并能原样序列化回去。
 */
export const Todo = Node.create({
  name: 'todo',
  group: 'block',
  content: 'inline*',
  defining: true,

  addAttributes() {
    return {
      checked: {
        default: false,
        parseHTML: (element) => readChecked(element as HTMLElement),
        // 复选框由 renderHTML / NodeView 单独渲染，不作为根元素属性
        renderHTML: () => ({}),
      },
    }
  },

  parseHTML() {
    return [{ tag: TODO_TAG }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const checkbox: Record<string, string> = { type: 'checkbox', disabled: '' }
    if (node.attrs.checked) checkbox.checked = ''
    return ['div', mergeAttributes({ 'data-w-e-type': 'todo' }, HTMLAttributes), ['input', checkbox], ['span', 0]]
  },

  addKeyboardShortcuts() {
    return {
      // 待办内回车继续生成下一条待办，与 wangEditor 的手感一致
      Enter: () => {
        if (!this.editor.isActive(this.name)) return false
        return this.editor.chain().splitBlock().setNode(this.name).run()
      },
    }
  },

  addNodeView() {
    return VueNodeViewRenderer(TodoNodeView)
  },
})
