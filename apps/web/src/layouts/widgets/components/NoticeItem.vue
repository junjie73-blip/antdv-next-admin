<script setup lang="ts">
import type { BellNotice } from '../notice';

import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { cn } from '@antdv/shared/cn';
import { Icon } from '@iconify/vue';
import dayjs from 'dayjs';

import { NOTICE_TYPE_LABELS } from '../notice';

defineOptions({ name: 'NoticeItem' });

/**
 * 铃铛面板里的单条通知。
 *
 * `expanded` 由父组件（WidgetNotice）统一持有：同一时刻只展开一条，
 * 避免"点开三条以后面板长到没法看"，也让展开态可被用例断言。
 */
const props = defineProps<{
  expanded?: boolean;
  item: BellNotice;
}>();

const emit = defineEmits<{
  click: [item: BellNotice];
  viewAll: [];
}>();

const { t } = useI18n({ useScope: 'global' });

/** 优先级样式：labelKey 在渲染时才翻成文案，切语言才跟得上 */
const PRIORITY_CONFIG: Record<
  number,
  { bg: string; color: string; labelKey: string }
> = {
  0: {
    labelKey: 'notice.priorityNormal',
    color: '#64748B',
    bg: 'rgba(100,116,139,0.12)',
  },
  1: {
    labelKey: 'notice.priorityImportant',
    color: '#EA580C',
    bg: 'rgba(234,88,12,0.12)',
  },
  2: {
    labelKey: 'notice.priorityUrgent',
    color: '#DC2626',
    bg: 'rgba(220,38,38,0.12)',
  },
};

const priority = computed(
  () => PRIORITY_CONFIG[props.item.priority ?? 0] ?? PRIORITY_CONFIG[0]!,
);
const priorityLabel = computed(() => t(priority.value.labelKey));
const isUnread = computed(() => !props.item.read);
const isUrgent = computed(() => (props.item.priority ?? 0) >= 2);
const typeLabel = computed(() =>
  t(NOTICE_TYPE_LABELS[props.item.type] ?? 'notice.typeNotice'),
);

const relativeTime = computed(() =>
  props.item.sendTime ? dayjs(props.item.sendTime).fromNow() : '',
);
const absoluteTime = computed(() =>
  props.item.sendTime
    ? dayjs(props.item.sendTime).format('YYYY-MM-DD HH:mm')
    : '',
);

const rootClass = computed(() =>
  cn(
    'group relative flex cursor-pointer flex-col gap-1.5 rounded-lg px-3 py-2.5',
    'border border-transparent transition-all duration-200',
    'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800',
    isUrgent.value &&
      'bg-red-50/60 hover:bg-red-50 dark:bg-red-950/20 dark:hover:bg-red-950/30',
    isUnread.value && !isUrgent.value && 'bg-blue-50/50 dark:bg-blue-950/20',
    props.expanded && 'ring-ring/40 ring-1',
  ),
);

function handleClick() {
  emit('click', props.item);
}

function handleViewAll() {
  emit('viewAll');
}
</script>

<template>
  <div
    :class="rootClass"
    data-testid="notice-item"
    :data-unread="isUnread ? 'true' : 'false'"
    :data-expanded="expanded ? 'true' : 'false'"
    @click="handleClick"
  >
    <!-- 未读左侧色条 -->
    <span
      v-if="isUnread"
      class="absolute top-1/2 left-0 h-4 w-[2px] -translate-y-1/2 rounded-r-full"
      :style="{ backgroundColor: priority.color }"
    ></span>

    <!-- 第一行：标题 + 类型 + 优先级标签 + 未读点 -->
    <div class="flex items-center gap-1.5">
      <span
        class="truncate text-[13px] leading-5"
        :class="
          isUnread
            ? 'font-medium text-slate-800 dark:text-slate-100'
            : 'text-slate-500 dark:text-slate-400'
        "
        :title="item.title"
      >
        {{ item.title }}
      </span>

      <span
        class="shrink-0 rounded bg-slate-100 px-1.5 py-px text-[10px] leading-none font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400"
      >
        {{ typeLabel }}
      </span>

      <span
        class="shrink-0 rounded px-1.5 py-px text-[10px] leading-none font-medium"
        :style="{ backgroundColor: priority.bg, color: priority.color }"
      >
        {{ priorityLabel }}
      </span>

      <span
        v-if="isUnread"
        class="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-red-500"
      ></span>
    </div>

    <!-- 第二行：内容摘要（展开后显示全文） + 时间 -->
    <div class="flex items-center gap-2">
      <span
        :class="
          cn(
            'flex-1 text-[12px] leading-4 text-slate-500 dark:text-slate-400',
            expanded ? 'whitespace-pre-wrap' : 'truncate',
          )
        "
      >
        {{ item.content || t('notice.noDetail') }}
      </span>
      <span
        v-if="!expanded"
        class="shrink-0 text-[11px] leading-4 text-slate-400 dark:text-slate-500"
      >
        {{ relativeTime }}
      </span>
    </div>

    <!-- 展开态：发送人 / 精确时间 / 去通知中心 -->
    <div
      v-if="expanded"
      class="mt-1 flex items-center justify-between gap-2 border-t border-slate-100 pt-1.5 text-[11px] text-slate-400 dark:border-slate-800 dark:text-slate-500"
    >
      <span class="truncate">
        {{ item.sender || t('notice.senderSystem') }} · {{ absoluteTime }}
      </span>
      <button
        type="button"
        class="text-ant-primary flex shrink-0 items-center gap-0.5 hover:underline"
        @click.stop="handleViewAll"
      >
        在通知中心查看
        <Icon icon="carbon:chevron-right" class="text-xs" />
      </button>
    </div>
  </div>
</template>
