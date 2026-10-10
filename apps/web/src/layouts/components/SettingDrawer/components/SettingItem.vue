<script setup lang="ts">
import { cn } from '@antdv/shared/cn';
import { Icon } from '@iconify/vue';

import {
  itemDescClassName,
  itemLabelClassName,
  itemRowClassName,
} from '../constants';

defineOptions({ name: 'SettingItem' });

/**
 * `stacked`：控件放到标题下一行。
 *
 * 抽屉只有 380px 宽，切换条 / 滑块这类"横向要空间"的控件塞在同一行右侧，
 * 要么把描述文字挤没，要么直接溢出边框（标签风格那 5 个选项就是这么被顶出去的）。
 * 开关、数字输入这种小控件继续用默认的一行左右布局。
 */
const props = defineProps<{
  stacked?: boolean;
  label: string;
  desc?: string;
  /** 是否显示 tooltip 图标 */
  tooltip?: string;
}>();
</script>

<template>
  <!--
    `data-setting-label` 是给用例留的稳定钩子：抽屉里的行长得都一样
    （同样的 class、同样的"标题 + 控件"结构），靠 XPath 往上爬三层去找开关，
    改一处排版就把断言带崩。用标题原文当键，它本来就是给用户看的。
  -->
  <div
    :data-setting-label="props.label"
    :class="cn(itemRowClassName, props.stacked && 'flex-col items-start')"
  >
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-1">
        <span :class="itemLabelClassName">{{ props.label }}</span>
        <a-tooltip v-if="props.tooltip" :title="props.tooltip">
          <Icon icon="carbon:information" class="text-xs text-slate-400" />
        </a-tooltip>
      </div>
      <div v-if="props.desc" :class="itemDescClassName">{{ props.desc }}</div>
    </div>
    <div
      :class="
        cn(
          props.stacked ? 'mt-2 w-full [&>*]:w-full' : 'shrink-0',
          'flex items-center justify-end',
        )
      "
    >
      <slot></slot>
    </div>
  </div>
</template>
