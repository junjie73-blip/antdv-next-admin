<script setup lang="ts">
import { computed } from 'vue';

/**
 * 轻量 Markdown 渲染：不引入第三方依赖，覆盖 AI 回复里最常见的写法
 * （围栏代码块、行内代码、加粗、无序列表、换行）。全部先转义再排版，
 * 避免把模型返回的 HTML 当成标记执行。
 */
const props = withDefaults(defineProps<{ content?: string }>(), {
  content: '',
});

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function inline(text: string): string {
  return text
    .replaceAll(/`([^`]+)`/g, '<code class="ai-chat-code-inline">$1</code>')
    .replaceAll(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

const html = computed(() => {
  const blocks = (props.content ?? '').split('```');
  let out = '';
  blocks.forEach((block, index) => {
    if (index % 2 === 1) {
      const firstNewline = block.indexOf('\n');
      const code = firstNewline !== -1 ? block.slice(firstNewline + 1) : block;
      out += `<pre class="ai-chat-pre"><code>${escapeHtml(code.trim())}</code></pre>`;
      return;
    }
    for (const line of escapeHtml(block).split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        out += `<li>${inline(trimmed.slice(2))}</li>`;
      } else if (trimmed) {
        out += `<p>${inline(line)}</p>`;
      }
    }
  });
  return out;
});
</script>

<template>
  <div
    class="ai-chat-markdown text-sm leading-relaxed break-words"
    v-html="html"
  ></div>
</template>

<style scoped>
.ai-chat-markdown :deep(p) {
  margin: 0 0 0.5rem;
}
.ai-chat-markdown :deep(p:last-child) {
  margin-bottom: 0;
}
.ai-chat-markdown :deep(li) {
  margin: 0.15rem 0 0.15rem 1.1rem;
  list-style: disc;
}
.ai-chat-markdown :deep(.ai-chat-pre) {
  margin: 0.5rem 0;
  overflow-x: auto;
  border-radius: 0.5rem;
  background: hsl(var(--muted));
  padding: 0.6rem 0.8rem;
  font-size: 0.8rem;
}
.ai-chat-markdown :deep(.ai-chat-code-inline) {
  border-radius: 0.25rem;
  background: hsl(var(--muted));
  padding: 0.05rem 0.3rem;
  font-size: 0.85em;
}
</style>
