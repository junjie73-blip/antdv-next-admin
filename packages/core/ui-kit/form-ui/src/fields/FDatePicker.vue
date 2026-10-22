<script setup lang="ts">
import { computed, ref } from 'vue';

import {
  Calendar,
  Popover,
  PopoverContent,
  PopoverTrigger,
  RangeCalendar,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { CalendarDate } from '@internationalized/date';
import { X } from '@lucide/vue';
import dayjs from 'dayjs';
import { useLocale } from 'reka-ui';

interface Props {
  allowClear?: boolean;
  disabled?: boolean;
  format?: string;
  id?: string;
  picker?: 'date' | 'month' | 'week';
  /**
   * 区间选择器传数组（`['开始时间', '结束时间']`）是全站四个调用点的既有写法，
   * schema 那侧不做转换，所以这里必须接得住：写成 `string` 的话 Vue 只会打一条
   * prop 类型 warning，显示时数组被 `join(',')` 成"开始时间,结束时间"，
   * 分隔符与全站统一的"空格 - 空格"不一致，但看着也不算坏 —— 属于不会有人发现的那种。
   */
  placeholder?: string | string[];
  range?: boolean;
  showTime?: boolean;
  value?: any;
  valueFormat?: string;
  [key: string]: any;
}

const props = withDefaults(defineProps<Props>(), {
  allowClear: false,
  disabled: false,
  format: undefined,
  picker: 'date',
  placeholder: undefined,
  range: false,
  showTime: false,
  value: undefined,
  valueFormat: undefined,
});

const emit = defineEmits<{ 'update:value': [value: any] }>();

const open = ref(false);
const monthYear = ref(dayjs().year());

function toDayjs(v: any): dayjs.Dayjs | null {
  if (v === undefined || v === null || v === '') return null;
  if (dayjs.isDayjs(v)) return v;
  const d = dayjs(v);
  return d.isValid() ? d : null;
}

function toCal(d: dayjs.Dayjs): CalendarDate {
  return new CalendarDate(d.year(), d.month() + 1, d.date());
}

function fromCal(cal: any): dayjs.Dayjs {
  return dayjs(new Date(cal.year, cal.month - 1, cal.day ?? 1));
}

const emitValue = (d: dayjs.Dayjs | null) => {
  if (!d) {
    emit('update:value', undefined);
    return;
  }
  emit('update:value', props.valueFormat ? d.format(props.valueFormat) : d);
};

const currentValue = computed(() => toDayjs(props.value));

const displayFormat = computed(
  () => props.format || (props.showTime ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD'),
);

const displayText = computed(() => {
  if (props.range) {
    const arr = Array.isArray(props.value) ? props.value : [];
    const [start, end] = [toDayjs(arr[0]), toDayjs(arr[1])];
    if (!start && !end) return '';
    return [
      start?.format(displayFormat.value),
      end?.format(displayFormat.value),
    ]
      .filter(Boolean)
      .join(' ~ ');
  }
  return currentValue.value
    ? currentValue.value.format(displayFormat.value)
    : '';
});

const hasValue = computed(() =>
  props.range
    ? Array.isArray(props.value) &&
      (toDayjs(props.value[0]) || toDayjs(props.value[1]))
    : currentValue.value !== null,
);

/** 数组取两端、用与内置区间占位一致的 ` - ` 连接；空串与空数组一律回落到默认文案 */
const placeholderText = computed(() => {
  const raw = Array.isArray(props.placeholder)
    ? props.placeholder.filter(Boolean).join(' - ')
    : props.placeholder;
  if (raw) return raw;
  return props.range ? '开始日期 - 结束日期' : '请选择日期';
});

const timeValue = computed(() => {
  const d = currentValue.value;
  return d ? d.format('HH:mm') : '00:00';
});

function onCalendarSelect(cal: any) {
  if (!cal) return;
  let d = fromCal(cal);
  if (props.picker === 'week') {
    open.value = false;
    emitValue(d);
    return;
  }
  if (props.showTime) {
    const [h, m] = timeValue.value.split(':').map(Number);
    d = d
      .hour(h || 0)
      .minute(m || 0)
      .second(0);
    emitValue(d);
    return;
  }
  open.value = false;
  emitValue(d);
}

function onTimeInput(event: Event) {
  const raw = (event.target as HTMLInputElement).value;
  const base = currentValue.value ?? dayjs();
  const [h, m] = raw.split(':').map(Number);
  emitValue(
    base
      .hour(h || 0)
      .minute(m || 0)
      .second(0),
  );
}

const rangeValue = computed(() => {
  const arr = Array.isArray(props.value) ? props.value : [];
  const start = toDayjs(arr[0]);
  const end = toDayjs(arr[1]);
  return {
    start: start ? toCal(start) : undefined,
    end: end ? toCal(end) : undefined,
  };
});

function onRangeSelect(evt: any) {
  const start = evt?.start ? fromCal(evt.start) : null;
  const end = evt?.end ? fromCal(evt.end) : null;
  if (!start || !end) return;
  const next = [
    props.valueFormat ? start.format(props.valueFormat) : start,
    props.valueFormat ? end.format(props.valueFormat) : end,
  ];
  emit('update:value', next);
  open.value = false;
}

/**
 * 语言只有 `ConfigProvider` 一个来源：reka 的 `useLocale()` 读的就是它注入的
 * `locale`。原先这里写死中文月名，切语言时"按钮变了、日历没变"就是这一处造成的。
 * `monthLabels` 依赖 `locale.value`，换语言时自己重算，不需要额外触发。
 */
const locale = useLocale();

const monthLabels = computed(() => {
  const format = new Intl.DateTimeFormat(locale.value, { month: 'long' });
  return Array.from({ length: 12 }, (_, index) =>
    format.format(new Date(monthYear.value, index, 1)),
  );
});

function pickMonth(monthIndex: number) {
  emitValue(dayjs(new Date(monthYear.value, monthIndex, 1)));
  open.value = false;
}

function clear(event: MouseEvent) {
  event.stopPropagation();
  event.preventDefault();
  emit('update:value', props.range ? undefined : undefined);
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <button
        type="button"
        :disabled="disabled"
        :id="id"
        data-field-control
        :class="
          cn(
            'flex w-full min-h-9 items-center justify-between gap-1 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-xs outline-hidden transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 text-left',
            !hasValue && 'text-muted-foreground',
          )
        "
      >
        <span class="truncate">{{
          hasValue ? displayText : placeholderText
        }}</span>
        <span
          v-if="allowClear && hasValue && !disabled"
          class="shrink-0 cursor-pointer opacity-60 hover:opacity-100"
          data-clear
          @click="clear"
        >
          <X class="size-3.5" />
        </span>
        <svg
          v-else
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="shrink-0 text-muted-foreground"
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>
    </PopoverTrigger>
    <PopoverContent align="start" :side-offset="4" class="w-auto p-0">
      <!-- 日期范围 -->
      <div v-if="range" class="p-2">
        <RangeCalendar
          :model-value="rangeValue"
          :number-of-months="2"
          hide-weekdays
          @update:model-value="onRangeSelect"
        />
      </div>

      <!-- 月份选择 -->
      <div v-else-if="picker === 'month'" class="p-2">
        <div class="mb-2 flex items-center justify-between px-1">
          <button
            type="button"
            class="rounded px-1.5 text-sm hover:bg-accent"
            aria-label="上一年"
            @click="monthYear -= 1"
          >
            ‹
          </button>
          <span class="text-sm font-medium">{{ monthYear }}</span>
          <button
            type="button"
            class="rounded px-1.5 text-sm hover:bg-accent"
            aria-label="下一年"
            @click="monthYear += 1"
          >
            ›
          </button>
        </div>
        <div class="grid grid-cols-3 gap-1">
          <button
            v-for="(name, idx) in monthLabels"
            :key="name"
            type="button"
            :class="
              cn(
                'rounded-md px-2 py-1.5 text-sm hover:bg-accent',
                currentValue &&
                  currentValue.year() === monthYear &&
                  currentValue.month() === idx &&
                  'bg-primary text-primary-foreground hover:bg-primary',
              )
            "
            @click="pickMonth(idx)"
          >
            {{ name }}
          </button>
        </div>
      </div>

      <!-- 日期 / 周 选择 -->
      <div v-else class="p-2">
        <Calendar
          :model-value="currentValue ? toCal(currentValue) : undefined"
          fixed-weeks
          @update:model-value="onCalendarSelect"
        />
        <div v-if="showTime" class="flex items-center gap-2 border-t px-1 py-2">
          <span class="text-xs text-muted-foreground">时间</span>
          <input
            type="time"
            :value="timeValue"
            class="rounded border border-input px-2 py-1 text-sm outline-hidden focus-visible:border-ring"
            data-time-input
            @change="onTimeInput"
          />
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>
