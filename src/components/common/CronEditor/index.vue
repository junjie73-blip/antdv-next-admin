<script setup lang="ts">
import { Icon } from "@iconify/vue";
import cronstrue from "cronstrue";
import { computed, ref, watch } from "vue";

import { cn } from "~/utils/cn";

import "cronstrue/locales/zh_CN";

defineOptions({ name: "CronEditor" });

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    disabled?: boolean;
  }>(),
  {
    modelValue: "",
    disabled: false,
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
  (e: "change", value: string): void;
}>();

// ========== 模式：preset 预设 / custom 自定义 ==========
const mode = ref<"preset" | "custom">("preset");

// ========== 预设选项 ==========
const presets = [
  { label: "每分钟", value: "0 * * * * *" },
  { label: "每 5 分钟", value: "0 */5 * * * *" },
  { label: "每 10 分钟", value: "0 */10 * * * *" },
  { label: "每 30 分钟", value: "0 */30 * * * *" },
  { label: "每小时", value: "0 0 * * * *" },
  { label: "每 2 小时", value: "0 0 */2 * * *" },
  { label: "每天 0 点", value: "0 0 0 * * *" },
  { label: "每天 8 点", value: "0 0 8 * * *" },
  { label: "每天 12 点", value: "0 0 12 * * *" },
  { label: "每周一 0 点", value: "0 0 0 * * 1" },
  { label: "每月 1 号 0 点", value: "0 0 0 1 * *" },
  { label: "每年 1 月 1 日", value: "0 0 0 1 1 *" },
];

// ========== 自定义模式的字段 ==========
interface CronField {
  key: string;
  label: string;
  min: number;
  max: number;
  allowEvery: boolean;
  defaultValue: string;
}

const fields: CronField[] = [
  { key: "second", label: "秒", min: 0, max: 59, allowEvery: true, defaultValue: "0" },
  { key: "minute", label: "分", min: 0, max: 59, allowEvery: true, defaultValue: "0" },
  { key: "hour", label: "时", min: 0, max: 23, allowEvery: true, defaultValue: "0" },
  { key: "day", label: "日", min: 1, max: 31, allowEvery: true, defaultValue: "*" },
  { key: "month", label: "月", min: 1, max: 12, allowEvery: true, defaultValue: "*" },
  { key: "week", label: "周", min: 0, max: 6, allowEvery: true, defaultValue: "*" },
];

// 各字段的当前值
const fieldValues = ref<Record<string, string>>({
  second: "0",
  minute: "0",
  hour: "0",
  day: "*",
  month: "*",
  week: "*",
});

// ========== 解析现有的 cron 表达式到 fieldValues ==========
function parseCron(expr: string) {
  const parts = (expr || "").trim().split(/\s+/);
  if (parts.length === 5) {
    // 5 位：分 时 日 月 周 → 补一个秒
    fieldValues.value = {
      second: "0",
      minute: parts[0],
      hour: parts[1],
      day: parts[2],
      month: parts[3],
      week: parts[4],
    };
  } else if (parts.length === 6) {
    fieldValues.value = {
      second: parts[0],
      minute: parts[1],
      hour: parts[2],
      day: parts[3],
      month: parts[4],
      week: parts[5],
    };
  } else {
    // 默认
    fieldValues.value = {
      second: "0",
      minute: "0",
      hour: "0",
      day: "*",
      month: "*",
      week: "*",
    };
  }
}

// 初始化
watch(
  () => props.modelValue,
  (val) => {
    if (mode.value === "custom") {
      parseCron(val);
    }
  },
  { immediate: true },
);

// ========== 生成 cron 表达式 ==========
const generatedCron = computed(() => {
  return fields.map((f) => fieldValues.value[f.key] || "*").join(" ");
});

// ========== 字段选项（下拉） ==========
function getFieldOptions(field: CronField) {
  const opts: { label: string; value: string }[] = [{ label: "每 " + field.label, value: "*" }];
  // 单值
  for (let i = field.min; i <= field.max; i++) {
    opts.push({
      label: `${field.label} ${i}`,
      value: String(i),
    });
  }
  // 常用间隔
  if (field.key === "minute" || field.key === "second") {
    opts.push(
      { label: "每 5 " + field.label, value: "*/5" },
      { label: "每 10 " + field.label, value: "*/10" },
      { label: "每 15 " + field.label, value: "*/15" },
      { label: "每 30 " + field.label, value: "*/30" },
    );
  }
  if (field.key === "hour") {
    opts.push(
      { label: "每 2 小时", value: "*/2" },
      { label: "每 4 小时", value: "*/4" },
      { label: "每 6 小时", value: "*/6" },
      { label: "每 12 小时", value: "*/12" },
    );
  }
  return opts;
}

// ========== 预览 ==========
const cronDescription = computed(() => {
  try {
    return cronstrue.toString(generatedCron.value, { locale: "zh_CN" });
  } catch {
    return "表达式无效";
  }
});

// ========== 模式切换 ==========
function switchMode(m: "preset" | "custom") {
  mode.value = m;
  if (m === "custom") {
    parseCron(props.modelValue);
  } else {
    // 切到预设时，如果当前值不在预设里，选第一个
    const isMatch = presets.some((p) => p.value === props.modelValue);
    if (!isMatch) {
      emit("update:modelValue", presets[0].value);
      emit("change", presets[0].value);
    }
  }
}

// ========== 选择预设 ==========
function handlePresetSelect(value: string) {
  emit("update:modelValue", value);
  emit("change", value);
}

// ========== 自定义字段变更 ==========
function handleFieldChange() {
  const cron = generatedCron.value;
  emit("update:modelValue", cron);
  emit("change", cron);
}

// ========== 手动输入 ==========
function handleInputChange(e: Event) {
  const value = (e.target as HTMLInputElement).value;
  emit("update:modelValue", value);
  emit("change", value);
}
</script>

<template>
  <div class="cron-editor space-y-3">
    <!-- 模式切换 -->
    <div class="flex items-center gap-2">
      <button
        type="button"
        :class="
          cn(
            'px-3 py-1 text-xs rounded transition-colors',
            mode === 'preset'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
          )
        "
        :disabled="disabled"
        @click="switchMode('preset')"
      >
        常用预设
      </button>
      <button
        type="button"
        :class="
          cn(
            'px-3 py-1 text-xs rounded transition-colors',
            mode === 'custom'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
          )
        "
        :disabled="disabled"
        @click="switchMode('custom')"
      >
        自定义
      </button>
    </div>

    <!-- 预设模式 -->
    <div v-if="mode === 'preset'" class="grid grid-cols-3 gap-2">
      <button
        v-for="p in presets"
        :key="p.value"
        type="button"
        :class="
          cn(
            'px-3 py-2 text-sm rounded border transition-all',
            modelValue === p.value
              ? 'border-blue-500 bg-blue-50 text-blue-600 font-medium'
              : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50/50',
          )
        "
        :disabled="disabled"
        @click="handlePresetSelect(p.value)"
      >
        {{ p.label }}
      </button>
    </div>

    <!-- 自定义模式 -->
    <div v-else class="space-y-2">
      <div class="grid grid-cols-6 gap-2">
        <div v-for="f in fields" :key="f.key" class="flex flex-col gap-1">
          <label class="text-xs text-gray-500 text-center">{{ f.label }}</label>
          <a-select
            v-model:value="fieldValues[f.key]"
            size="small"
            :disabled="disabled"
            :options="getFieldOptions(f)"
            :dropdown-match-select-width="120"
            @change="handleFieldChange"
          />
        </div>
      </div>
    </div>

    <!-- 生成的表达式 + 描述 -->
    <div class="flex items-start gap-2">
      <div class="flex-1">
        <a-input
          :value="modelValue"
          :disabled="disabled"
          placeholder="Cron 表达式"
          readonly
          size="small"
          class="font-mono"
        />
      </div>
      <div class="text-xs text-gray-500 whitespace-nowrap pt-1.5">
        <Icon icon="carbon:information" class="inline" />
        {{ cronDescription }}
      </div>
    </div>
  </div>
</template>

<style scoped>
:deep(.ant-select-selector) {
  font-family: ui-monospace, monospace;
}
</style>
