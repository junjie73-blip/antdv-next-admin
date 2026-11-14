<script lang="ts">
import type { HTMLAttributes, PropType, VNode, VNodeChild } from 'vue';

import type { LowcodeContext } from '../../config';
import type {
  IssueCode,
  LowcodeEventPayload,
  NodeSchema,
} from '../../core/types';

import { defineComponent, h, markRaw, provide } from 'vue';

import { cn } from '@antdv/shared/utils/cn';

import { useLowcodeContext } from '../../composables/use-lowcode-page';
import { LOWCODE_CONTEXT_KEY } from '../../config';
import { evalCondition, resolveProps } from '../../core/binding';

/**
 * Schema -> 组件树的渲染器。
 *
 * 分层位置：`components/`，本包唯一的「执行引擎视图侧」。它只做三件事：
 * 按 `condition` 决定显隐、按 `binding` 把 props 解释成真实值、把 `events` 里的动作
 * 原样抛给上层（`useLowcodePage.dispatch`）。
 *
 * 为什么是 `h()` 而不是模板：插槽是 Schema 里动态出来的（`node.slots` 的键事先不知道），
 * 模板里的 `<template #[name]>` 配 `v-for` 在编译期是个已知麻烦；而递归本身用函数调用最省事 ——
 * 少一层组件实例，markRaw 的组件对象也不会被包成额外的一层插槽作用域。
 *
 * 本文件**不做**的事：不改 Schema（设计器动作，见 `dsl`）、不取数（见 `datasource`）、
 * 不认得宿主（一切能力经 `LowcodeContext` 注入）。
 */

/** 事件入参归一：单参给值、多参给数组、无参给 undefined，方便 `set:path` 直接写进 scope */
function normalizeArgs(args: unknown[]): unknown {
  if (args.length === 0) return undefined;
  return args.length === 1 ? args[0] : args;
}

/** `update:modelValue` -> `onUpdate:modelValue`，与 Vue 的 `toHandlerKey` 同规则 */
function handlerKey(name: string): string {
  const first = name.charAt(0);
  return `on${first.toUpperCase()}${name.slice(1)}`;
}

export default defineComponent({
  name: 'LowCodeRenderer',
  props: {
    /** 显式传入优先于 inject；单测与「一页多 context」的宿主靠它隔离 */
    context: { default: undefined, type: Object as PropType<LowcodeContext> },
    class: {
      default: undefined,
      type: [String, Object, Array] as PropType<HTMLAttributes['class']>,
    },
    nodes: { default: () => [], type: Array as PropType<NodeSchema[]> },
    /** 绑定的数据源：`useLowcodePage` 交出来的响应式 scope */
    scope: {
      default: () => ({}),
      type: Object as PropType<Record<string, unknown>>,
    },
  },
  emits: {
    event: (payload: LowcodeEventPayload) =>
      payload != null && typeof payload.name === 'string',
  },
  setup(props, { emit }) {
    const context = useLowcodeContext(() => props.context);
    // 子树里别的组件（大纲/属性面板）可以 inject 到同一套装配，少传一串 prop
    // 传的是门面而不是取值：宿主换 `:context` 时子树跟着换，不必重挂
    provide(LOWCODE_CONTEXT_KEY, context);

    /** 同一类问题只报一次：渲染是每帧都跑的，重复塞错误列表会把宿主的状态面板刷爆 */
    const reported = new Set<string>();
    const report = (
      key: string,
      code: IssueCode,
      message: string,
      nodeId: string,
    ) => {
      if (reported.has(key)) return;
      reported.add(key);
      context.report({ code, level: 'error', message, nodeId });
    };

    const bindingOptions = () => ({
      ctx: context.scopeBase(),
      evaluator: context.evaluator,
      onError: (message: string, expression: string) => {
        report(
          `expr:${expression}`,
          'bad-expression',
          `表达式「${expression}」求值失败：${message}`,
          '',
        );
      },
    });

    const visible = (node: NodeSchema): boolean => {
      if (node.condition === undefined) return true;
      return evalCondition(node.condition, props.scope ?? {}, bindingOptions());
    };

    const listenersFor = (
      node: NodeSchema,
    ): Record<string, (...args: unknown[]) => void> => {
      const out: Record<string, (...args: unknown[]) => void> = {};
      for (const [name, action] of Object.entries(node.events ?? {})) {
        if (!action) continue;
        out[handlerKey(name)] = (...args: unknown[]) => {
          emit('event', {
            name,
            nodeId: node.id,
            payload: normalizeArgs(args),
          });
        };
      }
      return out;
    };

    function renderNode(node: NodeSchema): null | VNode {
      if (!node || typeof node.type !== 'string') return null;
      if (!visible(node)) return null;

      const component = context.registry.get(node.type);
      if (!component) {
        report(
          `type:${node.type}`,
          'unknown-type',
          `组件类型「${node.type}」没有注册，已降级为占位（请检查 configureLowcode({ components })）`,
          node.id,
        );
        const fallback = context.registry.getFallback();
        if (fallback)
          return h(markRaw(fallback), {
            'data-node-id': node.id,
            node,
          }) as VNode;
        return h(
          'div',
          {
            class:
              'rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground',
            'data-node-id': node.id,
            'data-slot': 'lowcode-unknown',
            'data-type': node.type,
          },
          [
            h('span', { class: 'font-medium' }, '未注册组件类型：'),
            h('code', { class: 'ml-1' }, node.type),
          ],
        );
      }

      // markRaw 的理由：宿主常把物料塞进 reactive 的注册表/Schema，
      // 组件对象一旦被包成响应式代理，Vue 每次挂载都会告警并且明显变慢
      const resolved = markRaw(component);
      const bound = resolveProps(node, props.scope ?? {}, bindingOptions());
      const children = renderList(node.children ?? []);
      const slots: Record<string, () => VNodeChild> = {};
      if (children.length > 0) slots.default = () => children;
      for (const [name, items] of Object.entries(node.slots ?? {})) {
        if (!items || items.length === 0) continue;
        slots[name] = () => renderList(items);
      }

      return h(
        resolved,
        {
          ...bound,
          ...listenersFor(node),
          // 定位钩子：设计器点选、自动化测试断言都靠它，靠属性穿透落到真实 DOM
          'data-node-id': node.id,
          'data-schema-type': node.type,
        },
        Object.keys(slots).length > 0 ? slots : undefined,
      ) as VNode;
    }

    function renderList(nodes: NodeSchema[]): VNode[] {
      const out: VNode[] = [];
      for (const node of nodes) {
        const rendered = renderNode(node);
        if (rendered) out.push(rendered);
      }
      return out;
    }

    return () =>
      h(
        'div',
        {
          class: cn('flex w-full flex-col gap-3', props.class),
          'data-slot': 'lowcode-renderer',
        },
        renderList(props.nodes ?? []),
      );
  },
});
</script>
