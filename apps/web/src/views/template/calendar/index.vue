<script setup lang="ts">
import { computed, ref } from 'vue';

import { PageHeader, Tag } from '@antdv/common-ui';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@antdv/shadcn-ui';
import { Icon } from '@iconify/vue';

defineOptions({ name: 'TemplateCalendar' });

/**
 * 参考 admin 的日历三段式：工具栏（上一月/今天/下一月 + 视图切换 + 新建日程）、
 * 月视图看板、右侧「即将到来」列表。日期为静态示例数据，不引第三方日历库。
 */
const YEAR = 2026;
const MONTH = 10; // 0-based → 11 月
const offset = ref(0);
const view = ref<'list' | 'month'>('month');

const monthLabel = computed(() => `${YEAR} 年 ${MONTH + 1 + offset.value} 月`);
const weekDays = ['一', '二', '三', '四', '五', '六', '日'];

/** 以周一为首列，铺 6 行 × 7 列 */
const cells = computed(() => {
  const first = new Date(YEAR, MONTH + offset.value, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(YEAR, MONTH + offset.value + 1, 0).getDate();
  const out: Array<{ day: number; muted: boolean }> = [];
  for (let i = 0; i < lead; i += 1) out.push({ day: 0, muted: true });
  for (let d = 1; d <= days; d += 1) out.push({ day: d, muted: false });
  while (out.length % 7 !== 0) out.push({ day: 0, muted: true });
  return out;
});

interface CalendarEvent {
  color: string;
  day: number;
  time: string;
  title: string;
  type: string;
}
const events: CalendarEvent[] = [
  { color: 'blue', day: 3, time: '10:00', title: '需求评审会', type: '会议' },
  {
    color: 'green',
    day: 5,
    time: '14:30',
    title: '组件库 1.5 发版',
    type: '里程碑',
  },
  { color: 'gold', day: 12, time: '09:30', title: '迭代计划会', type: '会议' },
  { color: 'purple', day: 18, time: '16:00', title: '设计走查', type: '评审' },
  { color: 'blue', day: 21, time: '11:00', title: '季度复盘', type: '会议' },
  {
    color: 'red',
    day: 26,
    time: '18:00',
    title: '灰度发布窗口',
    type: '里程碑',
  },
];
const eventsByDay = (day: number) => events.filter((item) => item.day === day);
const upcoming = [...events].sort((a, b) => a.day - b.day).slice(0, 4);

const stats = [
  {
    label: '本月日程',
    value: '18',
    icon: 'carbon:calendar',
    tone: 'text-blue-600',
  },
  {
    label: '待办会议',
    value: '6',
    icon: 'carbon:event',
    tone: 'text-violet-600',
  },
  {
    label: '已完成',
    value: '9',
    icon: 'carbon:checkmark',
    tone: 'text-emerald-600',
  },
  {
    label: '冲突提醒',
    value: '1',
    icon: 'carbon:warning-alt',
    tone: 'text-rose-600',
  },
];
</script>

<template>
  <div class="space-y-4" data-page-view>
    <PageHeader
      description="日程与会议视图，参照参考实现的工具栏 + 月视图看板 + 右侧即将到来列表。"
      icon="carbon:calendar"
      title="日历"
    />

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card v-for="stat in stats" :key="stat.label" class="shadow-sm">
        <CardContent class="flex items-center justify-between gap-3 pt-4">
          <div>
            <p class="text-xs text-muted-foreground">{{ stat.label }}</p>
            <p class="mt-1 text-2xl font-semibold tabular-nums">
              {{ stat.value }}
            </p>
          </div>
          <Icon :icon="stat.icon" class="size-6 opacity-70" :class="[stat.tone]" />
        </CardContent>
      </Card>
    </div>

    <div class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <Card class="shadow-sm">
        <CardHeader
          class="flex flex-row flex-wrap items-center justify-between gap-2 border-b border-border"
        >
          <div class="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              aria-label="上一月"
              @click="offset--"
            >
              <Icon icon="carbon:arrow-left" class="size-4" />
            </Button>
            <CardTitle class="min-w-28 text-center text-base">
{{
              monthLabel
            }}
</CardTitle>
            <Button
              size="icon"
              variant="ghost"
              aria-label="下一月"
              @click="offset++"
            >
              <Icon icon="carbon:arrow-right" class="size-4" />
            </Button>
            <Button size="sm" variant="outline" @click="offset = 0">
今天
</Button>
          </div>
          <div class="flex items-center gap-2">
            <Button
              size="sm"
              :variant="view === 'month' ? 'default' : 'outline'"
              @click="view = 'month'"
            >
              月视图
            </Button>
            <Button
              size="sm"
              :variant="view === 'list' ? 'default' : 'outline'"
              @click="view = 'list'"
            >
              列表
            </Button>
            <Button size="sm">
<Icon icon="carbon:add" class="size-4" /> 新建日程
</Button>
          </div>
        </CardHeader>

        <CardContent v-if="view === 'month'" class="pt-4">
          <div
            class="grid grid-cols-7 border-b border-border pb-2 text-center text-xs text-muted-foreground"
          >
            <span v-for="w in weekDays" :key="w">周{{ w }}</span>
          </div>
          <div class="grid grid-cols-7">
            <div
              v-for="(cell, index) in cells"
              :key="index"
              class="min-h-20 border-b border-r border-border p-1.5 text-xs"
              :class="cell.muted ? 'bg-muted/30' : ''"
            >
              <span v-if="cell.day" class="font-medium tabular-nums">{{
                cell.day
              }}</span>
              <div class="mt-1 space-y-1">
                <div
                  v-for="item in eventsByDay(cell.day)"
                  :key="item.title"
                  class="truncate"
                >
                  <Tag
                    :color="item.color"
                    class="max-w-full truncate text-[11px]"
                  >
                    {{ item.title }}
                  </Tag>
                </div>
              </div>
            </div>
          </div>
        </CardContent>

        <CardContent v-else class="space-y-2 pt-4">
          <div
            v-for="item in events"
            :key="item.title"
            class="flex items-center gap-3 rounded-md border border-border px-3 py-2"
          >
            <Tag :color="item.color">{{ item.type }}</Tag>
            <span class="min-w-0 flex-1 truncate text-sm">{{
              item.title
            }}</span>
            <span class="text-xs tabular-nums text-muted-foreground">
              {{ MONTH + 1 }}/{{ item.day }} {{ item.time }}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card class="shadow-sm">
        <CardHeader class="border-b border-border">
          <CardTitle class="text-base">即将到来</CardTitle>
        </CardHeader>
        <CardContent class="space-y-3 pt-4">
          <div
            v-for="item in upcoming"
            :key="item.title"
            class="flex gap-3 rounded-md border border-border p-3"
          >
            <div
              class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
            >
              <Icon icon="carbon:time" class="size-5" />
            </div>
            <div class="min-w-0">
              <p class="truncate text-sm font-medium">{{ item.title }}</p>
              <p class="mt-0.5 text-xs text-muted-foreground">
                {{ MONTH + 1 }} 月 {{ item.day }} 日 · {{ item.time }}
              </p>
              <Tag :color="item.color" class="mt-1.5">{{ item.type }}</Tag>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
