<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'

import { computed } from 'vue'

import type { MarkdownEditorToolbarKey } from '../types'

import { BACKGROUND_COLORS, FONT_FAMILIES, FONT_SIZES, HEADER_OPTIONS, LINE_HEIGHTS, TEXT_COLORS } from '../constants'
import ColorPanel from './ColorPanel.vue'
import LinkPanel from './LinkPanel.vue'
import TableGridPicker from './TableGridPicker.vue'
import ToolbarButton from './ToolbarButton.vue'
import ToolbarDropdown from './ToolbarDropdown.vue'
import ToolbarOptionPanel from './ToolbarOptionPanel.vue'

const props = defineProps<{
  editor?: Editor
  keys: MarkdownEditorToolbarKey[]
  disabled?: boolean
  fullScreen?: boolean
}>()

const emit = defineEmits<{
  uploadImage: []
  uploadVideo: []
  toggleFullScreen: []
}>()

const HEADING_LEVELS = [1, 2, 3, 4, 5] as const
type HeadingLevel = (typeof HEADING_LEVELS)[number]

/* ============================================================
 * 纯图标按钮
 * ============================================================ */

interface ToolbarAction {
  icon: string
  title: string
  active?: (editor: Editor) => boolean
  enabled?: (editor: Editor) => boolean
  run: (editor: Editor) => void
}

const ACTIONS: Partial<Record<MarkdownEditorToolbarKey, ToolbarAction>> = {
  bold: {
    icon: 'carbon:text-bold',
    title: '加粗',
    active: (editor) => editor.isActive('bold'),
    run: (editor) => editor.chain().focus().toggleBold().run(),
  },
  italic: {
    icon: 'carbon:text-italic',
    title: '斜体',
    active: (editor) => editor.isActive('italic'),
    run: (editor) => editor.chain().focus().toggleItalic().run(),
  },
  underline: {
    icon: 'carbon:text-underline',
    title: '下划线',
    active: (editor) => editor.isActive('underline'),
    run: (editor) => editor.chain().focus().toggleUnderline().run(),
  },
  through: {
    icon: 'carbon:text-strikethrough',
    title: '删除线',
    active: (editor) => editor.isActive('strike'),
    run: (editor) => editor.chain().focus().toggleStrike().run(),
  },
  bulletedList: {
    icon: 'carbon:list-bulleted',
    title: '无序列表',
    active: (editor) => editor.isActive('bulletList'),
    run: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  numberedList: {
    icon: 'carbon:list-numbered',
    title: '有序列表',
    active: (editor) => editor.isActive('orderedList'),
    run: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  todo: {
    icon: 'carbon:list-checked',
    title: '待办',
    active: (editor) => editor.isActive('todo'),
    run: (editor) => editor.chain().focus().toggleNode('todo', 'paragraph').run(),
  },
  justifyLeft: {
    icon: 'carbon:text-align-left',
    title: '左对齐',
    active: (editor) => editor.isActive({ textAlign: 'left' }),
    run: (editor) => editor.chain().focus().setTextAlign('left').run(),
  },
  justifyCenter: {
    icon: 'carbon:text-align-center',
    title: '居中对齐',
    active: (editor) => editor.isActive({ textAlign: 'center' }),
    run: (editor) => editor.chain().focus().setTextAlign('center').run(),
  },
  justifyRight: {
    icon: 'carbon:text-align-right',
    title: '右对齐',
    active: (editor) => editor.isActive({ textAlign: 'right' }),
    run: (editor) => editor.chain().focus().setTextAlign('right').run(),
  },
  codeBlock: {
    icon: 'carbon:code',
    title: '代码块',
    active: (editor) => editor.isActive('codeBlock'),
    run: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  undo: {
    icon: 'carbon:undo',
    title: '撤销',
    enabled: (editor) => editor.can().undo(),
    run: (editor) => editor.chain().focus().undo().run(),
  },
  redo: {
    icon: 'carbon:redo',
    title: '重做',
    enabled: (editor) => editor.can().redo(),
    run: (editor) => editor.chain().focus().redo().run(),
  },
}

interface ToolbarItem {
  key: MarkdownEditorToolbarKey
  action: ToolbarAction | null
  active: boolean
  disabled: boolean
}

const items = computed<ToolbarItem[]>(() =>
  props.keys.map((key) => {
    const action = ACTIONS[key]

    if (!action) {
      return { key, action: null, active: false, disabled: false }
    }

    const editor = props.editor
    return {
      key,
      action,
      active: editor ? (action.active?.(editor) ?? false) : false,
      disabled: Boolean(props.disabled || !editor || (action.enabled && !action.enabled(editor))),
    }
  }),
)

function runAction(action: ToolbarAction) {
  if (!props.editor) return
  action.run(props.editor)
}

/* ============================================================
 * 下拉项当前值
 * ============================================================ */

function readTextStyle(name: 'fontSize' | 'fontFamily' | 'color' | 'backgroundColor'): string {
  const editor = props.editor
  if (!editor) return ''
  return (editor.getAttributes('textStyle')[name] as string | undefined) ?? ''
}

const currentHeader = computed(() => {
  const editor = props.editor
  if (!editor) return 'paragraph'

  const level = HEADING_LEVELS.find((value) => editor.isActive('heading', { level: value }))
  return level ? String(level) : 'paragraph'
})

const currentHeaderLabel = computed(
  () => HEADER_OPTIONS.find((option) => option.value === currentHeader.value)?.label ?? '正文',
)

const currentFontSize = computed(() => readTextStyle('fontSize'))
const currentFontFamily = computed(() => readTextStyle('fontFamily'))
const currentColor = computed(() => readTextStyle('color'))
const currentBackgroundColor = computed(() => readTextStyle('backgroundColor'))

const fontSizeLabel = computed(
  () => FONT_SIZES.find((option) => option.value === currentFontSize.value)?.label ?? '默认字号',
)
const fontFamilyLabel = computed(
  () => FONT_FAMILIES.find((option) => option.value === currentFontFamily.value)?.label ?? '默认字体',
)

const currentLineHeight = computed(() => {
  const editor = props.editor
  if (!editor) return ''
  const attrs = editor.isActive('heading') ? editor.getAttributes('heading') : editor.getAttributes('paragraph')
  return (attrs.lineHeight as string | undefined) ?? ''
})

const linkActive = computed(() => props.editor?.isActive('link') ?? false)
const currentHref = computed(() => {
  const editor = props.editor
  if (!editor) return ''
  return (editor.getAttributes('link').href as string | undefined) ?? ''
})

/* ============================================================
 * 下拉项命令
 * ============================================================ */

function applyHeader(value: string) {
  const editor = props.editor
  if (!editor) return

  if (value === 'paragraph') {
    editor.chain().focus().setParagraph().run()
    return
  }
  editor
    .chain()
    .focus()
    .setHeading({ level: Number(value) as HeadingLevel })
    .run()
}

function applyFontSize(value: string) {
  const editor = props.editor
  if (!editor) return

  if (value) editor.chain().focus().setFontSize(value).run()
  else editor.chain().focus().unsetFontSize().run()
}

function applyFontFamily(value: string) {
  const editor = props.editor
  if (!editor) return

  if (value) editor.chain().focus().setFontFamily(value).run()
  else editor.chain().focus().unsetFontFamily().run()
}

function applyColor(value: string) {
  const editor = props.editor
  if (!editor) return

  if (value) editor.chain().focus().setColor(value).run()
  else editor.chain().focus().unsetColor().run()
}

function applyBackgroundColor(value: string) {
  const editor = props.editor
  if (!editor) return

  if (value) editor.chain().focus().setBackgroundColor(value).run()
  else editor.chain().focus().unsetBackgroundColor().run()
}

function applyLineHeight(value: string) {
  const editor = props.editor
  if (!editor) return

  const type = editor.isActive('heading') ? 'heading' : 'paragraph'
  editor
    .chain()
    .focus()
    .updateAttributes(type, { lineHeight: value || null })
    .run()
}

function applyLink(url: string) {
  const editor = props.editor
  if (!editor) return

  if (!url) {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }

  // 无选区时按 wangEditor 的行为，直接把地址作为链接文本插入
  if (editor.state.selection.empty) {
    editor
      .chain()
      .focus()
      .insertContent({ type: 'text', text: url, marks: [{ type: 'link', attrs: { href: url } }] })
      .run()
    return
  }

  editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
}

function insertTable(rows: number, cols: number) {
  props.editor?.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run()
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-0.5 px-2 py-1">
    <template v-for="(item, index) in items" :key="`${item.key}-${index}`">
      <span v-if="item.key === '|'" class="mx-1 h-4 w-px self-center bg-gray-200 dark:bg-gray-700" />

      <!-- 纯图标按钮 -->
      <ToolbarButton
        v-else-if="item.action"
        :icon="item.action.icon"
        :title="item.action.title"
        :active="item.active"
        :disabled="item.disabled"
        @click="runAction(item.action)"
      />

      <!-- 块级样式 -->
      <ToolbarDropdown
        v-else-if="item.key === 'headerSelect'"
        title="段落样式"
        :label="currentHeaderLabel"
        :disabled="disabled"
      >
        <ToolbarOptionPanel :options="HEADER_OPTIONS" :current="currentHeader" @select="applyHeader" />
      </ToolbarDropdown>

      <ToolbarDropdown v-else-if="item.key === 'fontSize'" title="字号" :label="fontSizeLabel" :disabled="disabled">
        <ToolbarOptionPanel
          :options="FONT_SIZES"
          :current="currentFontSize"
          preview="fontSize"
          @select="applyFontSize"
        />
      </ToolbarDropdown>

      <ToolbarDropdown v-else-if="item.key === 'fontFamily'" title="字体" :label="fontFamilyLabel" :disabled="disabled">
        <ToolbarOptionPanel
          :options="FONT_FAMILIES"
          :current="currentFontFamily"
          preview="fontFamily"
          @select="applyFontFamily"
        />
      </ToolbarDropdown>

      <ToolbarDropdown v-else-if="item.key === 'lineHeight'" title="行高" label="行高" :disabled="disabled">
        <ToolbarOptionPanel :options="LINE_HEIGHTS" :current="currentLineHeight" @select="applyLineHeight" />
      </ToolbarDropdown>

      <ToolbarDropdown
        v-else-if="item.key === 'color'"
        title="文字颜色"
        icon="carbon:text-color"
        :swatch="currentColor"
        :disabled="disabled"
      >
        <ColorPanel :colors="TEXT_COLORS" :current="currentColor" clearable @select="applyColor" />
      </ToolbarDropdown>

      <ToolbarDropdown
        v-else-if="item.key === 'bgColor'"
        title="背景颜色"
        icon="carbon:color-palette"
        :swatch="currentBackgroundColor"
        :disabled="disabled"
      >
        <ColorPanel
          :colors="BACKGROUND_COLORS"
          :current="currentBackgroundColor"
          clearable
          @select="applyBackgroundColor"
        />
      </ToolbarDropdown>

      <ToolbarDropdown
        v-else-if="item.key === 'insertLink'"
        title="插入链接"
        icon="carbon:link"
        :active="linkActive"
        :disabled="disabled"
      >
        <template #default="{ close }">
          <LinkPanel
            :initial-url="currentHref"
            @cancel="close"
            @confirm="
              (url) => {
                applyLink(url)
                close()
              }
            "
          />
        </template>
      </ToolbarDropdown>

      <ToolbarDropdown v-else-if="item.key === 'insertTable'" title="插入表格" icon="carbon:table" :disabled="disabled">
        <TableGridPicker @select="insertTable" />
      </ToolbarDropdown>

      <!-- 上传：真实文件与接口由父组件处理 -->
      <ToolbarButton
        v-else-if="item.key === 'uploadImage'"
        icon="carbon:image"
        title="上传图片"
        :disabled="disabled"
        @click="emit('uploadImage')"
      />

      <ToolbarButton
        v-else-if="item.key === 'uploadVideo'"
        icon="carbon:video"
        title="上传视频"
        :disabled="disabled"
        @click="emit('uploadVideo')"
      />

      <ToolbarButton
        v-else-if="item.key === 'fullScreen'"
        :icon="fullScreen ? 'carbon:minimize' : 'carbon:maximize'"
        :title="fullScreen ? '退出全屏' : '全屏'"
        :active="fullScreen"
        @click="emit('toggleFullScreen')"
      />
    </template>
  </div>
</template>
