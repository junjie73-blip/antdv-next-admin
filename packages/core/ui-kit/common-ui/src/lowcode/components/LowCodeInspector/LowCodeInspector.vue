<script lang="ts">
import type { HTMLAttributes, PropType } from 'vue';

import type { LowcodeContext } from '../../config';
import type { ComponentMeta, NodeSchema, PropMeta } from '../../core/types';
import type { InspectorChange } from './types';

import { computed, defineComponent, h, reactive, watch } from 'vue';

import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

import { useLowcodeContext } from '../../composables/use-lowcode-page';
import { isBindingString } from '../../core/binding';

/**
 * 属性面板：由 `ComponentMeta.props` 生成表单。
 *
 * 分层位置：`components/`。输入只有「一个节点 + 一份元数据」，输出只有 `change` 事件：
 * **绝不直接改 Schema** —— 设计器需要「改一次进一次撤销栈」，而撤销栈要求写入方是宿主，
 * 面板自己写进 props 会让撤销丢帧。
 *
 * 口径：
 * - 字段类型完全由 `PropMeta.kind` 决定，新增 kind 只要在这里补一个编辑器分支，物料作者不必碰面板；
 * - 属性值是 `{{ }}` 绑定串时**强制走文本编辑器**：把 `{{ form.name }}` 当枚举值点掉，
 *   等于一次点击毁掉一条绑定；
 * - JSON / 数字这类要解析的字段，解析失败时只留提示不回抛：宿主拿到的永远是一份合法 Schema。
 *
 * 本文件**不做**的事：不校验整页（`dsl.validatePageSchema`）、不保存、不撤销。
 */

/** 编辑器分支只有三个特例：`boolean` 给开关、`select` 给下拉、`textarea` 给多行，其余 kind 一律落回文本输入框 */

function textOf(value: unknown, fallback = ''): string {
  if (value === undefined || value === null) return fallback;
  return typeof value === 'string' ? value : String(value);
}

function jsonOf(value: unknown, fallback: unknown): string {
  const raw = value === undefined ? fallback : value;
  if (raw === undefined) return '';
  // 已经是字符串就不必再套一层引号：JSON 字段填字符串是常见写法，序列化后会变成 `"[]"` 那种惊怵样子
  return typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2);
}

export default defineComponent({
  name: 'LowCodeInspector',
  props: {
    /** 是否显示「显示条件」编辑器：设计器通常打开，纯表单宿主可以不开 */
    allowCondition: { default: true, type: Boolean },
    class: {
      default: undefined,
      type: [String, Object, Array] as PropType<HTMLAttributes['class']>,
    },
    context: { default: undefined, type: Object as PropType<LowcodeContext> },
    /** 当前选中的节点；没选中时面板给一句空话而不是一个空壳 */
    node: { default: undefined, type: Object as PropType<NodeSchema> },
    /** 显式指定元数据；缺省按 `node.type` 到注册表查 */
    meta: { default: undefined, type: Object as PropType<ComponentMeta> },
  },
  emits: {
    change: (payload: InspectorChange) =>
      payload != null && typeof payload.key === 'string',
    'update:condition': (value: string | undefined) =>
      value === undefined || typeof value === 'string',
  },
  setup(props, { emit }) {
    // 传函数：属性面板的表单项是从注册表的元数据派生的，换装配就得重算一遍
    const context = useLowcodeContext(() => props.context);

    const metaOf = computed<ComponentMeta>(
      () =>
        props.meta ??
        context.registry.getMeta(props.node?.type ?? '') ?? {
          name: props.node?.type ?? '',
          props: [],
          type: props.node?.type ?? '',
        },
    );

    /** 编辑器草稿：`key -> 文本/布尔`。与 Schema 解耦，才敢让宿主「不改就不回显」 */
    const drafts = reactive<Record<string, boolean | string>>({});
    /** 解析失败信息：`key -> 文案`，非空表示这次输入没有回抛 */
    const errors = reactive<Record<string, string>>({});

    const boundKeys = computed(() => {
      const out = new Set<string>();
      for (const [key, value] of Object.entries(props.node?.props ?? {})) {
        if (isBindingString(value)) out.add(key);
      }
      return out;
    });

    function seedKey(prop: PropMeta): void {
      const raw = props.node?.props?.[prop.key];
      if (isBindingString(raw)) {
        // 绑定串一律按原文进文本框：编辑表达式是设计器里最高频的动作之一
        drafts[prop.key] = textOf(raw);
        return;
      }
      switch (prop.kind) {
        case 'boolean': {
          drafts[prop.key] = Boolean(raw ?? prop.default ?? false);
          break;
        }
        case 'json': {
          drafts[prop.key] = jsonOf(raw, prop.default);
          break;
        }
        default: {
          drafts[prop.key] = textOf(raw ?? prop.default, '');
        }
      }
      delete errors[prop.key];
    }

    function seedAll(): void {
      for (const prop of metaOf.value.props) seedKey(prop);
      drafts.__condition__ = props.node?.condition ?? '';
      for (const key of Object.keys(drafts)) {
        if (
          !metaOf.value.props.some((prop) => prop.key === key) &&
          key !== '__condition__'
        )
          delete drafts[key];
      }
    }

    // 只认「选中的节点换了 / 这个节点的属性对象换了」：
    // 用户在文本框里打字时宿主回写 props 会生成新的 props 引用，此时重新播种是安全的
    watch(
      () => [props.node?.id, props.node?.props, metaOf.value.type] as const,
      seedAll,
      { immediate: true },
    );

    /** 把编辑器值解释成 Schema 值；解析不了就返回 `undefined` 并挂上提示 */
    function interpret(
      prop: PropMeta,
      editorValue: boolean | string,
    ): { ok: boolean; value: unknown } {
      // 输入本身带 `{{ }}` 就原样交回（绑定串），不走数字/JSON 解析
      if (isBindingString(editorValue)) return { ok: true, value: editorValue };
      if (prop.kind === 'boolean')
        return { ok: true, value: Boolean(editorValue) };
      if (prop.kind === 'number') {
        const text = textOf(editorValue).trim();
        if (!text) return { ok: true, value: undefined };
        const parsed = Number(text);
        if (!Number.isFinite(parsed)) {
          errors[prop.key] = `「${text}」不是数字，未提交`;
          return { ok: false, value: undefined };
        }
        return { ok: true, value: parsed };
      }
      if (prop.kind === 'json') {
        const text = textOf(editorValue).trim();
        if (!text) return { ok: true, value: undefined };
        try {
          return { ok: true, value: JSON.parse(text) };
        } catch (error) {
          errors[prop.key] =
            `JSON 解析失败：${error instanceof Error ? error.message : String(error)}`;
          return { ok: false, value: undefined };
        }
      }
      if (prop.kind === 'select') {
        const hit = (prop.options ?? []).find(
          (option) => String(option.value) === textOf(editorValue),
        );
        // 找不到候选时原样交出：宿主自定义的 kind 值不该被面板吃掉
        return { ok: true, value: hit ? hit.value : textOf(editorValue) };
      }
      const text = textOf(editorValue);
      return { ok: true, value: text === '' ? undefined : text };
    }

    const commit = (prop: PropMeta, editorValue: boolean | string) => {
      drafts[prop.key] = editorValue;
      const result = interpret(prop, editorValue);
      if (!result.ok) return;
      delete errors[prop.key];
      emit('change', { key: prop.key, value: result.value });
    };

    const fieldId = (key: string) =>
      `lowcode-inspector-${props.node?.id ?? 'none'}-${key}`;

    /* ------------------------------- 各类编辑器 ------------------------------- */

    function renderTextish(prop: PropMeta, type = 'text') {
      return h(Input, {
        'aria-label': prop.label,
        class: 'w-full',
        id: fieldId(prop.key),
        modelValue: textOf(drafts[prop.key]),
        placeholder: prop.placeholder,
        'onUpdate:modelValue': (value: number | string) =>
          commit(prop, String(value)),
        type,
      });
    }

    function renderTextarea(prop: PropMeta) {
      return h(Textarea, {
        'aria-label': prop.label,
        class: 'w-full',
        id: fieldId(prop.key),
        modelValue: textOf(drafts[prop.key]),
        placeholder: prop.placeholder,
        'onUpdate:modelValue': (value: number | string) =>
          commit(prop, String(value)),
      });
    }

    function renderSelect(prop: PropMeta) {
      const options = prop.options ?? [];
      return h(
        Select,
        {
          modelValue: textOf(drafts[prop.key]),
          'onUpdate:modelValue': (value: unknown) =>
            commit(prop, textOf(value)),
        },
        {
          default: () => [
            h(
              SelectTrigger,
              { 'aria-label': prop.label, id: fieldId(prop.key), size: 'sm' },
              {
                default: () =>
                  h(SelectValue, { placeholder: prop.placeholder ?? '请选择' }),
              },
            ),
            h(
              SelectContent,
              {},
              {
                default: () =>
                  options.map((option) =>
                    h(
                      SelectItem,
                      {
                        key: String(option.value),
                        value: String(option.value),
                      },
                      { default: () => option.label },
                    ),
                  ),
              },
            ),
          ],
        },
      );
    }

    function renderEditor(prop: PropMeta) {
      // 绑定串只给纯文本编辑器：点成枚举值、或让 `type=number` 的输入框吃掉花括号，
      // 都是「一次点击毁掉一条绑定」的不可逆破坏；textarea 例外，它本来就是写长文本的。
      if (boundKeys.value.has(prop.key)) {
        return prop.kind === 'textarea'
          ? renderTextarea(prop)
          : renderTextish(prop, 'text');
      }
      if (prop.kind === 'boolean') {
        return h(Switch, {
          'aria-label': prop.label,
          id: fieldId(prop.key),
          modelValue: Boolean(drafts[prop.key]),
          'onUpdate:modelValue': (value: boolean) => commit(prop, value),
        });
      }
      if (prop.kind === 'select') return renderSelect(prop);
      if (prop.kind === 'textarea') return renderTextarea(prop);
      // `number` 也用文本框 + `interpret` 校验：`type=number` 会把 `{{ }}` 和半截输入直接吃掉，
      // 面板拿不到「用户想写表达式」这件事，只剩一个空值
      return renderTextish(prop, prop.kind === 'color' ? 'color' : 'text');
    }

    function renderField(prop: PropMeta) {
      const hint = errors[prop.key] ?? prop.description;
      return h(
        'div',
        {
          class: 'flex flex-col gap-1.5',
          'data-bound': boundKeys.value.has(prop.key) ? 'true' : 'false',
          'data-field-key': prop.key,
          'data-field-kind': prop.kind,
          'data-slot': 'lowcode-inspector-field',
        },
        [
          h(
            Label,
            { class: 'text-xs', for: fieldId(prop.key) },
            { default: () => prop.label },
          ),
          renderEditor(prop),
          hint
            ? h(
                'p',
                {
                  class: cn(
                    'text-xs',
                    errors[prop.key]
                      ? 'text-destructive'
                      : 'text-muted-foreground',
                  ),
                  'data-slot': errors[prop.key]
                    ? 'lowcode-inspector-error'
                    : 'lowcode-inspector-hint',
                },
                hint,
              )
            : null,
        ],
      );
    }

    return () => {
      const node = props.node;
      const meta = metaOf.value;
      if (!node) {
        return h(
          'div',
          {
            class: cn('flex w-full flex-col gap-3', props.class),
            'data-slot': 'lowcode-inspector',
          },
          [
            h(
              'p',
              {
                class:
                  'rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground',
                'data-slot': 'lowcode-inspector-empty',
              },
              '在大纲里选中一个节点，这里就会出现它的属性表单',
            ),
          ],
        );
      }

      const groups: Array<{ items: PropMeta[]; name: string }> = [];
      const buckets = new Map<string, PropMeta[]>();
      for (const prop of meta.props) {
        const name = prop.group?.trim() || '属性';
        let bucket = buckets.get(name);
        if (!bucket) {
          bucket = [];
          buckets.set(name, bucket);
          groups.push({ items: bucket, name });
        }
        bucket.push(prop);
      }

      return h(
        'div',
        {
          class: cn('flex w-full flex-col gap-4', props.class),
          'data-node-id': node.id,
          'data-slot': 'lowcode-inspector',
        },
        [
          h('div', { class: 'flex flex-col gap-1' }, [
            h('p', { class: 'text-sm font-medium' }, meta.name || node.type),
            h(
              'p',
              {
                class: 'text-xs text-muted-foreground',
                'data-slot': 'lowcode-inspector-node-id',
              },
              `${node.id} · ${node.type}`,
            ),
          ]),
          ...groups.map((group) =>
            h(
              'div',
              {
                class: 'flex flex-col gap-3',
                'data-slot': 'lowcode-inspector-group',
              },
              [
                groups.length > 1
                  ? h(
                      'p',
                      { class: 'text-xs font-medium text-muted-foreground' },
                      group.name,
                    )
                  : null,
                ...group.items.map(renderField),
              ],
            ),
          ),
          props.allowCondition
            ? h(
                'div',
                {
                  class: 'flex flex-col gap-1.5',
                  'data-field-key': 'condition',
                  'data-slot': 'lowcode-inspector-condition',
                },
                [
                  h(
                    Label,
                    { class: 'text-xs', for: fieldId('condition') },
                    { default: () => '显示条件' },
                  ),
                  h(Input, {
                    'aria-label': '显示条件',
                    class: 'w-full',
                    id: fieldId('condition'),
                    modelValue: textOf(drafts.__condition__),
                    placeholder: '{{ form.enabled }}',
                    'onUpdate:modelValue': (value: number | string) => {
                      const text = String(value);
                      drafts.__condition__ = text;
                      emit(
                        'update:condition',
                        text.trim() === '' ? undefined : text.trim(),
                      );
                    },
                  }),
                  h(
                    'p',
                    { class: 'text-xs text-muted-foreground' },
                    '受限表达式（graph 语法），留空表示始终显示',
                  ),
                ],
              )
            : null,
        ],
      );
    };
  },
});
</script>
