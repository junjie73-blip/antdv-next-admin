/**
 * CronEditor 的类型定义。
 *
 * 组件对外只暴露一个 cron 表达式字符串（v-model），内部把表达式拆成
 * 秒/分/时/日/月/周 六个字段分别编辑，这里集中描述这些结构。
 */

/** 单个可编辑字段（秒、分、时、日、月、周）的元信息 */
export interface CronField {
  key: string;
  label: string;
  min: number;
  max: number;
  allowEvery: boolean;
  defaultValue: string;
}

/** 常用预设项：label 展示中文文案，value 是 6 段 cron 表达式 */
export interface CronPreset {
  label: string;
  value: string;
}

/** CronEditor 组件 props */
export interface CronEditorProps {
  /** v-model 绑定的 cron 表达式 */
  modelValue?: string;
  /** 禁用整个编辑器 */
  disabled?: boolean;
}

/** CronEditor 组件 emits */
export interface CronEditorEmits {
  (e: 'update:modelValue', value: string): void;
  (e: 'change', value: string): void;
}
