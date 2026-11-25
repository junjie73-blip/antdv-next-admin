<script setup lang="ts">
/**
 * Copilot 工作台：从「独立聊天框」升级为上下文感知的全局助手。
 *
 * - 全局入口：右下角悬浮按钮 + Cmd/Ctrl+K 命令面板
 * - 上下文：只读快照来自 route.meta.aiContext 与页面注册的表格句柄
 * - 交互：Generative UI（缩略表）+ 工具进度折叠 + HITL 确认卡片
 */
import type { AiContextSnapshot } from '@antdv/ai-tools';

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { usePrompt } from 'vue-llm';
import { useRoute, useRouter } from 'vue-router';

import { createAiTools } from '@antdv/ai-tools';
import {
  Button,
  ChatMessage,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Textarea,
} from '@antdv/shadcn-ui';
import { Icon } from '@iconify/vue';
import { uploadFile } from '~/api/system';
import FilePreviewDialog from '~/components/file-preview/FilePreviewDialog.vue';
import {
  metaOf,
  pageForm,
  pageTable,
  promptsOf,
  snapshotOf,
} from '~/composables/ai';

import ConfirmActionCard from './components/ConfirmActionCard.vue';
import ToolProgress from './components/ToolProgress.vue';
import { createCopilotProvider } from './provider';
import { useCopilotChat } from './use-copilot-chat';

defineOptions({ name: 'AiAssistant' });

const route = useRoute();
const router = useRouter();
const open = ref(false);
const commandOpen = ref(false);
const draft = ref('');

/** 附件：本地 File 直接给通用预览组件用，同时登记到 mock 文件库便于审计 */
interface Attachment {
  file: File;
  name: string;
  size: string;
  uploading: boolean;
}
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024;
const attachments = ref<Attachment[]>([]);
const previewTarget = ref<File | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

function readableSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fileTypeOf(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['bmp', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp'].includes(ext))
    return 'image';
  if (['mov', 'mp4', 'ogg', 'webm'].includes(ext)) return 'video';
  if (['flac', 'm4a', 'mp3', 'wav'].includes(ext)) return 'audio';
  if (['7z', 'gz', 'rar', 'tar', 'zip'].includes(ext)) return 'archive';
  if (
    [
      'csv',
      'doc',
      'docx',
      'md',
      'pdf',
      'ppt',
      'pptx',
      'txt',
      'xls',
      'xlsx',
    ].includes(ext)
  )
    return 'document';
  return 'other';
}

async function onFilesPicked(event: Event) {
  const input = event.target as HTMLInputElement;
  const picked = [...(input.files ?? [])];
  input.value = ''; // 同一文件可以重复选
  if (picked.length === 0) return;
  const room = MAX_ATTACHMENTS - attachments.value.length;
  if (room <= 0) {
    window.alert(`最多附加 ${MAX_ATTACHMENTS} 个文件`);
    return;
  }
  for (const file of picked.slice(0, room)) {
    if (file.size > MAX_ATTACHMENT_SIZE) {
      window.alert(`${file.name} 超过 20MB，未添加`);
      continue;
    }
    const item: Attachment = {
      file,
      name: file.name,
      size: readableSize(file.size),
      uploading: true,
    };
    attachments.value.push(item);
    try {
      await uploadFile({
        extension: file.name.split('.').pop()?.toLowerCase() ?? '',
        mimeType: file.type || 'application/octet-stream',
        name: file.name,
        path: '/copilot',
        size: file.size,
        type: fileTypeOf(file.name),
      });
      item.uploading = false;
    } catch {
      item.uploading = false;
      // 上传登记失败不阻塞本地预览与对话，附件仍可随消息发送
    }
  }
  if (picked.length > room)
    window.alert(`最多附加 ${MAX_ATTACHMENTS} 个文件，多余的已忽略`);
}

function removeAttachment(name: string) {
  attachments.value = attachments.value.filter((item) => item.name !== name);
}

const snapshot = ref<AiContextSnapshot>(snapshotOf(route));
watch(
  () => [route.name, route.path, route.query],
  () => {
    snapshot.value = snapshotOf(route);
  },
  { deep: true },
);

const meta = computed(() => metaOf(route));
const prompts = computed(() => promptsOf(route));

/** 响应式 System Prompt：切换路由 / 选中行即更新，不重建会话 */
const system = usePrompt(
  '你是 {{title}} 页面的 Copilot。当前实体：{{entity}}。页面状态：{{state}}。选中行：{{selection}}。不要编造未声明的字段或接口。',
  () => ({
    title: String(snapshot.value.title),
    entity: String(snapshot.value.entity ?? 'page'),
    state: JSON.stringify(snapshot.value.filters ?? {}),
    selection: JSON.stringify(snapshot.value.selectedRows ?? []),
  }),
);

const runtime = {
  context: () => snapshot.value,
  table: (target?: string) =>
    target ? pageTable(target) : pageTable(String(route.name ?? '')),
  form: (target?: string) =>
    target ? pageForm(target) : pageForm(String(route.name ?? '')),
  navigate: async (intent: {
    routeName: string;
    query?: Record<string, string>;
  }) => {
    await router.push({ name: intent.routeName as never, query: intent.query });
    return {
      ok: true,
      message: `已跳转到${intent.routeName}`,
      traceId: `nav_${Date.now()}`,
    };
  },
  audit: (event: unknown) => {
    // Control Plane 的 Trace 接口就绪后在这里上报；当前保留本地事件便于调试。
    window.dispatchEvent(
      new CustomEvent('copilot:tool-trace', { detail: event }),
    );
  },
};

const tools = createAiTools(runtime);
const chat = useCopilotChat({
  provider: createCopilotProvider(),
  system,
  tools: tools.all,
});

const generativeComponents = {
  confirm_action: ConfirmActionCard,
  search_table: ToolProgress,
  generate_form: ToolProgress,
  fill_form_fields: ToolProgress,
  navigate_to: ToolProgress,
};

function send(text?: string) {
  const base = (text ?? draft.value).trim();
  const names = attachments.value.map((item) => item.name);
  if (!base && names.length === 0) return;
  const content =
    names.length > 0
      ? `${base || '请分析这些文件'}\n[附件：${names.join('、')}]`
      : base;
  draft.value = '';
  attachments.value = [];
  void chat.sendMessage(content);
}

function onKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    commandOpen.value = true;
  }
  if (event.key === 'Escape') {
    open.value = false;
    commandOpen.value = false;
  }
}

function runCommand(text: string) {
  commandOpen.value = false;
  open.value = true;
  send(text);
}

const suggestions = computed(() => prompts.value);

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  chat.stop();
});
</script>

<template>
  <Button
    type="button"
    variant="default"
    size="icon"
    data-ai-assistant-trigger
    title="AI 助手（⌘K）"
    aria-label="打开 AI 助手"
    class="fixed right-4 bottom-4 z-30 size-11 rounded-full bg-primary text-primary-foreground shadow-lg transition-transform duration-200 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:right-5 sm:bottom-5"
    @click="open = !open"
  >
    <Icon :icon="open ? 'carbon:close' : 'carbon:chat'" class="text-xl" />
  </Button>

  <!-- 窄侧栏：不铺满屏幕；深色模式用低对比背景与细边框柔化 -->
  <Transition
    enter-active-class="transition-[transform,opacity] duration-200 ease-out"
    leave-active-class="transition-[transform,opacity] duration-150 ease-in"
    enter-from-class="translate-x-3 opacity-0"
    leave-to-class="translate-x-3 opacity-0"
  >
    <section
      v-if="open"
      data-copilot-panel
      class="fixed right-4 bottom-20 z-30 flex h-[min(620px,calc(100vh-7rem))] w-[min(392px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border/70 bg-background/95 shadow-2xl backdrop-blur-xl sm:right-5"
      aria-label="Copilot 工作台"
    >
      <header
        class="flex items-center gap-2 border-b border-border/70 px-3 py-2.5"
      >
        <span
          class="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary"
        >
          <Icon icon="carbon:magic-wand" class="size-4" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold leading-tight text-foreground">
            Copilot 工作台
          </p>
          <p class="truncate text-[10px] text-muted-foreground">
            {{ meta.title }} · {{ meta.entity }}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          class="h-7 px-2 text-xs"
          @click="commandOpen = true"
        >
          <Icon icon="carbon:terminal" class="size-3.5" />
          ⌘K
        </Button>
      </header>

      <!-- 上下文 Chip：明确告诉用户 AI 读取了左侧状态 -->
      <div
        class="flex flex-wrap items-center gap-1.5 border-b border-border/60 bg-muted/30 px-3 py-2"
      >
        <span
          class="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] text-primary"
        >
          <Icon icon="carbon:radio" class="size-3" />
          @{{ meta.title }}
        </span>
        <span
          class="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
        >
          <Icon icon="carbon:document" class="size-3" />
          读取当前页面数据
        </span>
        <span
          v-if="snapshot.selectedRows?.length"
          class="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
        >
          <Icon icon="carbon:checkmark-outline" class="size-3" />
          已选 {{ snapshot.selectedRows.length }} 行
        </span>
      </div>

      <div class="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        <div v-if="!chat.messages.value.length" class="space-y-3 pt-2">
          <div class="rounded-xl border border-border/70 bg-muted/40 px-3 py-3">
            <p class="text-sm font-medium text-foreground">
              我可以读取当前页面状态并代为操作
            </p>
            <p class="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              先选一条快捷指令，或直接描述你要做的事。AI
              可能出错，请核实关键信息。
            </p>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <Button
              v-for="prompt in suggestions"
              :key="prompt"
              variant="outline"
              size="sm"
              class="h-auto max-w-full whitespace-normal px-2.5 py-1.5 text-left text-[11px] leading-snug"
              @click="send(prompt)"
            >
              {{ prompt }}
            </Button>
          </div>
        </div>

        <ChatMessage
          v-for="message in chat.messages.value.filter(
            (m: { role: string }) => m.role !== 'system',
          )"
          :key="message.id"
          :message="message"
          :components="generativeComponents"
        />
      </div>

      <!-- 输入区紧贴内容区，缩短视觉断层 -->
      <div class="border-t border-border/60 bg-background/80 p-2.5">
        <div v-if="attachments.length" class="mb-2 flex flex-wrap gap-1.5">
          <span
            v-for="item in attachments"
            :key="item.name"
            class="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-1 text-[10px] text-muted-foreground"
          >
            <button
              type="button"
              class="max-w-36 truncate hover:underline"
              :title="item.name"
              @click="previewTarget = item.file"
            >
              {{ item.uploading ? '上传中… ' : '' }}{{ item.name }}（{{
                item.size
              }}）
            </button>
            <button
              type="button"
              class="text-muted-foreground hover:text-destructive"
              :aria-label="`移除 ${item.name}`"
              @click="removeAttachment(item.name)"
            >
              <Icon icon="carbon:close" class="size-3" />
            </button>
          </span>
        </div>
        <div
          class="relative rounded-xl border border-border bg-background shadow-sm focus-within:border-ring"
        >
          <input
            ref="fileInput"
            type="file"
            multiple
            class="hidden"
            accept=".md,.markdown,.csv,.xlsx,.docx,.pptx,.pdf,.png,.jpg,.jpeg,.gif,.webp,.svg,.mp4,.webm,.mp3,.wav"
            @change="onFilesPicked"
          />
          <button
            type="button"
            class="absolute bottom-1.5 left-1.5 z-10 flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="附加文件（可预览 Markdown / CSV / Excel / Word / PPT / 图片 / 音视频）"
            aria-label="附加文件"
            @click="fileInput?.click()"
          >
            <Icon icon="carbon:attachment" class="size-4" />
          </button>
          <Textarea
            v-model="draft"
            rows="2"
            placeholder="描述你的意图，如：总结当前页面数据"
            class="max-h-24 min-h-14 resize-none border-0 bg-transparent py-2.5 pr-3 pl-10 text-xs leading-relaxed shadow-none focus-visible:ring-0"
            @keydown.enter.exact.prevent="send()"
          />
          <Button
            size="sm"
            class="absolute right-2 bottom-2 size-7 rounded-lg px-0"
            :disabled="!draft.trim() || chat.isLoading.value"
            aria-label="发送"
            @click="send()"
          >
            <Icon icon="carbon:arrow-up" class="size-4" />
          </Button>
        </div>
        <p class="mt-1.5 text-center text-[10px] text-muted-foreground">
          AI 可能出错，请核实关键信息
        </p>
      </div>
    </section>
  </Transition>

  <FilePreviewDialog
    :open="Boolean(previewTarget)"
    :source="previewTarget"
    @update:open="previewTarget = null"
  />

  <CommandDialog
    v-model:open="commandOpen"
    title="Copilot 指令"
    description="输入自然语言或选择页面"
  >
    <CommandInput placeholder="输入指令，如：总结当前页面、帮我预填表单…" />
    <CommandList>
      <CommandEmpty>没有匹配的指令</CommandEmpty>
      <CommandGroup heading="快捷指令">
        <CommandItem
          v-for="prompt in [
            '这个页面能做什么？',
            '总结当前页面数据',
            '帮我检查异常数据',
          ]"
          :key="prompt"
          :value="prompt"
          @select="runCommand(prompt)"
        >
          <Icon icon="carbon:magic-wand" class="mr-2 size-4 text-primary" />
          {{ prompt }}
        </CommandItem>
      </CommandGroup>
    </CommandList>
  </CommandDialog>
</template>
