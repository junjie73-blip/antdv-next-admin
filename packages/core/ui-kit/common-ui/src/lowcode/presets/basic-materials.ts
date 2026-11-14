import type { PropType, VNode } from 'vue';

import type { ComponentMeta, MaterialEntry } from '../core/types';

import { defineComponent, h, markRaw } from 'vue';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

/**
 * 最小物料集：每个都只是 `@antdv/shadcn-ui` 控件的一层薄壳。
 *
 * 分层位置：`presets/`，是**唯一**允许在这里出现 Vue 组件与 shadcn 控件的地方之一
 * （另一处是 `components/*`）。之所以用 `h()` 而不是 `.vue`：物料的形状是「一堆 props +
 * 一个控件」，写成模板会让八个文件各带一份 defineProps 样板，而注册表需要的元数据本来
 * 就在这里，两者对齐读起来更省事。
 *
 * 本文件**不做**的事：不取数、不认识 scope（值的绑定在渲染器里已经解开了）、
 * 不做业务组件。宿主的业务物料请用自己的 `MaterialEntry[]` 经 `configureLowcode({ components })` 注入。
 */

/** 与 shadcn `buttonVariants` 对齐的字面量；渲染时从 Schema 的 string 收窄回来 */
type ButtonVariant =
  | 'default'
  | 'destructive'
  | 'ghost'
  | 'link'
  | 'outline'
  | 'secondary';
type ButtonSize =
  | 'default'
  | 'icon'
  | 'icon-lg'
  | 'icon-sm'
  | 'icon-xs'
  | 'lg'
  | 'sm'
  | 'xs';

export const MATERIAL_GROUP_BASIC = '基础';
export const MATERIAL_GROUP_FORM = '表单';
export const MATERIAL_GROUP_LAYOUT = '布局';

const TEXT_LEVELS = [
  { label: '正文', value: 'body' },
  { label: '标题', value: 'title' },
  { label: '说明', value: 'caption' },
];

const VARIANT_OPTIONS = [
  { label: '主按钮', value: 'default' },
  { label: '次级', value: 'secondary' },
  { label: '描边', value: 'outline' },
  { label: '危险', value: 'destructive' },
  { label: '无边框', value: 'ghost' },
  { label: '链接', value: 'link' },
];

interface TableColumn {
  key: string;
  title: string;
  /** 列宽（Tailwind 工具类），宿主可自行加 */
  width?: string;
}

/* -------------------------------- 文本 -------------------------------- */

const TextMaterial = defineComponent({
  name: 'BasicText',
  props: {
    level: { default: 'body', type: String },
    text: { default: '', type: String },
  },
  setup(props) {
    // title 用 h3 而不是 h1：搭建页几乎都嵌在已有标题的容器里，层级由宿主决定
    const tag = () =>
      props.level === 'title' ? 'h3' : props.level === 'caption' ? 'p' : 'p';
    const klass = () =>
      cn(
        'wrap-break-word',
        props.level === 'title' ? 'text-base font-semibold' : '',
        props.level === 'caption' ? 'text-muted-foreground text-xs' : 'text-sm',
      );
    return () => h(tag(), { class: klass() }, props.text);
  },
});

export const textMeta: ComponentMeta = {
  container: false,
  group: MATERIAL_GROUP_BASIC,
  name: '文本',
  props: [
    { default: '一段文本', key: 'text', kind: 'textarea', label: '内容' },
    {
      default: 'body',
      key: 'level',
      kind: 'select',
      label: '层级',
      options: TEXT_LEVELS,
    },
  ],
  type: 'basic.text',
};

/* -------------------------------- 按钮 -------------------------------- */

const ButtonMaterial = defineComponent({
  name: 'BasicButton',
  props: {
    disabled: { default: false, type: Boolean },
    label: { default: '按钮', type: String },
    size: { default: 'default', type: String },
    variant: { default: 'default', type: String },
  },
  emits: { click: () => true },
  setup(props, { emit }) {
    return () =>
      h(
        Button,
        {
          disabled: props.disabled,
          size: props.size as ButtonSize,
          variant: props.variant as ButtonVariant,
          onClick: () => emit('click'),
        },
        () => props.label,
      );
  },
});

export const buttonMeta: ComponentMeta = {
  container: false,
  description: '点击可在事件里配 set:/push:/emit: 动作',
  events: [{ label: '点击', name: 'click' }],
  group: MATERIAL_GROUP_BASIC,
  name: '按钮',
  props: [
    { default: '提交', key: 'label', kind: 'string', label: '文案' },
    {
      default: 'default',
      key: 'variant',
      kind: 'select',
      label: '样式',
      options: VARIANT_OPTIONS,
    },
    {
      default: 'default',
      key: 'size',
      kind: 'select',
      label: '尺寸',
      options: [
        { label: '中', value: 'default' },
        { label: '小', value: 'sm' },
        { label: '大', value: 'lg' },
      ],
    },
    { default: false, key: 'disabled', kind: 'boolean', label: '禁用' },
  ],
  type: 'basic.button',
};

/* ------------------------------- 输入框 ------------------------------- */

const InputMaterial = defineComponent({
  name: 'BasicInput',
  props: {
    disabled: { default: false, type: Boolean },
    modelValue: { default: '', type: String },
    placeholder: { default: '', type: String },
  },
  emits: { 'update:modelValue': (value: string) => typeof value === 'string' },
  setup(props, { emit }) {
    return () =>
      h(Input, {
        disabled: props.disabled,
        modelValue: props.modelValue,
        placeholder: props.placeholder,
        'onUpdate:modelValue': (value: number | string) =>
          emit('update:modelValue', String(value ?? '')),
      });
  },
});

export const inputMeta: ComponentMeta = {
  container: false,
  description: '值配成 {{ 路径 }} + 事件 set: 同一路径，就是双向绑定',
  events: [{ label: '值变化', name: 'update:modelValue', twoWay: true }],
  group: MATERIAL_GROUP_FORM,
  name: '输入框',
  props: [
    {
      default: '',
      description: '写成 {{ form.name }} 即为绑定值',
      key: 'modelValue',
      kind: 'string',
      label: '绑定值',
    },
    {
      default: '请输入',
      key: 'placeholder',
      kind: 'string',
      label: '占位提示',
    },
    { default: false, key: 'disabled', kind: 'boolean', label: '禁用' },
  ],
  type: 'basic.input',
};

/* --------------------------- 标签 + 输入组合 --------------------------- */

const FieldMaterial = defineComponent({
  name: 'BasicField',
  props: {
    disabled: { default: false, type: Boolean },
    label: { default: '标签', type: String },
    modelValue: { default: '', type: String },
    multiline: { default: false, type: Boolean },
    placeholder: { default: '', type: String },
    required: { default: false, type: Boolean },
  },
  emits: { 'update:modelValue': (value: string) => typeof value === 'string' },
  setup(props, { emit }) {
    return () =>
      h('div', { class: 'flex w-full flex-col gap-1.5' }, [
        h(
          Label,
          { class: props.required ? 'text-destructive' : undefined },
          () => (props.required ? `${props.label} *` : props.label),
        ),
        props.multiline
          ? h(Textarea, {
              class: 'min-h-16',
              disabled: props.disabled,
              modelValue: props.modelValue,
              placeholder: props.placeholder,
              'onUpdate:modelValue': (value: number | string) =>
                emit('update:modelValue', String(value ?? '')),
            })
          : h(Input, {
              disabled: props.disabled,
              modelValue: props.modelValue,
              placeholder: props.placeholder,
              'onUpdate:modelValue': (value: number | string) =>
                emit('update:modelValue', String(value ?? '')),
            }),
      ]);
  },
});

export const fieldMeta: ComponentMeta = {
  container: false,
  description: '带标题的输入，表单里最常用的一块',
  events: [{ label: '值变化', name: 'update:modelValue', twoWay: true }],
  group: MATERIAL_GROUP_FORM,
  name: '标签输入',
  props: [
    { default: '名称', key: 'label', kind: 'string', label: '标题' },
    {
      default: '',
      description: '写成 {{ form.name }} 即为绑定值',
      key: 'modelValue',
      kind: 'string',
      label: '绑定值',
    },
    {
      default: '请输入',
      key: 'placeholder',
      kind: 'string',
      label: '占位提示',
    },
    { default: false, key: 'multiline', kind: 'boolean', label: '多行' },
    { default: false, key: 'required', kind: 'boolean', label: '必填' },
    { default: false, key: 'disabled', kind: 'boolean', label: '禁用' },
  ],
  type: 'basic.field',
};

/* -------------------------------- 卡片 -------------------------------- */

const CardMaterial = defineComponent({
  name: 'BasicCard',
  props: {
    description: { default: '', type: String },
    title: { default: '', type: String },
  },
  setup(props, { slots }) {
    // footer 是显式声明的具名插槽，落进 CardFooter；其余子节点进 CardContent
    return () => {
      const header =
        props.title || props.description
          ? h(CardHeader, null, () => [
              props.title ? h(CardTitle, null, () => props.title) : null,
              props.description
                ? h(CardDescription, null, () => props.description)
                : null,
            ])
          : null;
      const body = h(CardContent, null, () => slots.default?.() ?? []);
      const footer = slots.footer
        ? h(CardFooter, null, () => slots.footer?.() ?? [])
        : null;
      const children = [header, body, footer].filter(
        (item): item is VNode => item !== null,
      );
      // 子节点一律用函数插槽：给组件传数组会触发 Vue 的 "Non-function value for default slot"，
      // 物料是别人抄的样板，样板上不该留警告
      return h(Card, null, () => children);
    };
  },
});

export const cardMeta: ComponentMeta = {
  container: true,
  description: '可以往里拖子节点；footer 插槽放操作按钮',
  group: MATERIAL_GROUP_LAYOUT,
  name: '卡片',
  props: [
    { default: '卡片标题', key: 'title', kind: 'string', label: '标题' },
    { default: '', key: 'description', kind: 'string', label: '描述' },
  ],
  slots: ['footer'],
  type: 'basic.card',
};

/* ------------------------------- 下拉选择 ------------------------------- */

const SelectMaterial = defineComponent({
  name: 'BasicSelect',
  props: {
    disabled: { default: false, type: Boolean },
    modelValue: { default: '', type: String },
    options: {
      default: () => [],
      type: Array as PropType<
        Array<{ label?: string; value?: boolean | number | string }>
      >,
    },
    placeholder: { default: '请选择', type: String },
  },
  emits: { 'update:modelValue': (value: string) => typeof value === 'string' },
  setup(props, { emit }) {
    const items = () =>
      (props.options ?? []).map((option, index) => {
        // 允许 `['a','b']` 这种偷懒写法：值即文案，省得宿主每处都补 label
        const raw =
          typeof option === 'string' || typeof option === 'number'
            ? option
            : option?.value;
        const value = String(raw ?? '');
        const label =
          typeof option === 'object' && option?.label
            ? String(option.label)
            : value;
        return h(SelectItem, { key: `${value}-${index}`, value }, () => label);
      });
    return () =>
      h(
        Select,
        {
          disabled: props.disabled,
          modelValue: props.modelValue,
          'onUpdate:modelValue': (value: unknown) =>
            emit('update:modelValue', String(value ?? '')),
        },
        () => [
          h(SelectTrigger, { class: 'w-full' }, () =>
            h(SelectValue, { placeholder: props.placeholder }),
          ),
          h(SelectContent, null, () => items()),
        ],
      );
  },
});

export const selectMeta: ComponentMeta = {
  container: false,
  description: '候选项写 JSON，也可以直接写成 {{ dict.statuses }}',
  events: [{ label: '值变化', name: 'update:modelValue', twoWay: true }],
  group: MATERIAL_GROUP_FORM,
  name: '下拉选择',
  props: [
    { default: '', key: 'modelValue', kind: 'string', label: '绑定值' },
    {
      default: '请选择',
      key: 'placeholder',
      kind: 'string',
      label: '占位提示',
    },
    {
      default: [{ label: '选项一', value: 'one' }],
      description: '[{ label, value }] 数组',
      key: 'options',
      kind: 'json',
      label: '候选项',
    },
    { default: false, key: 'disabled', kind: 'boolean', label: '禁用' },
  ],
  type: 'basic.select',
};

/* -------------------------------- 表格 -------------------------------- */

const TableMaterial = defineComponent({
  name: 'BasicTable',
  props: {
    columns: { default: () => [], type: Array as PropType<TableColumn[]> },
    emptyText: { default: '暂无数据', type: String },
    rows: {
      default: () => [],
      type: Array as PropType<Record<string, unknown>[]>,
    },
  },
  setup(props) {
    return () => {
      const columns = props.columns ?? [];
      const rows = props.rows ?? [];
      return h(Table, null, () => [
        h(TableHeader, null, () => [
          h(TableRow, null, () =>
            columns.map((column) =>
              h(TableHead, { key: column.key }, () => column.title),
            ),
          ),
        ]),
        rows.length === 0
          ? h(
              'div',
              { class: 'px-3 py-6 text-center text-muted-foreground text-sm' },
              props.emptyText,
            )
          : h(TableBody, null, () =>
              rows.map((row, rowIndex) =>
                h(TableRow, { key: rowIndex }, () =>
                  columns.map((column) => {
                    const cell = row?.[column.key];
                    return h(TableCell, { key: column.key }, () =>
                      cell === null || cell === undefined
                        ? ''
                        : typeof cell === 'object'
                          ? JSON.stringify(cell)
                          : String(cell),
                    );
                  }),
                ),
              ),
            ),
      ]);
    };
  },
});

export const tableMeta: ComponentMeta = {
  container: false,
  description: 'rows 通常写成 {{ 数据源写回的 path }}',
  group: MATERIAL_GROUP_BASIC,
  name: '表格',
  props: [
    {
      default: [{ key: 'name', title: '名称' }],
      description: '[{ key, title }] 数组',
      key: 'columns',
      kind: 'json',
      label: '列',
    },
    {
      default: [],
      description: '对象数组；绑定数据源就写 {{ rows }}',
      key: 'rows',
      kind: 'json',
      label: '数据',
    },
    {
      default: '暂无数据',
      key: 'emptyText',
      kind: 'string',
      label: '空态文案',
    },
  ],
  type: 'basic.table',
};

/* ------------------------------- 分隔线 ------------------------------- */

const SeparatorMaterial = defineComponent({
  name: 'BasicSeparator',
  props: {
    orientation: { default: 'horizontal', type: String },
  },
  setup(props) {
    return () =>
      h(Separator, {
        class: props.orientation === 'vertical' ? 'h-full' : undefined,
        orientation: props.orientation as 'horizontal' | 'vertical',
      });
  },
});

export const separatorMeta: ComponentMeta = {
  container: false,
  group: MATERIAL_GROUP_LAYOUT,
  name: '分隔线',
  props: [
    {
      default: 'horizontal',
      key: 'orientation',
      kind: 'select',
      label: '方向',
      options: [
        { label: '横向', value: 'horizontal' },
        { label: '纵向', value: 'vertical' },
      ],
    },
  ],
  type: 'basic.separator',
};

/* -------------------------------- 徽标 -------------------------------- */

const BadgeMaterial = defineComponent({
  name: 'BasicBadge',
  props: {
    text: { default: '标签', type: String },
    variant: { default: 'default', type: String },
  },
  setup(props) {
    return () =>
      h(
        Badge,
        {
          variant: props.variant as
            | 'default'
            | 'destructive'
            | 'outline'
            | 'secondary',
        },
        () => props.text,
      );
  },
});

export const badgeMeta: ComponentMeta = {
  container: false,
  group: MATERIAL_GROUP_BASIC,
  name: '徽标',
  props: [
    { default: '进行中', key: 'text', kind: 'string', label: '文案' },
    {
      default: 'default',
      key: 'variant',
      kind: 'select',
      label: '样式',
      options: [
        { label: '主色', value: 'default' },
        { label: '次级', value: 'secondary' },
        { label: '危险', value: 'destructive' },
        { label: '描边', value: 'outline' },
      ],
    },
  ],
  type: 'basic.badge',
};

/**
 * 出厂物料：`configureLowcode({ components: builtinMaterials })` 一行就能跑，
 * 其实不写也在（runtime 缺省 `useBuiltinMaterials: true`），显式注入是给「只想要其中几个」的宿主用的。
 */
export const builtinMaterials: MaterialEntry[] = [
  { component: markRaw(ButtonMaterial), meta: buttonMeta },
  { component: markRaw(BadgeMaterial), meta: badgeMeta },
  { component: markRaw(CardMaterial), meta: cardMeta },
  { component: markRaw(FieldMaterial), meta: fieldMeta },
  { component: markRaw(InputMaterial), meta: inputMeta },
  { component: markRaw(SelectMaterial), meta: selectMeta },
  { component: markRaw(SeparatorMaterial), meta: separatorMeta },
  { component: markRaw(TableMaterial), meta: tableMeta },
  { component: markRaw(TextMaterial), meta: textMeta },
];

/** type -> meta，面板与体检之外宿主也常按 type 反查 */
export const builtinMaterialMetas: ComponentMeta[] = builtinMaterials.map(
  (entry) => entry.meta,
);
