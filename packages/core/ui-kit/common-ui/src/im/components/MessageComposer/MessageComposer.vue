<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

import type { AttachmentCheck, AttachmentInput } from '../../core/attachment';
import type { ImLimits } from '../../core/limits';
import type { MentionMember, MentionTriggerState } from '../../core/mention';
import type { Attachment } from '../../core/types';

import { computed, ref } from 'vue';

import { IconifyIcon } from '@antdv/icons';
import {
  AttachmentAction,
  AttachmentActions,
  Attachment as AttachmentCard,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
  Button,
  Textarea,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

import { getImRuntime } from '../../config';
import {
  formatFileSize,
  resolvePreviewUrl,
  validateAttachments,
} from '../../core/attachment';
import { withLimits } from '../../core/limits';
import {
  applyMention,
  detectMentionTrigger,
  extractMentions,
} from '../../core/mention';

/**
 * 输入区：草稿、@ 触发、附件准入、发送前拦截。
 *
 * 分层位置：`components/`，展示 + 回抛。它不认识 store，也不认识 transport ——
 * `send` 事件把「文本 + 附件 + mentions」交给上层，由 `useIm.sendMessage` 落乐观消息。
 * 这条边界让同一个输入区能配任何数据源，也让单测不必起一套 store。
 *
 * 四条口径写在这里并被测试钉住：
 * 1. **输入法组合中不许发送**：中文用户按 Enter 是在确认候选词，不是在发消息。
 *    只看 `event.isComposing` 不够（Safari 在 compositionend 之后还会补一个 keydown），
 *    所以自己记 `compositionstart/end` 的状态，两个条件取或；
 * 2. **超限不发送**：计数变红、按钮禁用、原因就地显示。
 *    发出去再被服务端拒，用户看到的是"消息凭空消失"；
 * 3. **附件准入在本地**：体积与白名单按 `limits` 判，被拒的原地列出原因，
 *    上传成功失败由宿主决定（本包不碰网络）；
 * 4. **typing 上行节流**：`useIm.typing()` 自己也节流，两层都节流是刻意的 ——
 *    宿主可能直接绑 textarea 而不经过 composable，界面层这层是兜底。
 *
 * 这一层不做什么：不弹提示、不上传、不做表情面板（宿主通过 `emoji` 插槽接）、
 * 也不保存草稿（草稿归上层按会话分桶，见 `ImPanel`）。
 */
const props = withDefaults(
  defineProps<{
    /** 当前是否有可选会话：没有时禁用发送并给出原因，而不是让用户点了没反应 */
    active?: boolean;
    class?: HTMLAttributes['class'];
    /**
     * 预览地址生成器：默认取 `configureIm({ createObjectUrl })` 注入的那个。
     * 本包不自己调 `URL.createObjectURL` —— blob URL 的 `revokeObjectURL` 时机只有握住 File 的宿主知道，
     * 见 `core/attachment.ts` 的 `resolvePreviewUrl`。
     */
    createObjectUrl?: (source: unknown) => string;
    disabled?: boolean;
    /** Enter 是否直接发送；关掉后走 Ctrl+Enter（客服场景常见，误发代价高） */
    enterToSend?: boolean;
    limits?: Partial<ImLimits>;
    /** 成员表：给了才有 @ 高亮与 mentions */
    members?: MentionMember[];
    placeholder?: string;
    /** 输入即通知"正在输入"；关掉后上层自己决定何时通知 */
    throttleTyping?: boolean;
  }>(),
  {
    active: true,
    class: undefined,
    createObjectUrl: undefined,
    disabled: false,
    enterToSend: true,
    limits: undefined,
    members: undefined,
    placeholder: '输入消息，Enter 发送，Shift+Enter 换行',
    throttleTyping: true,
  },
);

const emit = defineEmits<{
  (
    event: 'send',
    payload: { attachments: Attachment[]; mentions: string[]; text: string },
  ): void;
  (event: 'typing'): void;
}>();

/** 草稿：外部用 v-model 接管，切换会话时由上层按会话分桶回填 */
const text = defineModel<string>({ default: '' });

/**
 * 限额的优先级：props > `configureIm({ limits })` > 出厂值。
 *
 * 运行时那一档必须参与：宿主在入口配 `maxMessageLength` 是"全站口径"，
 * 而 props 只是"这一块面板临时不一样"。少了前者就会出现"宿主改了配置、输入区还在按 2000 字放行"
 * —— 状态机那边已经按新口径拦了，界面却给不出原因，是最难复现的那类不一致。
 */
const resolved = computed(() =>
  withLimits({ ...getImRuntime().limits, ...props.limits }),
);

const root = ref<HTMLElement>();
const fileInput = ref<HTMLInputElement>();
/** 待发送附件：校验结果与原始 `source` 都留在这儿，预览地址到渲染时才生成 */
const staged = ref<AttachmentCheck[]>([]);
const composing = ref(false);
/** 上一次被本地拦下的原因：就地显示而不是抛出去，避免"点了没反应" */
const blocked = ref<string | undefined>();
/** @ 触发态：null 表示不在 @ 输入中，选择面板随之收起 */
const mention = ref<MentionTriggerState | null>(null);

let lastTypingAt = 0;
/** 时钟可注入是测试口径：节流窗口用假时钟跨，不靠 vi 计时器 */
let clock: () => number = () => Date.now();
function setNow(next?: () => number): void {
  if (next !== undefined) clock = next;
}

const accepted = computed(() => staged.value.filter((item) => item.ok));
const rejected = computed(() => staged.value.filter((item) => !item.ok));

const length = computed(() => text.value.length);
const overLength = computed(
  () => length.value > resolved.value.maxMessageLength,
);

/**
 * 可发送的判定：有会话、没被禁用、不超限，且「有正文或有已通过校验的附件」。
 * 空正文但带附件是合法的（"发个文件"本来就没话），
 * 但带一个被拒的附件 + 空正文就不行 —— 否则发出去是一条空气泡。
 */
const canSend = computed(() => {
  if (!props.active || props.disabled) return false;
  if (overLength.value) return false;
  const hasBody = text.value.trim() !== '' || accepted.value.length > 0;
  return hasBody && rejected.value.length === 0;
});

const sendBlockReason = computed(() => {
  if (!props.active) return '还没有选择会话';
  if (overLength.value) return `超过 ${resolved.value.maxMessageLength} 字`;
  if (rejected.value.length > 0) return '有附件未通过校验，请先移除';
  return undefined;
});

/**
 * 就地显示的那句话：先给"上一次被拦下"的，没有就按当前状态给。
 *
 * 必须有一层"按当前状态"的兜底：按钮一旦 `disabled`，浏览器根本不会把 click 递给处理器，
 * 于是"点了才说原因"在真实浏览器里等于永远不说 —— 而口径是"禁用发送并给出原因"。
 * 保留 `blocked` 这一路是因为它还能承载 `sendBlockReason` 覆盖不到的拦截
 * （比如一次塞了太多附件），那句话只有发生过才知道。
 */
const blockMessage = computed(() => blocked.value ?? sendBlockReason.value);

/** 传给原生 `accept`：白名单为空时不设限，与 `isAcceptable` 的口径一致 */
const acceptAttr = computed(() => resolved.value.accept.join(','));

/**
 * 待发附件的预览地址：只在「本地能算出来」时才有值。
 * 没注入 `createObjectUrl` 就退回只显示文件名 —— 界面少一张缩略图，
 * 远好过本包自己造一个没人 revoke 的 blob URL。
 *
 * 按附件记一次而不是就地调：宿主的 `createObjectUrl` 十有八九就是 `URL.createObjectURL`，
 * **每调一次多一个 blob**。模板里判断变体、`v-if`、`src` 三处都要这个地址，
 * 就地调等于每敲一个字给每个附件凭空造三个 URL 且没有对应的 revoke ——
 * 那正是 `resolvePreviewUrl` 的注释想避免的"稳定泄漏"，别从界面层把它请回来。
 * 键是 `AttachmentCheck` 对象本身：加/删附件只会换新引用，老引用交给 GC，缓存不会无限长。
 */
const previewCache = new WeakMap<AttachmentCheck, string | undefined>();

function previewOf(item: AttachmentCheck): string | undefined {
  if (previewCache.has(item)) return previewCache.get(item);
  const url = resolvePreviewUrl(item.attachment, {
    createObjectUrl: props.createObjectUrl ?? getImRuntime().createObjectUrl,
    source: item.source,
  });
  previewCache.set(item, url);
  return url;
}

function isImage(attachment: Attachment): boolean {
  return (attachment.type ?? '').startsWith('image/');
}

function textarea(): HTMLTextAreaElement | undefined {
  return (
    root.value?.querySelector<HTMLTextAreaElement>('[data-slot="textarea"]') ??
    undefined
  );
}

function detectMention(): void {
  if (props.members === undefined || props.members.length === 0) {
    mention.value = null;
    return;
  }
  const area = textarea();
  const caret = area?.selectionStart ?? text.value.length;
  const state = detectMentionTrigger(text.value, caret);
  mention.value = state.active ? state : null;
}

/** 宿主选定成员后写回文本：替换掉 `@` 到过滤串这一段，并把面板收起 */
function insertMention(name: string): void {
  const state = mention.value;
  if (state === null) return;
  text.value = applyMention(text.value, state, name);
  mention.value = null;
  void focus();
}

/** `@` 按钮：在光标处补一个触发符，直接进入 @ 输入态 */
function triggerMention(): void {
  const area = textarea();
  const caret = area?.selectionStart ?? text.value.length;
  text.value = `${text.value.slice(0, caret)}@${text.value.slice(caret)}`;
  void focus();
  requestAnimationFrame(() => {
    const el = textarea();
    if (el !== undefined) el.selectionStart = el.selectionEnd = caret + 1;
    detectMention();
  });
}

function focus(): void {
  textarea()?.focus();
}

/**
 * 组合态的收尾写成方法而不是模板里的赋值：
 * `<script setup>` 的 ref 在模板里是自动解包的，就地赋值在编译模式不同的情况下行为不稳，
 * 而这里三个事件（blur / compositionend / 面板收起）都必须可靠地复位。
 */
function startComposing(): void {
  composing.value = true;
}

function endComposing(): void {
  composing.value = false;
}

function closeMention(): void {
  mention.value = null;
}

/** 附件准入：一次拖多个时必须把"哪些过了/哪些为什么没过"分开交出去 */
function addFiles(inputs: readonly AttachmentInput[]): AttachmentCheck[] {
  const { accepted: ok, rejected: bad } = validateAttachments(inputs, {
    accept: resolved.value.accept,
    maxSizeMb: resolved.value.maxAttachmentSizeMb,
  });
  const room = resolved.value.maxAttachmentsPerMessage - staged.value.length;
  if (ok.length > room) {
    blocked.value = `一条消息最多 ${resolved.value.maxAttachmentsPerMessage} 个附件`;
  }
  staged.value = [...staged.value, ...ok.slice(0, Math.max(0, room)), ...bad];
  return bad;
}

function onPickFiles(event: Event): void {
  const input = event.target as HTMLInputElement;
  const files = [...(input.files ?? [])];
  addFiles(
    files.map((file) => ({
      lastModified: file.lastModified,
      name: file.name,
      size: file.size,
      source: file,
      type: file.type,
    })),
  );
  // 立刻清空 value：否则再选同一个文件不会触发 change，用户以为"没反应"
  input.value = '';
}

function removeStaged(index: number): void {
  staged.value = staged.value.filter((_, at) => at !== index);
  blocked.value = undefined;
}

function send(): void {
  if (!canSend.value) {
    blocked.value = sendBlockReason.value ?? '无法发送';
    return;
  }
  emit('send', {
    attachments: accepted.value.map((item) => item.attachment),
    mentions: extractMentions(text.value, props.members ?? []),
    text: text.value,
  });
  text.value = '';
  staged.value = [];
  mention.value = null;
  blocked.value = undefined;
}

function onInput(): void {
  detectMention();
  notifyTyping();
}

function notifyTyping(): void {
  if (!props.throttleTyping) return;
  const at = clock();
  if (at - lastTypingAt < resolved.value.typingThrottleMs) return;
  lastTypingAt = at;
  emit('typing');
}

/**
 * Enter 发送的判定。
 *
 * `composing` 与 `event.isComposing` 取或：前者覆盖 Safari 在 compositionend 之后补发的
 * 那个 keydown，后者覆盖没有触发组合事件的输入法。两条都缺的那类实现，
 * 症状是"用拼音打字回车会把半截候选词发出去"。
 */
function onKeydown(event: KeyboardEvent): void {
  const isEnter = event.key === 'Enter';
  if (!isEnter) return;
  const confirmed = composing.value || event.isComposing;
  if (confirmed) return;
  const wantsSend = props.enterToSend
    ? !event.shiftKey
    : event.ctrlKey || event.metaKey;
  if (!wantsSend) return;
  event.preventDefault();
  send();
}

defineExpose({
  addFiles,
  /** 演示页与测试注入假时钟：节流窗口用假时间跨，不用真等 2s */
  configureNow: setNow,
  focus,
  insertMention,
  send,
  stageFiles: addFiles,
});
</script>

<template>
  <div
    ref="root"
    :class="
      cn(
        'flex w-full min-w-0 flex-col gap-2 border-t border-border p-3',
        props.class,
      )
    "
    data-slot="im-composer"
  >
    <slot
      v-if="mention !== null"
      :close="closeMention"
      :insert="insertMention"
      :query="mention.query"
      name="mention"
    ></slot>

    <AttachmentGroup v-if="staged.length > 0" class="flex-wrap">
      <AttachmentCard
        v-for="(item, index) in staged"
        :key="`${item.attachment.name}-${index}`"
        :data-state="item.ok ? 'idle' : 'error'"
        size="sm"
      >
        <AttachmentMedia
          :variant="
            isImage(item.attachment) && previewOf(item) !== undefined
              ? 'image'
              : 'icon'
          "
        >
          <img
            v-if="isImage(item.attachment) && previewOf(item) !== undefined"
            :alt="item.attachment.name"
            :src="previewOf(item)"
            data-attachment-preview
          />
          <IconifyIcon v-else icon="lucide:paperclip" />
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>{{ item.attachment.name }}</AttachmentTitle>
          <AttachmentDescription>
            {{ item.error ?? formatFileSize(item.attachment.size) }}
          </AttachmentDescription>
        </AttachmentContent>
        <AttachmentActions>
          <AttachmentAction
            aria-label="移除附件"
            data-action="remove"
            @click="removeStaged(index)"
          >
            <IconifyIcon icon="lucide:x" />
          </AttachmentAction>
        </AttachmentActions>
      </AttachmentCard>
    </AttachmentGroup>

    <Textarea
      v-model="text"
      :aria-invalid="overLength"
      :class="cn('max-h-40 min-h-16', overLength ? 'border-destructive' : '')"
      :disabled="props.disabled"
      :placeholder="props.placeholder"
      data-composer-input
      @blur="endComposing"
      @compositionend="endComposing"
      @compositionstart="startComposing"
      @input="onInput"
      @keydown="onKeydown"
      @keyup="detectMention"
      @click="detectMention"
    />

    <div class="flex min-w-0 items-center gap-2">
      <slot name="toolbar-leading">
        <Button
          :disabled="props.disabled"
          aria-label="添加附件"
          data-action="attach"
          size="icon-xs"
          type="button"
          variant="ghost"
          @click="fileInput?.click()"
        >
          <IconifyIcon icon="lucide:paperclip" />
        </Button>
        <Button
          :disabled="
            props.disabled ||
            props.members === undefined ||
            props.members.length === 0
          "
          aria-label="提及成员"
          data-action="mention"
          size="icon-xs"
          type="button"
          variant="ghost"
          @click="triggerMention"
        >
          <IconifyIcon icon="lucide:at-sign" />
        </Button>
      </slot>
      <slot name="emoji"></slot>
      <slot name="toolbar-trailing"></slot>

      <span class="ml-auto flex min-w-0 items-center gap-2">
        <p
          v-if="blockMessage !== undefined"
          class="max-w-40 truncate text-destructive text-xs"
          data-composer-block
        >
          {{ blockMessage }}
        </p>
        <span
          :class="
            cn(
              'shrink-0 tabular-nums text-xs',
              overLength ? 'text-destructive' : 'text-muted-foreground',
            )
          "
          data-composer-count
        >
          {{ length }}/{{ resolved.maxMessageLength }}
        </span>
        <Button
          :disabled="!canSend"
          data-action="send"
          size="xs"
          type="button"
          @click="send"
        >
          发送
        </Button>
      </span>
    </div>

    <input
      ref="fileInput"
      :accept="acceptAttr === '' ? undefined : acceptAttr"
      class="hidden"
      data-file-input
      multiple
      type="file"
      @change="onPickFiles"
    />
  </div>
</template>
