<script setup lang="ts">
import type {
  MarkdownEditorInstance,
  MarkdownEditorMode,
} from '~/components/business/MarkdownEditor';

import { ref } from 'vue';

import { cn } from '@antdv/shared/cn';
import { Icon } from '@iconify/vue';
import { Scrollbar } from '@antdv/ui/scrollbar';
import { message } from 'antdv-next';

import { MarkdownEditor } from '~/components/business/MarkdownEditor';

/**
 * 富文本编辑器示例。
 *
 * 这一页原先直连 `@wangeditor/editor`，而依赖清单里**从来没有装过它**：
 * 页面被路由排除规则屏蔽期间没人编译过它，所以"缺依赖"这件事一直没暴露。
 * 排除规则修好（见 internal/vite-config/src/plugins/vue.ts）之后它才第一次参与编译，
 * 表现是导航进来永远停在"页面加载中..."。
 * 现在改用仓库内的 `MarkdownEditor` —— 它就是当初 wangEditor 的 tiptap 替代实现，
 * 工具栏按键名、待办/视频节点都按 wangEditor 的存量格式对齐过。
 */
defineOptions({ name: 'EditorRichText' });

const editorRef = ref<MarkdownEditorInstance | null>(null);
const mode = ref<MarkdownEditorMode>('edit');
const readonly = ref(false);
const changeCount = ref(0);

const containerClassName = cn('space-y-4');

const INITIAL_HTML = `<h1>富文本编辑器</h1><p>基于 <strong>tiptap</strong> 的所见即所得编辑器，支持标题、<em>斜体</em>、<u>下划线</u>、<s>删除线</s>、<code>行内代码</code>、高亮与列表。</p><ul><li>工具栏：正文 / 标题 1~5</li><li>对齐：左 / 中 / 右</li><li>插入：链接、图片、视频、表格、代码块、待办</li></ul><blockquote>引用块：适合放提示语。</blockquote><table><tbody><tr><th>能力</th><th>说明</th></tr><tr><td>双向绑定</td><td>v-model:value 直接给 HTML</td></tr><tr><td>实例方法</td><td>setHtml / insertText / getMarkdown …</td></tr></tbody></table>`;

/**
 * 初值走 `value` 的**初始值**而不是挂载后 `setHtml()`。
 *
 * 两种写法看着等价，实际不等：`created` 事件抛出时组件的实例方法还拿不到编辑器，
 * 而挂载后立刻写 `html` 又落在编辑器自己的 200ms 回声屏蔽期里 ——
 * 表现是"示例页打开是空白的"。初值直接给 prop 才是这条链路的正解。
 */
const html = ref(INITIAL_HTML);

function handleClear() {
  editorRef.value?.clear();
  message.success('已清空内容');
}

function handleInsertText() {
  editorRef.value?.insertText('（在光标处插入的文本）');
}

function handleInsertHtml() {
  editorRef.value?.insertHtml(
    '<p style="color:#0ea5e9">插入的一段带样式内容</p>',
  );
}

function handleUndo() {
  editorRef.value?.undo();
}

function handleRedo() {
  editorRef.value?.redo();
}

function handleFocus() {
  editorRef.value?.focus();
}

function handleChange() {
  changeCount.value += 1;
}

function handleLogMarkdown() {
  const md = editorRef.value?.getMarkdown() ?? '';
  message.info(`已生成 Markdown 源码，共 ${md.length} 字符`);
  console.log('[rich-text demo] markdown:\n', md);
}
</script>

<template>
  <div :class="containerClassName">
    <a-card size="small" title="编辑器配置">
      <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-500 dark:text-gray-400">模式</span>
          <a-segmented
            v-model:value="mode"
            :options="[
              { label: '编辑', value: 'edit' },
              { label: '分屏', value: 'split' },
              { label: '预览', value: 'preview' },
            ]"
          />
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-500 dark:text-gray-400">只读</span>
          <a-switch v-model:checked="readonly" size="small" />
        </div>
        <a-divider type="vertical" class="!h-5" />
        <a-space wrap :size="8">
          <a-button size="small" @click="handleInsertText">
            <template #icon><Icon icon="carbon:zoom-in" /></template>
            插入文本
          </a-button>
          <a-button size="small" @click="handleInsertHtml">
            <template #icon><Icon icon="carbon:code" /></template>
            插入 HTML
          </a-button>
          <a-button size="small" @click="handleUndo">
            <template #icon><Icon icon="carbon:undo" /></template>
            撤销
          </a-button>
          <a-button size="small" @click="handleRedo">
            <template #icon><Icon icon="carbon:redo" /></template>
            重做
          </a-button>
          <a-button size="small" @click="handleFocus">
            <template #icon><Icon icon="carbon:cursor-1" /></template>
            聚焦
          </a-button>
          <a-button size="small" @click="handleLogMarkdown">
            <template #icon><Icon icon="carbon:string-text" /></template>
            导出 Markdown
          </a-button>
          <a-button danger size="small" @click="handleClear">
            <template #icon><Icon icon="carbon:trash-can" /></template>
            清空
          </a-button>
        </a-space>
        <div class="ml-auto flex items-center gap-2 text-xs text-gray-500">
          <a-tag color="blue">change × {{ changeCount }}</a-tag>
        </div>
      </div>
    </a-card>

    <a-card :class="cn('shadow-sm')" :styles="{ body: { padding: '0' } }">
      <MarkdownEditor
        ref="editorRef"
        v-model:value="html"
        :mode="mode"
        :readonly="readonly"
        :height="420"
        placeholder="请输入内容..."
        @change="handleChange"
      />
    </a-card>

    <a-card size="small" title="v-model:value 产出的 HTML">
      <Scrollbar max-height="180px">
        <pre
          class="overflow-wrap-anywhere whitespace-pre-wrap px-1 font-mono text-xs text-gray-600 dark:text-gray-300"
        >{{ html }}</pre>
      </Scrollbar>
    </a-card>
  </div>
</template>

<style scoped>
.overflow-wrap-anywhere {
  overflow-wrap: anywhere;
}
</style>
