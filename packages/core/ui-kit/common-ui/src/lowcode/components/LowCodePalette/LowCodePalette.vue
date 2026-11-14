<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

import type { LowcodeContext } from '../../config';
import type { MaterialEntry } from '../../core/types';

import { computed, ref } from 'vue';

import { Badge, Input, Label, Separator } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

import { useLowcodeContext } from '../../composables/use-lowcode-page';
import { LOWCODE_DND_MIME, writeDndData } from '../../utils/dnd';

/**
 * 物料面板：注册表里有什么，这里就有什么。
 *
 * 分层位置：`components/`。数据来源只有一个 —— `context.registry.listByGroup()`，
 * 面板不持有物料清单副本，否则宿主干脆维护两份真相。
 *
 * 口径：
 * - 点击与拖拽**两条路都给**：拖拽适合画布，点击对键盘与触屏友好（也是自动化测试的抓手），
 *   两者抛出的是同一个 `pick` 事件；
 * - 拖拽载荷写的是 `LOWCODE_DND_MIME` 里的 JSON（见 `utils/dnd`），大纲那边解码；
 * - 搜索只过滤 `name / type / group`，不做拼音或模糊匹配 —— 物料数量级到了需要时再让宿主接搜索。
 *
 * 本文件**不做**的事：不插入节点（那是宿主收到 `pick`/`drop` 之后调 `dsl.insertNode` 的事）、
 * 不缓存注册表快照。
 */

const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes['class'];
    context?: LowcodeContext;
    /** 传字符串时按 `meta.name / type / group` 过滤；不传则面板自己给一个搜索框 */
    keyword?: string;
    /** 关掉内置搜索框（宿主已有全局搜索时用） */
    searchable?: boolean;
  }>(),
  {
    class: undefined,
    context: undefined,
    keyword: undefined,
    searchable: true,
  },
);

const emit = defineEmits<{
  dragStart: [payload: { entry: MaterialEntry; type: string }];
  pick: [payload: { entry: MaterialEntry; type: string }];
}>();

// 传函数而不是值：宿主换 `:context`（换租户的物料包）时物料列表跟着换，
// 传值的话这里会在 setup 那一刻就把装配定死，面板继续画旧物料
const context = useLowcodeContext(() => props.context);
const localKeyword = ref('');

const activeKeyword = computed(() =>
  (props.keyword ?? localKeyword.value).trim().toLowerCase(),
);

const groups = computed(() => {
  const keyword = activeKeyword.value;
  return context.registry
    .listByGroup()
    .map((group) => ({
      group: group.group,
      items: group.items.filter((entry) => {
        if (!keyword) return true;
        const haystack =
          `${entry.meta.name} ${entry.meta.type} ${entry.meta.group ?? ''} ${entry.meta.description ?? ''}`.toLowerCase();
        return haystack.includes(keyword);
      }),
    }))
    .filter((group) => group.items.length > 0);
});

const total = computed(() =>
  groups.value.reduce((sum, group) => sum + group.items.length, 0),
);

function onDragStart(entry: MaterialEntry, event: DragEvent) {
  writeDndData(event, { kind: 'material', type: entry.meta.type });
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'copy';
    // 自定义 MIME 在部分浏览器里 dragover 阶段读不到，纯文本兜一份物料名，
    // 至少让「拖出去的东西肉眼看得出是什么」
    event.dataTransfer.setData(
      'text/plain',
      `${LOWCODE_DND_MIME}:${entry.meta.type}`,
    );
  }
  emit('dragStart', { entry, type: entry.meta.type });
}
</script>

<template>
  <div
    :class="cn('flex w-full flex-col gap-3', props.class)"
    data-slot="lowcode-palette"
  >
    <div v-if="searchable" class="flex flex-col gap-1.5">
      <Label class="text-xs text-muted-foreground" for="lowcode-palette-search">搜索物料</Label>
      <Input
        id="lowcode-palette-search"
        v-model="localKeyword"
        class="h-8"
        data-slot="lowcode-palette-search"
        placeholder="按名称或类型过滤"
        type="search"
      />
    </div>

    <p
      v-if="total === 0"
      class="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground"
      data-slot="lowcode-palette-empty"
    >
      没有匹配的物料{{ activeKeyword ? `「${activeKeyword}」` : '' }}
    </p>

    <section
      v-for="group in groups"
      :key="group.group"
      class="flex flex-col gap-2"
      data-slot="lowcode-palette-group"
    >
      <h3 class="text-xs font-medium text-muted-foreground">
        {{ group.group }}
      </h3>
      <Separator />
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="entry in group.items"
          :key="entry.meta.type"
          :aria-label="`添加物料 ${entry.meta.name}`"
          :draggable="true"
          class="flex flex-col items-start gap-0.5 rounded-md border bg-background px-2 py-2 text-left shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          data-action="pick"
          :data-material-type="entry.meta.type"
          type="button"
          @click="emit('pick', { entry, type: entry.meta.type })"
          @dragstart="onDragStart(entry, $event)"
        >
          <span class="truncate text-sm">{{ entry.meta.name }}</span>
          <Badge class="mt-0.5" variant="outline">{{ entry.meta.type }}</Badge>
        </button>
      </div>
    </section>
  </div>
</template>
