<script setup lang="ts">
import type { PropType, VNode } from 'vue';

import type {
  ActionItem,
  ActionTooltip,
  Recordable,
  TableActionProps,
} from '../types';

import { computed, defineComponent, h, isVNode, ref } from 'vue';

import { Popconfirm } from '@antdv/common-ui';
import { IconifyIcon as Icon } from '@antdv/icons/icon';
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { isFunction, isString } from 'es-toolkit';

import { tableRuntime } from '../config';

const props = withDefaults(defineProps<TableActionProps>(), {
  actions: () => [],
  hasPermission: undefined,
  maxCount: 4,
  maxShowCount: undefined,
  permissionMode: 'hide',
  record: () => ({}),
});

/** 动态 VNode（函数式 label / tooltip）在模板里需要一个落地组件 */
const RenderVNode = defineComponent({
  name: 'RenderVNode',
  props: {
    vnode: { type: [Object, Array, String, Number, Boolean], default: null },
  },
  setup(p) {
    return () => p.vnode as any;
  },
});

// ============================
// 工具函数
// ============================

/** 默认沿用 link 变体；link 样式本身不设置 text-decoration-line */
function getButtonVariant(action: ActionItem) {
  switch (action.type) {
    case 'dashed':
    case 'default': {
      return 'outline' as const;
    }
    case 'primary': {
      return 'default' as const;
    }
    case 'link':
    case 'text':
    case 'ghost':
    default: {
      return 'link' as const;
    }
  }
}

function getButtonClass(action: ActionItem) {
  const solid = action.type === 'default' || action.type === 'primary';
  return cn(
    'h-6 gap-1 px-1! text-sm',
    // 默认按钮底色取主题 primary 的浅色底，危险操作取 destructive 浅底；
    // 不设置 text-decoration-line，link 变体在 shadcn 里也已去掉下划线类。
    !action.danger &&
      (solid
        ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
        : 'bg-primary/10 hover:bg-primary/20 text-primary'),
    action.danger &&
      'bg-destructive/10 hover:bg-destructive/20 text-red-500 hover:text-red-600',
  );
}

function getButtonSize(action: ActionItem) {
  return action.size === 'small' ? 'xs' : action.size === 'large' ? 'lg' : 'sm';
}

/** `permission` 是推荐写法；`auth` 保留给存量配置，二者都不传视为放行 */
function permissionOf(action: ActionItem): string | string[] | undefined {
  return action.permission ?? action.auth;
}

/** 数组语义是"任一命中即可"；旧写法把数组 join 成一个码，永远匹配不上 */
function hasAuth(auth: string | string[] | undefined): boolean {
  if (!auth) return true;
  return isString(auth)
    ? tableRuntime.checkAuth(auth)
    : tableRuntime.checkAnyAuth(auth);
}

/** 组件级 hasPermission 优先；不传才回落到 configureTable 注入的运行时 */
function checkPermission(action: ActionItem, record: Recordable): boolean {
  if (props.hasPermission) return props.hasPermission(action, record);
  return hasAuth(permissionOf(action));
}

/** 单项 permissionMode 优先，其次组件级配置，默认隐藏 */
function permissionModeOf(action: ActionItem) {
  return action.permissionMode ?? props.permissionMode;
}

function isShow(action: ActionItem, record: Recordable): boolean {
  if (action.ifShow === false) return false;
  if (isFunction(action.ifShow)) return action.ifShow(record);
  if (
    permissionModeOf(action) !== 'disable' &&
    !checkPermission(action, record)
  )
    return false;
  return true;
}

function isDisabled(action: ActionItem, record: Recordable): boolean {
  // 权限不足且声明了 disable 模式：按钮可见但不可用
  if (
    permissionModeOf(action) === 'disable' &&
    !checkPermission(action, record)
  )
    return true;
  if (action.disabled === true) return true;
  if (isFunction(action.disabled)) return action.disabled(record);
  return false;
}

function getActionLabel(
  label: ActionItem['label'],
  record: Recordable,
): string | undefined | VNode {
  if (!label) return undefined;
  if (isFunction(label)) return label(record);
  return label;
}

const currentRecord = computed(() => props.record || {});

/**
 * Tooltip 只服务纯图标按钮：有 label 时文字已经说明用途，
 * 再叠一层提示会重复；没有 icon 的空按钮也不展示提示。
 */
function getTooltip(action: ActionItem): string | undefined | VNode {
  if (!action.icon) return undefined;
  if (getActionLabel(action.label, currentRecord.value)) return undefined;
  const tooltip: ActionTooltip | undefined = action.tooltip;
  if (!tooltip) return undefined;
  return isFunction(tooltip) ? tooltip(currentRecord.value) : tooltip;
}

/** `popConfirm.title/content` 允许字符串或 VNode，交给 Popconfirm 的具名插槽前要成 VNode */
function toNode(value: string | VNode): VNode {
  return isVNode(value) ? value : h('span', String(value));
}

/** 获取某个 action 的 label VNode（兼容字符串 / VNode） */
function getLabelVNode(action: ActionItem): undefined | VNode {
  const label = getActionLabel(action.label, currentRecord.value);
  if (!label) return undefined;
  return isVNode(label) ? label : h('span', String(label));
}

// ============================
// 按钮（含可选 Tooltip）
// ============================

/**
 * 四种分支（普通 / 二次确认 / 下拉触发 / 更多触发）共用同一颗按钮。
 *
 * `inheritAttrs: false` + 手动把 attrs 透给 Button 是必须的：PopoverTrigger /
 * TooltipTrigger 都用 `as-child` 把事件与 ARIA 属性挂到子组件上，若让它们落在外层
 * TooltipProvider 上，触发器就拿不到 onClick，弹层打不开。
 */
const ActionButton = defineComponent({
  name: 'ActionButton',
  inheritAttrs: false,
  props: {
    action: { type: Object as PropType<ActionItem>, required: true },
    labelVNode: { type: [String, Object], default: null },
    tooltip: { type: [String, Object], default: null },
    disabled: { type: Boolean, default: false },
  },
  emits: ['click'],
  setup(p, { attrs, emit }) {
    return () => {
      const button = h(
        Button,
        {
          ...attrs,
          variant: getButtonVariant(p.action),
          size: getButtonSize(p.action),
          disabled: p.disabled,
          class: getButtonClass(p.action),
          onClick: (e: MouseEvent) => {
            const trigger = attrs.onClick as
              | ((e: MouseEvent) => void)
              | undefined;
            trigger?.(e);
            emit('click', e);
          },
        },
        () => [
          p.action.icon ? h(Icon, { icon: p.action.icon }) : null,
          p.labelVNode
            ? isVNode(p.labelVNode)
              ? p.labelVNode
              : h('span', String(p.labelVNode))
            : null,
        ],
      );

      if (!p.tooltip) return button;
      return h(TooltipProvider, null, {
        default: () =>
          h(Tooltip, null, {
            default: () => [
              h(TooltipTrigger, { asChild: true }, { default: () => button }),
              h(TooltipContent, null, {
                default: () => [toNode(p.tooltip as string | VNode)],
              }),
            ],
          }),
      });
    };
  },
});

// ============================
// 响应式状态
// ============================

const actionsRef = computed(() => props.actions || []);
/** 旧别名 maxShowCount 优先，保证已有页面配置不被默认值顶掉 */
const effectiveMaxCount = computed(() => {
  const raw = props.maxShowCount ?? props.maxCount ?? 4;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 4;
});
const moreDropdownOpen = ref(false);
const subDropdownOpenMap = ref<Record<number, boolean>>({});
const popConfirmOpenMap = ref<Record<number, boolean>>({});
const inlineConfirmOpen = ref<Record<string, boolean>>({});

/** 可见的操作项（按权限 / ifShow 过滤）；disable 模式下无权限项仍保留 */
const visibleActions = computed(() =>
  actionsRef.value.filter((action) => isShow(action, currentRecord.value)),
);

/**
 * 行内平铺项：
 * - 数量 ≤ maxCount：全部平铺，没有「更多」；
 * - 数量 > maxCount：只平铺前 maxCount-1 项，第 maxCount 位让给「更多」。
 */
const showActions = computed(() => {
  const { length } = visibleActions.value;
  const limit = effectiveMaxCount.value;
  return visibleActions.value.slice(0, length > limit ? limit - 1 : limit);
});

/** 从第 maxCount 项起全部收进「更多」，历史项不会被覆盖 */
const dropdownActions = computed(() => {
  if (visibleActions.value.length <= effectiveMaxCount.value) return [];
  return visibleActions.value.slice(effectiveMaxCount.value - 1);
});

const hasDropdown = computed(() => dropdownActions.value.length > 0);

// ============================
// 事件处理
// ============================

function handleClick(action: ActionItem, e: MouseEvent) {
  action.onClick?.(currentRecord.value, e);
}

function handleConfirm(action: ActionItem, index: number, e?: MouseEvent) {
  popConfirmOpenMap.value[index] = false;
  if (action.popConfirm?.confirm && e) {
    action.popConfirm.confirm(currentRecord.value, e);
  }
}

function handleCancel(action: ActionItem, index: number, e?: MouseEvent) {
  popConfirmOpenMap.value[index] = false;
  if (action.popConfirm?.cancel && e) {
    action.popConfirm.cancel(currentRecord.value, e);
  }
}

// ============================
// 渲染辅助（下拉项）
// ============================

/** 渲染下拉菜单里的单个 action（含二次确认分支） */
function renderDropdownAction(
  action: ActionItem,
  key: number | string,
  closeDropdown: () => void,
  openConfirmKey?: string,
) {
  const disabled = isDisabled(action, currentRecord.value);
  const label = getActionLabel(action.label, currentRecord.value) ?? '操作';
  const labelVNode = isVNode(label) ? label : h('span', String(label));

  const itemClass = cn(
    'mx-1 flex cursor-pointer items-center gap-2 rounded-sm px-3 py-1.5 text-sm transition-colors duration-200 select-none',
    action.danger
      ? 'text-red-500 hover:bg-red-50'
      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800',
    disabled &&
      'cursor-not-allowed text-gray-400! opacity-50 hover:bg-transparent!',
  );

  const content = h(
    'div',
    {
      class: itemClass,
      onClick: (e: MouseEvent) => {
        if (disabled) return;
        if (action.popConfirm) {
          if (openConfirmKey) inlineConfirmOpen.value[openConfirmKey] = true;
          return;
        }
        action.onClick?.(currentRecord.value, e);
        closeDropdown();
      },
    },
    [
      action.icon
        ? h(Icon, { icon: action.icon, class: 'text-base shrink-0' })
        : null,
      h('span', { class: 'truncate' }, [labelVNode]),
    ],
  );

  if (!action.popConfirm) {
    return h('div', { key }, [content]);
  }

  // 有二次确认：内联展开确认行（避免 Popover 套 Popover 的浮层冲突）
  const confirmKey = openConfirmKey ?? String(key);
  const isOpen = inlineConfirmOpen.value[confirmKey];
  return h('div', { key }, [
    content,
    isOpen
      ? h(
          'div',
          {
            key: confirmKey,
            class: cn(
              'bg-muted/60 m-1 rounded-md border p-2 text-sm',
              'flex flex-col gap-2',
            ),
          },
          [
            h('div', { class: 'flex flex-col gap-1' }, [
              h('div', { class: 'font-medium leading-5' }, [
                isVNode(action.popConfirm.title)
                  ? action.popConfirm.title
                  : String(action.popConfirm.title),
              ]),
              action.popConfirm.content
                ? h(
                    'div',
                    { class: 'text-xs leading-5 text-muted-foreground' },
                    [action.popConfirm.content],
                  )
                : null,
            ]),
            h('div', { class: 'flex items-center justify-end gap-2' }, [
              h(
                Button,
                {
                  variant: 'outline',
                  size: 'xs',
                  onClick: (e: MouseEvent) => {
                    action.popConfirm?.cancel?.(currentRecord.value, e);
                    inlineConfirmOpen.value[confirmKey] = false;
                  },
                },
                () => action.popConfirm?.cancelText ?? '取消',
              ),
              h(
                Button,
                {
                  variant: action.danger ? 'destructive' : 'default',
                  size: 'xs',
                  onClick: (e: MouseEvent) => {
                    if (action.popConfirm?.confirm) {
                      action.popConfirm.confirm(currentRecord.value, e);
                    } else {
                      action.onClick?.(currentRecord.value, e);
                    }
                    inlineConfirmOpen.value[confirmKey] = false;
                    closeDropdown();
                  },
                },
                () => action.popConfirm?.okText ?? '确定',
              ),
            ]),
          ],
        )
      : null,
  ]);
}

/** 子级下拉中可见的 action（保证渲染索引与点击索引一致） */
function getVisibleSubActions(action: ActionItem) {
  return (action.dropdown ?? []).filter((item) =>
    isShow(item, currentRecord.value),
  );
}

/** 渲染"更多"下拉内容 */
function renderMoreDropdownContent() {
  return h(
    'div',
    {
      class:
        'py-1.5 min-w-[120px] rounded bg-white dark:bg-slate-800 dark:text-slate-100',
    },
    dropdownActions.value.map((action, i) =>
      renderDropdownAction(
        action,
        i,
        () => {
          moreDropdownOpen.value = false;
        },
        `more-${i}`,
      ),
    ),
  );
}

/** 子级下拉菜单项点击（索引与 `getVisibleSubActions` 的渲染顺序一致） */
function subMenuClick(
  action: ActionItem,
  itemIndex: number,
  e: MouseEvent,
  close: () => void,
) {
  const sub = getVisibleSubActions(action)[itemIndex];
  if (!sub) return;
  if (sub.popConfirm) return;
  e.stopPropagation?.();
  sub.onClick?.(currentRecord.value, e);
  close();
}
</script>

<template>
  <!-- 单元格默认居中：操作栏与表体内容保持同一对齐基准 -->
  <div :class="cn('flex items-center justify-center')" data-table-action>
    <template v-for="(action, index) in showActions" :key="index">
      <!-- 分割线 -->
      <Separator
        v-if="index !== 0"
        :class="cn('mx-1 h-3 w-px! shrink-0 bg-gray-200 dark:bg-gray-700')"
        orientation="vertical"
      />

      <!-- ============ Popconfirm 类型 ============ -->
      <Popconfirm
        v-if="action.popConfirm"
        v-model:open="popConfirmOpenMap[index]"
        :cancel-text="action.popConfirm.cancelText"
        :danger="action.danger"
        :ok-text="action.popConfirm.okText"
        @cancel="(e: MouseEvent) => handleCancel(action, index, e)"
        @confirm="(e: MouseEvent) => handleConfirm(action, index, e)"
      >
        <ActionButton
          :action="action"
          :disabled="isDisabled(action, currentRecord)"
          :label-v-node="getLabelVNode(action)"
          :tooltip="getTooltip(action)"
        />
        <template #title>
          <RenderVNode :vnode="toNode(action.popConfirm.title)" />
        </template>
        <template v-if="action.popConfirm.content" #description>
          <RenderVNode :vnode="toNode(action.popConfirm.content)" />
        </template>
      </Popconfirm>

      <!-- ============ Dropdown 类型 ============ -->
      <Popover
        v-else-if="action.dropdown && action.dropdown.length > 0"
        v-model:open="subDropdownOpenMap[index]"
      >
        <PopoverTrigger as-child>
          <ActionButton
            :action="action"
            :disabled="isDisabled(action, currentRecord)"
            :label-v-node="getLabelVNode(action)"
            :tooltip="getTooltip(action)"
          />
        </PopoverTrigger>
        <PopoverContent align="start" :side-offset="4" class="w-auto p-0">
          <div
            class="py-1.5 min-w-[120px] rounded bg-white dark:bg-slate-800 dark:text-slate-100"
          >
            <template
              v-for="(sub, subIndex) in getVisibleSubActions(action)"
              :key="subIndex"
            >
              <div
                v-if="!sub.popConfirm"
                :class="
                  cn(
                    'mx-1 flex cursor-pointer items-center gap-2 rounded-sm px-3 py-1.5 text-sm transition-colors duration-200 select-none',
                    sub.danger
                      ? 'text-red-500 hover:bg-red-50'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800',
                  )
                "
                @click="
                  (e: MouseEvent) =>
                    subMenuClick(action, subIndex, e, () => {
                      subDropdownOpenMap[index] = false;
                    })
                "
              >
                <Icon
                  v-if="sub.icon"
                  :icon="sub.icon"
                  class="text-base shrink-0"
                />
                <span class="truncate">
                  <RenderVNode
                    v-if="getLabelVNode(sub)"
                    :vnode="getLabelVNode(sub)"
                  />
                  <template v-else>操作</template>
                </span>
              </div>
              <component
                :is="
                  () =>
                    renderDropdownAction(
                      sub,
                      subIndex,
                      () => {
                        subDropdownOpenMap[index] = false;
                      },
                      `sub-${index}-${subIndex}`,
                    )
                "
                v-else
              />
            </template>
          </div>
        </PopoverContent>
      </Popover>

      <!-- ============ 普通按钮（type 默认 text） ============ -->
      <ActionButton
        v-else
        :action="action"
        :disabled="isDisabled(action, currentRecord)"
        :label-v-node="getLabelVNode(action)"
        :tooltip="getTooltip(action)"
        @click="(e: MouseEvent) => handleClick(action, e)"
      />
    </template>

    <!-- ============ "更多" 下拉菜单 ============ -->
    <template v-if="hasDropdown">
      <Separator
        v-if="showActions.length > 0"
        :class="cn('mx-1 h-3 w-px! shrink-0 bg-gray-200 dark:bg-gray-700')"
        orientation="vertical"
      />
      <Popover v-model:open="moreDropdownOpen">
        <PopoverTrigger as-child>
          <ActionButton
            :action="{ label: '更多', type: 'text' }"
            label-v-node="更多"
          />
        </PopoverTrigger>
        <PopoverContent align="start" :side-offset="4" class="w-auto p-0">
          <component :is="renderMoreDropdownContent" />
        </PopoverContent>
      </Popover>
    </template>
  </div>
</template>
