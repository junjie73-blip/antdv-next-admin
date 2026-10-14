<script setup lang="ts">
import type { ComponentType, FormSchema } from '@antdv/form-ui';

import { ref } from 'vue';

import { Card, Scrollbar } from '@antdv/common-ui';
import { BasicForm, useForm, addComponent } from '@antdv/form-ui';
import { message } from '@antdv/popup-ui';
import { Button } from '@antdv/shadcn-ui';

import { cn } from '@antdv/shared/cn';

import TagPickerField from './components/TagPickerField.vue';

/**
 * 自定义字段示例页。
 *
 * 讲的不是 antd 的控件，而是本仓库 `BasicForm`（`@antdv/form-ui`）的字段扩展机制：
 * schema 里的 `component` 是一个**查表用的字符串键**（`FormItem.vue` → `getComponent(schema.component)`），
 * 表就是 `componentMap.ts`，往表里加一行的官方入口是 `addComponent(name, component)`。
 */

// 根容器不带内边距，内边距由布局统一给
const containerClassName = cn('space-y-6');
const introClassName = cn(
  'mb-4 text-sm/relaxed text-gray-600 dark:text-gray-400',
);
const inlineCodeClassName = cn(
  'rounded-sm bg-gray-100 px-1 font-mono text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300',
);
const jsonBoxClassName = cn(
  'mt-4 rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800',
);
const jsonClassName = cn('m-0 p-4 font-mono text-xs/relaxed');

/**
 * `addComponent` 加进表里的键不在内置的 `ComponentType` 联合类型里
 * （那个联合只穷举了内置那批组件名），而运行时 `getComponent()` 只是按字符串取值，没有这层限制。
 * 所以自定义字段名要收口一次类型。
 */
const TAG_FIELD = 'TagPickerField' as unknown as ComponentType;

/** 演示用 schema：允许写自定义注册名，以及该组件自己的 props */
type DemoSchema = Omit<FormSchema, 'component' | 'componentProps'> & {
  component?: 'TagPickerField' | ComponentType;
  componentProps?: Record<string, any>;
};

function toSchemas(list: DemoSchema[]): FormSchema[] {
  return list as unknown as FormSchema[];
}

// ============================================================
// 1. 内置扩展字段
// ============================================================
const [registerBuiltin] = useForm({
  labelWidth: 100,
  showActionButtonGroup: false,
  schemas: toSchemas([
    {
      field: 'document',
      label: '公告正文',
      component: 'MarkdownEditor',
      colProps: { span: 24 },
      defaultValue:
        '<p>这一段由 <strong>MarkdownEditor</strong> 扩展字段产出。</p>',
      componentProps: { mode: 'edit', height: 180 },
      helpMessage:
        'componentMap 里注册的仓库自研组件，按名字写进 schema 就能用',
    },
    {
      // Divider 是 BasicForm 自己按行处理的 schema：独占一行，label 当文案
      field: 'builtinDivider',
      component: 'Divider',
      label: '同一张表里的 ASelect / ATreeSelect：接口驱动，传 api 即自动取数',
    },
    {
      field: 'preview',
      label: '只读预览',
      component: 'MarkdownEditor',
      colProps: { span: 24 },
      defaultValue:
        '<p>组件名不变，只把 <code>componentProps</code> 换成 mode: preview，字段就变成只读预览。</p>',
      componentProps: { mode: 'preview', height: 120 },
    },
  ]),
});

// ============================================================
// 2. 注册自定义字段
// ============================================================

/**
 * 注册本身只有一行：把页面私有的字段组件挂到 `componentMap` 上。
 * 之后任何表单的 schema 里写 `component: 'TagPickerField'` 都能拿到它。
 */
addComponent('TagPickerField', TagPickerField);

const [registerCustom] = useForm({
  labelWidth: 100,
  showActionButtonGroup: false,
  schemas: toSchemas([
    {
      field: 'channels',
      label: '推送渠道',
      component: TAG_FIELD,
      colProps: { span: 12 },
      defaultValue: ['站内信'],
      componentProps: {
        options: ['邮件', '短信', '站内信', '钉钉', '企业微信'],
        max: 3,
      },
      helpMessage: 'componentProps 会原样透传给注册的组件',
    },
    {
      field: 'keywords',
      label: '关键词',
      component: TAG_FIELD,
      colProps: { span: 12 },
      componentProps: { max: 6, placeholder: '输入后回车添加' },
    },
  ]),
});

// ============================================================
// 3. 字段联动
// ============================================================
const [registerLinked] = useForm({
  labelWidth: 100,
  grid: { cols: 2 },
  schemas: toSchemas([
    {
      field: 'scheduled',
      label: '启用定时推送',
      component: 'Switch',
      defaultValue: false,
      helpMessage:
        '联动读的就是 formModel，Switch 也按 value / update:value 接',
    },
    {
      field: 'groups',
      label: '推送群组',
      component: TAG_FIELD,
      ifShow: ({ values }) => values.scheduled === true,
      dynamicRules: ({ values }) =>
        values.scheduled === true
          ? [{ required: true, message: '开启定时推送后，至少选择一个群组' }]
          : [],
      componentProps: {
        options: ['研发', '运营', '财务', '管理层'],
        max: 3,
      },
    },
    {
      field: 'sender',
      label: '抄送人',
      component: 'Input',
      show: ({ values }) => values.scheduled === true,
      componentProps: { placeholder: '只是被 v-show 藏起来了' },
    },
    {
      field: 'note',
      label: '备注',
      component: 'InputTextArea',
      colProps: { span: 24 },
      dynamicDisabled: ({ values }) => values.scheduled !== true,
      componentProps: { rows: 2, placeholder: '开关打开后才能编辑' },
    },
  ]),
  submitButtonOptions: { text: '提交', preIcon: 'carbon:checkmark' },
});

function handleLinkedSubmit(values: Record<string, any>) {
  message.success(`联动校验通过：${JSON.stringify(values)}`);
}

// ============================================================
// 4. 校验与取值
// ============================================================
const [registerCollect, { getFieldsValue, resetFields, validate }] = useForm({
  labelWidth: 100,
  showActionButtonGroup: false,
  schemas: toSchemas([
    {
      field: 'title',
      label: '标题',
      component: 'Input',
      colProps: { span: 12 },
      required: true,
    },
    {
      field: 'tags',
      label: '标签',
      component: TAG_FIELD,
      colProps: { span: 12 },
      rules: [
        { required: true, message: '请至少添加一个标签' },
        {
          validator: (_rule: unknown, value: unknown) =>
            Array.isArray(value) && value.length >= 2
              ? Promise.resolve()
              : Promise.reject(new Error('标签至少要有 2 个，便于后续筛选')),
        },
      ],
      componentProps: {
        options: ['重要', '紧急', '日常', '归档'],
        max: 4,
      },
    },
  ]),
});

const collected = ref<Record<string, any>>({});

async function handleValidate() {
  try {
    const values = await validate();
    collected.value = values;
    message.success('校验通过，已取到表单值');
  } catch {
    collected.value = {};
    message.error('校验未通过，提交被拦截');
  }
}

function handleRawValues() {
  collected.value = getFieldsValue();
  message.info('已取到当前模型值（未校验）');
}

function handleReset() {
  void resetFields();
  collected.value = {};
  message.info('已重置为 schema 的 defaultValue');
}
</script>

<template>
  <div :class="containerClassName">
    <Card title="内置扩展字段" variant="borderless">
      <div :class="introClassName">
        <code :class="inlineCodeClassName">componentMap.ts</code>
        在 antd 基础控件之外还注册了本仓库自己的字段：
        <code :class="inlineCodeClassName">MarkdownEditor</code>（富文本，value
        存 HTML）、 <code :class="inlineCodeClassName">ASelect</code> /
        <code :class="inlineCodeClassName">ATreeSelect</code>（接口驱动，传一个
        <code :class="inlineCodeClassName">api</code>
        字符串就自己取数，本页不打后端，所以只在分隔线里点名）。写 schema
        时只需要给组件名，不需要 import 组件本身。
      </div>
      <BasicForm @register="registerBuiltin" />
    </Card>

    <Card title="注册自定义字段" variant="borderless">
      <div :class="introClassName">
        下面这两个字段用的是本页私有组件
        <code :class="inlineCodeClassName">components/TagPickerField.vue</code
        >， 注册只有一行
        <code :class="inlineCodeClassName"
          >addComponent('TagPickerField', TagPickerField)</code
        >：
        表是全局的，注册一次之后所有表单都能按名字引用它。字段组件要满足的契约也很小
        —— 接收 <code :class="inlineCodeClassName">value</code> 这个
        prop、改动后
        <code :class="inlineCodeClassName">emit('update:value', 新值)</code>，
        <code :class="inlineCodeClassName">FormItem.vue</code>
        渲染时统一按这对名字接。裸
        <code :class="inlineCodeClassName">a-form</code>
        做不到这件事，因为它只认你手写在模板里的标签，每加一个字段都要再写一遍
        v-model 绑定；而 BasicForm 把「名字 → 组件 →
        取值/回填」这套映射收敛成了一张表。 不想注册组件时也有逃生口：给 schema
        写
        <code :class="inlineCodeClassName">slot</code>，直接在页面模板里放控件。
      </div>
      <BasicForm @register="registerCustom" />
    </Card>

    <Card title="字段联动" variant="borderless">
      <div :class="introClassName">
        BasicForm 每渲染一个字段都会用当前
        <code :class="inlineCodeClassName">formModel</code>
        去算三个开关：<code :class="inlineCodeClassName">ifShow</code>（为假时连
        <code :class="inlineCodeClassName">a-form-item</code>
        都不渲染，字段自然不参与校验）、
        <code :class="inlineCodeClassName">show</code>（只是
        <code :class="inlineCodeClassName">v-show</code> 隐藏，仍然参与校验）、
        <code :class="inlineCodeClassName">dynamicDisabled</code
        >（算出禁用态）， 规则还能用
        <code :class="inlineCodeClassName">dynamicRules</code>
        跟着值变。自定义字段同样吃这套配置 —— 「推送群组」就是刚注册的那个组件。
      </div>
      <BasicForm @register="registerLinked" @submit="handleLinkedSubmit" />
    </Card>

    <Card title="校验与取值" variant="borderless">
      <div :class="introClassName">
        校验走 <code :class="inlineCodeClassName">useForm()</code> 返回的
        <code :class="inlineCodeClassName">validate()</code>：通过就 resolve
        出本次值， 自定义字段的
        <code :class="inlineCodeClassName">validator</code>
        不通过则 reject，提交被拦在本地，不发任何请求。
      </div>
      <div class="mb-4 flex flex-wrap gap-2">
        <Button @click="handleValidate"> 校验并取值 </Button>
        <Button variant="outline" @click="handleRawValues">
          取当前值（不校验）
        </Button>
        <Button variant="outline" @click="handleReset"> 重置 </Button>
      </div>
      <BasicForm @register="registerCollect" />
      <Scrollbar :root-class="jsonBoxClassName">
        <pre :class="jsonClassName">{{
          JSON.stringify(collected, null, 2)
        }}</pre>
      </Scrollbar>
    </Card>
  </div>
</template>
