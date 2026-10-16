<script setup lang="ts">
import type { ComputedRef, Ref } from 'vue';

import type { FormActionType, FormProps, FormValidateError } from '../../types';

import type { FormContext } from './context';

import type { FormSchema, NamePath, Recordable } from './schema';

import {
  computed,
  onBeforeUnmount,
  onMounted,
  provide,
  reactive,
  ref,
  unref,
  useAttrs,
  watch,
} from 'vue';

import { Separator } from '@antdv/shadcn-ui';
import { useForm as useTanstackForm } from '@tanstack/vue-form';
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core';

import { deepMerge, formatDateFields, handleRangeValue } from './utils';
import { FORM_CONTEXT_KEY } from './context';
import FormActions from '../form-actions.vue';
import FormField from './form-field.vue';

defineOptions({
  name: 'BasicForm',
});

const props = withDefaults(defineProps<FormProps>(), {
  showActionButtonGroup: true,
  showResetButton: true,
  showSubmitButton: true,
  submitOnReset: true,
  autoSubmitOnEnter: true,
  labelAlign: 'right',
  colon: false,
  scrollToFirstError: true,
});

const emit = defineEmits<{
  register: [instance: FormActionType];
  reset: [values: Recordable];
  submit: [values: Recordable];
}>();

const attrs = useAttrs();

// ============================================================
// 响应式断点（Tailwind 约定）
//   < 640px → 1 列 / < 768px → 2 列 / < 1280px → 3 列 / ≥1280px → 4 列
// 外部显式传 grid.cols 时优先用外部配置
// ============================================================
const breakpoints = useBreakpoints(breakpointsTailwind);

const responsiveCols = computed(() => {
  if (breakpoints.smaller('sm').value) return 1;
  if (breakpoints.smaller('md').value) return 2;
  if (breakpoints.smaller('xl').value) return 3;
  return 4;
});

// ============ 表单状态 ============
const form = useTanstackForm<
  Recordable,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined
>({
  defaultValues: {},
});

// 表单默认值集合（resetFields 的目标）；用 reactive 便于 initFormModel 增量写入
const defaults = reactive<Recordable>({});

const schemaRef = ref<FormSchema[]>([]);
const propsRef = ref<Partial<FormProps>>({});
const isAdvanced = ref(false);
const rootRef = ref<HTMLFormElement>();

const getValues = (): Recordable => ({ ...(form.state.values ?? {}) });

/**
 * 给插槽用的表单值代理。
 *
 * `getValues()` 返回的是快照，插槽里 `v-model="model[field]"` 写回去只会落在
 * 一次性对象上；代理把读写都接到表单本身，赋值走 `setFieldValue`（才会触发校验）。
 */
const readModelValue = (key: string) =>
  (form.state.values as Recordable | undefined)?.[key];

const formModel = new Proxy({} as Recordable, {
  get(_target, key) {
    return typeof key === 'symbol' ? undefined : readModelValue(key);
  },
  getOwnPropertyDescriptor(_target, key) {
    return {
      configurable: true,
      enumerable: true,
      value: readModelValue(key as string),
    };
  },
  has(_target, key) {
    return key in (form.state.values ?? {});
  },
  ownKeys() {
    return Reflect.ownKeys(form.state.values ?? {});
  },
  set(_target, key, value) {
    if (typeof key !== 'symbol') form.setFieldValue(key, value);
    return true;
  },
});

// ============ 合并 props（schemas 不参与合并） ============
const getProps = computed(() => {
  const merged = deepMerge({ ...props }, { ...unref(propsRef) }) as FormProps;
  merged.schemas = unref(schemaRef);
  return merged;
});

// ============ 实际生效的列数 ============
const effectiveCols = computed(() => {
  const configured = getProps.value.grid?.cols;
  if (configured != null && configured >= 1 && configured <= 4)
    return configured;
  return responsiveCols.value;
});

const gridColSpan = computed(() => Math.floor(24 / effectiveCols.value));

const gutterComputed = computed(
  () => getProps.value.grid?.gutter ?? 24,
) as ComputedRef<[number, number] | number>;

/** 行内边距取 gutter 的水平分量，行容器与字段各吃掉一半 */
const gutterPx = computed(() => {
  const raw = unref(gutterComputed);
  return Array.isArray(raw) ? (raw[0] ?? 24) : (raw ?? 24);
});

/** `gutter` 没给垂直分量时的行间距 */
const DEFAULT_ROW_GAP_PX = 16;

/**
 * 行与行（以及行内换行后）的垂直间距。
 *
 * antd 的 `gutter` 只有写成 `[水平, 垂直]` 才有垂直分量，单值时垂直为 0；
 * 字段本身带 `min-h-9`，两行贴在一起就是一屏拥挤，所以要兜一个默认值。
 */
const rowGapPx = computed(() => {
  const raw = unref(gutterComputed);
  return (Array.isArray(raw) ? raw[1] : undefined) ?? DEFAULT_ROW_GAP_PX;
});

const formActionTypeRef = ref<FormActionType | null>(null) as Ref<any>;

/** 是否已经尝试过提交（校验失败时用于决定错误信息是否展示） */
const submitAttemptedRef = ref(false);

const getLabelCol = computed(() => {
  const labelWidth = getProps.value.labelWidth;
  if (labelWidth) {
    return { style: { width: `${labelWidth}px` } };
  }
  return getProps.value.labelCol || { span: 4 };
});

provide<FormContext>(FORM_CONTEXT_KEY, {
  form,
  getProps,
  labelCol: getLabelCol,
  wrapperCol: computed(() => getProps.value.wrapperCol || { span: 18 }),
  grid: {
    cols: effectiveCols,
    span: gridColSpan,
    gutter: gutterComputed,
  },
  formActionTypeRef,
  submitAttempted: submitAttemptedRef,
  getValues,
  model: formModel,
});

// ============ 折叠行数 ============
const alwaysShowLines = computed(() => getProps.value.alwaysShowLines ?? 3);

// ============ 核心：按行分组 ============
const allRows = computed<FormSchema[][]>(() => {
  const schemas = unref(schemaRef) || [];
  const defaultSpan = gridColSpan.value;
  const rows: FormSchema[][] = [];
  let currentRow: FormSchema[] = [];
  let currentSpan = 0;

  for (const schema of schemas) {
    if (!schema) continue;
    if (!schema.field && schema.component !== 'Divider') continue;

    if (schema.component === 'Divider') {
      if (currentRow.length > 0) {
        rows.push(currentRow);
        currentRow = [];
        currentSpan = 0;
      }
      rows.push([schema]);
      continue;
    }

    const span = (schema.colProps?.span ?? defaultSpan) as number;
    if (currentSpan + span > 24) {
      if (currentRow.length > 0) rows.push(currentRow);
      currentRow = [schema];
      currentSpan = span;
    } else {
      currentRow.push(schema);
      currentSpan += span;
    }
  }
  if (currentRow.length > 0) rows.push(currentRow);
  return rows;
});

const needCollapse = computed(() => {
  return (
    !!getProps.value.showAdvancedButton &&
    allRows.value.length > alwaysShowLines.value
  );
});

const displayRows = computed<FormSchema[][]>(() => {
  const rows = allRows.value;
  if (needCollapse.value && !unref(isAdvanced)) {
    return rows.slice(0, alwaysShowLines.value);
  }
  return rows;
});

// ============ 行容器样式（gutter 负边距，FormField 自带左右 padding） ============
const rowStyle = computed<Record<string, any>>(() => {
  const g = gutterPx.value;
  const gap = rowGapPx.value;
  return {
    display: 'flex',
    flexWrap: 'wrap',
    // 行内换行后的行间距，与行和行之间的间距同一个值
    marginBottom: `${gap}px`,
    marginLeft: `-${g / 2}px`,
    marginRight: `-${g / 2}px`,
    rowGap: `${gap}px`,
    ...getProps.value.baseRowStyle,
  };
});

const isDividerRow = (row: FormSchema[]) =>
  row.length === 1 && row[0]?.component === 'Divider';

// ============ 按钮配置 ============
const getSubmitButtonOptions = computed(() => ({
  text: '查询',
  preIcon: 'carbon:search',
  ...getProps.value.submitButtonOptions,
}));

const getResetButtonOptions = computed(() => ({
  text: '重置',
  preIcon: 'carbon:restart',
  ...getProps.value.resetButtonOptions,
}));

const getAdvancedButtonOptions = computed(() => ({
  text: unref(isAdvanced) ? '收起' : '展开',
  icon: unref(isAdvanced) ? 'carbon:chevron-up' : 'carbon:chevron-down',
}));

// ============ 默认值 ============
function initFormModel() {
  const schemas = unref(schemaRef) || [];
  schemas.forEach((schema) => {
    if (!schema) return;
    if (schema.field && schema.defaultValue !== undefined) {
      defaults[schema.field] = schema.defaultValue;
      form.setFieldValue(schema.field as any, schema.defaultValue);
    }
  });
}

// ============ 表单验证 ============
function collectValues(nameList?: NamePath[]): Recordable {
  const all = { ...(form.state.values ?? {}) };
  if (!nameList || nameList.length === 0) return all;
  const picked: Recordable = {};
  nameList.forEach((name) => {
    const key = String(name);
    picked[key] = all[key];
  });
  return picked;
}

async function validate(nameList?: NamePath[]): Promise<Recordable> {
  const schemas = unref(schemaRef) || [];
  const candidateFields =
    nameList && nameList.length > 0
      ? nameList.map((n) => String(n))
      : schemas.filter((s) => s && s.field).map((s) => s.field);

  submitAttemptedRef.value = true;

  await Promise.all(
    candidateFields.map(async (field) => {
      try {
        await form.validateField(field as any, 'submit');
      } catch {
        // validateField 内部已把错误写入 meta，这里忽略 rejection
      }
    }),
  );

  const errorFields: { errors: string[]; name: string }[] = [];
  candidateFields.forEach((field) => {
    const meta = form.getFieldMeta(field as any);
    const errors = (meta?.errors ?? []) as string[];
    // change/submit 两种 cause 会分别写入，同文案去重后对外只报一条
    const unique = [...new Set(errors.map((e) => String(e)))];
    if (unique.length > 0) {
      errorFields.push({ errors: unique, name: field });
    }
  });

  const values = collectValues(nameList);

  if (errorFields.length > 0) {
    if (getProps.value.scrollToFirstError !== false) {
      void scrollToField(errorFields[0]?.name ?? '');
    }
    /**
     * 拒绝对象的形状照 antd：`name` 是字段路径数组，`message` 是第一条错误文案，
     * 页面用它拼提示语（`steps` 还按 `errorFields[0].name[0]` 反查该跳回哪一步）。
     */
    const failure: FormValidateError = {
      errorFields: errorFields.map(({ errors, name }) => ({
        errors,
        name: [name],
      })),
      message: errorFields[0]?.errors[0],
      outOfDate: false,
      values,
    };
    throw failure;
  }

  let processed = formatDateFields(values, schemas);
  const fieldMapToTime = getProps.value.fieldMapToTime;
  return fieldMapToTime
    ? handleRangeValue(processed, fieldMapToTime)
    : processed;
}

async function validateFields(nameList?: NamePath[]): Promise<Recordable> {
  return validate(nameList);
}

// ============ 提交 ============
async function handleSubmit() {
  try {
    const values = await validate();
    if (values) {
      const schemas = unref(schemaRef) || [];
      let processed = formatDateFields({ ...values }, schemas);
      const fieldMapToTime = getProps.value.fieldMapToTime;
      if (fieldMapToTime)
        processed = handleRangeValue(processed, fieldMapToTime);

      if (typeof attrs.onFinish === 'function') {
        (attrs.onFinish as (v: Recordable) => void)(processed);
      } else if (getProps.value.submitFunc) {
        await getProps.value.submitFunc();
      } else {
        emit('submit', processed);
      }
    }
  } catch (error) {
    console.error('Form submit error:', error);
  }
}

// ============ 重置 ============
async function handleReset() {
  if (getProps.value.resetFunc) {
    await getProps.value.resetFunc();
    return;
  }
  const values = { ...(form.state.values ?? {}) };
  await resetFields();
  if (getProps.value.submitOnReset) {
    await handleSubmit();
  } else {
    emit('reset', values);
  }
}

// ============ 展开/收缩 ============
function toggleAdvanced() {
  isAdvanced.value = !unref(isAdvanced);
}

// ============ 字段操作 ============
async function resetFields() {
  submitAttemptedRef.value = false;
  form.reset({ ...unref(defaults) });
}

async function setFieldsValue<T>(values: T) {
  Object.keys(values as any).forEach((key) => {
    form.setFieldValue(key as any, (values as any)[key]);
  });
}

function getFieldsValue(): Recordable {
  return { ...(form.state.values ?? {}) };
}

async function clearValidate(name?: string | string[]) {
  const schemas = unref(schemaRef) || [];
  const fields = name
    ? Array.isArray(name)
      ? name
      : [name]
    : schemas.filter((s) => s && s.field).map((s) => s.field);
  fields.forEach((field) => {
    form.setFieldMeta(field as any, (meta: any) => ({
      ...meta,
      // errors 由 errorMap 派生，必须清空 errorMap 才能真正抹掉错误
      errorMap: {},
      errors: [],
      isTouched: false,
      isBlurred: false,
    }));
  });
  submitAttemptedRef.value = false;
}

async function scrollToField(name: NamePath, options?: ScrollIntoViewOptions) {
  const el = rootRef.value?.querySelector(
    `[data-field="${CSS.escape(String(name))}"]`,
  );
  el?.scrollIntoView?.(options ?? { behavior: 'smooth', block: 'center' });
}

async function updateSchema(data: Partial<FormSchema> | Partial<FormSchema>[]) {
  const updateData = Array.isArray(data) ? data : [data];
  updateData.forEach((item) => {
    if (!item || !item.field) return;
    const index = schemaRef.value.findIndex((s) => s && s.field === item.field);
    if (index !== -1 && schemaRef.value[index]) {
      schemaRef.value[index] = deepMerge(
        schemaRef.value[index],
        item,
      ) as FormSchema;
    }
  });
}

async function removeSchemaByField(field: string | string[]) {
  const fields = Array.isArray(field) ? field : [field];
  schemaRef.value = schemaRef.value.filter(
    (s) => s && !fields.includes(s.field),
  );
}

async function appendSchemaByField(
  schema: FormSchema,
  prefixField?: string,
  first?: boolean,
) {
  if (!schema) return;
  if (prefixField) {
    const index = schemaRef.value.findIndex(
      (s) => s && s.field === prefixField,
    );
    if (index !== -1) {
      schemaRef.value.splice(first ? index : index + 1, 0, schema);
    }
  } else {
    if (first) schemaRef.value.unshift(schema);
    else schemaRef.value.push(schema);
  }
  initFormModel();
}

async function setProps(newProps: Partial<FormProps>) {
  // schemas 单独处理，绝不进入 propsRef，避免合并时数组被拼接
  const { schemas, ...rest } = newProps;
  propsRef.value = deepMerge(unref(propsRef) || {}, rest);
  if (schemas) {
    schemaRef.value = schemas;
    initFormModel();
  }
}

function getForm(): any {
  return form;
}

/** 是否还挂在组件树上（useForm 依赖它把写值转成待写入队列） */
const isMountedRef = ref(false);

const formActionType: FormActionType = {
  getFieldsValue,
  setFieldsValue,
  resetFields,
  validate,
  validateFields,
  submit: handleSubmit,
  clearValidate,
  scrollToField,
  updateSchema,
  removeSchemaByField,
  appendSchemaByField,
  setProps,
  getForm,
  isMounted: () => isMountedRef.value,
};

formActionTypeRef.value = formActionType;

// 去掉 deep: true，避免深层监听引起重复触发
// 外部若需原地修改 schema，请改用 setProps / updateSchema
watch(
  () => props.schemas,
  (schemas) => {
    if (schemas) {
      schemaRef.value = schemas;
      initFormModel();
    }
  },
  { immediate: true },
);

onMounted(() => {
  isMountedRef.value = true;
  emit('register', formActionType);
});

onBeforeUnmount(() => {
  isMountedRef.value = false;
});

defineExpose(formActionType);
</script>

<template>
  <form ref="rootRef" @submit.prevent="handleSubmit">
    <div
      v-for="(row, rowIndex) in displayRows"
      :key="`row-${rowIndex}`"
      class="form-row"
      :style="rowStyle"
    >
      <template v-if="isDividerRow(row)">
        <div class="w-full shrink-0 box-border" :style="rowStyle">
          <div class="flex min-h-9 items-center gap-2">
            <Separator class="flex-1" />
            <span class="text-sm text-muted-foreground">{{
              row[0]?.label
            }}</span>
            <Separator class="flex-1" />
          </div>
        </div>
      </template>

      <template v-else>
        <FormField v-for="schema in row" :key="schema.field" :schema="schema">
          <template
            v-for="(_, slotName) in $slots"
            :key="slotName"
            #[slotName]="slotProps"
          >
            <slot :name="slotName" v-bind="slotProps"></slot>
          </template>
        </FormField>
      </template>
    </div>

    <!-- 操作按钮 -->
    <FormActions
      v-if="getProps.showActionButtonGroup"
      :action-col-style="getProps.actionColOptions?.style"
      :advanced-options="getAdvancedButtonOptions"
      :collapse="needCollapse"
      :disabled="getProps.disabled"
      :gutter-px="gutterPx"
      :reset-options="getResetButtonOptions"
      :row-style="rowStyle"
      :show-reset="getProps.showResetButton"
      :show-submit="getProps.showSubmitButton"
      :submit-options="getSubmitButtonOptions"
      @reset="handleReset"
      @toggle-advanced="toggleAdvanced"
    >
      <template #submitBefore>
        <slot name="submitBefore"></slot>
      </template>
      <template #resetBefore>
        <slot name="resetBefore"></slot>
      </template>
      <template #actionAfter>
        <slot name="actionAfter"></slot>
      </template>
    </FormActions>
  </form>
</template>
