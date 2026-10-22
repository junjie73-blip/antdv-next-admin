<script setup lang="ts">
import type { VNode } from 'vue';

import type { ActionItem } from '../types';

import { computed, defineComponent, h, isVNode, ref } from 'vue';

import { Popconfirm } from '@antdv/common-ui';
import { IconifyIcon as Icon } from '@antdv/icons/icon';
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { isFunction, isString } from 'es-toolkit';

import { tableRuntime } from '../config';

interface Props {
  /** 操作项列表 */
  actions?: ActionItem[];
  /** 最多显示的操作数量，超出部分放入下拉菜单 */
  maxShowCount?: number;
  /** 当前行数据 */
  record?: Record<string, any>;
}

const props = withDefaults(defineProps<Props>(), {
  actions: () => [],
  maxShowCount: 4,
  record: () => ({}),
});

/**
 * VNode 渲染辅助组件
 * 用于把动态 VNode（如函数式 label）渲染到模板中
 */
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

/** ActionItem.type -> shadcn Button variant */
function getButtonVariant(action: ActionItem) {
  const type = action.type || 'link';
  switch (type) {
    case 'dashed':
    case 'default':
    case 'ghost': {
      return 'outline';
    }
    case 'primary': {
      return 'default';
    }
    case 'link':
    case 'text': {
      return 'ghost';
    }
    default: {
      return 'ghost';
    }
  }
}

function getButtonClass(action: ActionItem) {
  const type = action.type || 'link';
  return cn(
    'h-6 gap-1 px-0.5 text-sm',
    (type === 'link' || type === 'text' || type === 'ghost') &&
      'text-primary underline-offset-4',
    action.danger && 'text-red-500 hover:text-red-600',
  );
}

function getButtonSize(action: ActionItem) {
  if (action.size === 0) return undefined;
  return action.size === 'small' ? 'xs' : action.size === 'large' ? 'lg' : 'sm';
}

/** 数组语义是"任一命中即可"；旧写法把数组 join 成一个码，永远匹配不上 */
function hasAuth(auth: ActionItem['auth']): boolean {
  if (!auth) return true;
  return isString(auth)
    ? tableRuntime.checkAuth(auth)
    : tableRuntime.checkAnyAuth(auth);
}

function isShow(action: ActionItem, record: Record<string, any>): boolean {
  if (action.ifShow === false) return false;
  if (isFunction(action.ifShow)) return action.ifShow(record);
  return true;
}

function isDisabled(action: ActionItem, record: Record<string, any>): boolean {
  if (action.disabled === true) return true;
  if (isFunction(action.disabled)) return action.disabled(record);
  return false;
}

function getActionLabel(
  label: ActionItem['label'],
  record: Record<string, any>,
): string | undefined | VNode {
  if (!label) return undefined;
  if (isFunction(label)) return label(record);
  return label;
}

// ============================
// 响应式状态
// ============================

const currentRecord = computed(() => props.record || {});
const actionsRef = computed(() => props.actions || []);
const maxShowCountRef = computed(() => props.maxShowCount || 4);
const moreDropdownOpen = ref(false);
const subDropdownOpenMap = ref<Record<number, boolean>>({});
const popConfirmOpenMap = ref<Record<number, boolean>>({});
const inlineConfirmOpen = ref<Record<string, boolean>>({});
/** 可见的操作项（按权限 / ifShow 过滤） */
const visibleActions = computed(() => {
  return actionsRef.value.filter((action) => {
    if (!hasAuth(action.auth)) return false;
    if (!isShow(action, currentRecord.value)) return false;
    return true;
  });
});

/** 直接显示的操作项（超出则截断） */
const showActions = computed(() => {
  const visibleCount = visibleActions.value.length;
  const displayCount =
    visibleCount > maxShowCountRef.value
      ? maxShowCountRef.value - 1
      : maxShowCountRef.value;
  return visibleActions.value.slice(0, displayCount);
});

/** 放入"更多"下拉的操作项 */
const dropdownActions = computed(() => {
  if (visibleActions.value.length <= maxShowCountRef.value) return [];
  return visibleActions.value.slice(maxShowCountRef.value - 1);
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
// 渲染辅助
// ============================

/** `popConfirm.title/content` 允许字符串或 VNode，交给 Popconfirm 的具名插槽前要成 VNode */
function toNode(value: string | VNode): VNode {
  return isVNode(value) ? value : h('span', String(value));
}

/** 获取某个 action 的 label VNode（兼容字符串 / VNode） */
function getLabelVNode(action: ActionItem): undefined | VNode {
  const label = getActionLabel(action.label, currentRecord.value);
  if (!label) return undefined;
  if (isVNode(label)) return label;
  return h('span', String(label));
}

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
    // 危险操作（如删除）使用红色，普通操作使用灰色
    action.danger
      ? 'text-red-500 hover:bg-red-50'
      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800',
    // 禁用状态覆盖悬浮效果
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
          // 有二次确认时展开内联确认行，而不是直接执行
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
              'bg-muted/60 m-1  rounded-md border p-2 text-sm',
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
                () => '取消',
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
                () => '确定',
              ),
            ]),
          ],
        )
      : null,
  ]);
}

/** 子级下拉中可见的 action（保证渲染索引与点击索引一致） */
function getVisibleSubActions(action: ActionItem) {
  return (action.dropdown ?? []).filter(
    (item) => hasAuth(item.auth) && isShow(item, currentRecord.value),
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
  <div :class="cn('flex items-center justify-center')">
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
        :danger="action.danger"
        @cancel="(e: MouseEvent) => handleCancel(action, index, e)"
        @confirm="(e: MouseEvent) => handleConfirm(action, index, e)"
      >
        <Button
          :variant="getButtonVariant(action)"
          :size="getButtonSize(action)"
          :disabled="isDisabled(action, currentRecord)"
          :class="getButtonClass(action)"
        >
          <Icon v-if="action.icon" :icon="action.icon" />
          <RenderVNode
            v-if="getLabelVNode(action)"
            :vnode="getLabelVNode(action)"
          />
        </Button>
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
          <Button
            :variant="getButtonVariant(action)"
            :size="getButtonSize(action)"
            :disabled="isDisabled(action, currentRecord)"
            :class="getButtonClass(action)"
          >
            <span :class="cn('flex items-center gap-1')">
              <Icon v-if="action.icon" :icon="action.icon" />
              <RenderVNode
                v-if="getLabelVNode(action)"
                :vnode="getLabelVNode(action)"
              />
              <Icon icon="ant-design:down-outlined" />
            </span>
          </Button>
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

      <!-- ============ 普通按钮 ============ -->
      <Button
        v-else
        :variant="getButtonVariant(action)"
        :size="getButtonSize(action)"
        :disabled="isDisabled(action, currentRecord)"
        :class="getButtonClass(action)"
        @click="(e: MouseEvent) => handleClick(action, e)"
      >
        <Icon v-if="action.icon" :icon="action.icon" />
        <RenderVNode
          v-if="getLabelVNode(action)"
          :vnode="getLabelVNode(action)"
        />
      </Button>
    </template>

    <!-- ============ "更多" 下拉菜单 ============ -->
    <template v-if="hasDropdown">
      <Separator
        :class="cn('mx-1 h-3 w-px! shrink-0 bg-gray-200 dark:bg-gray-700')"
        orientation="vertical"
      />
      <Popover v-model:open="moreDropdownOpen">
        <PopoverTrigger as-child>
          <Button :class="getButtonClass({ type: 'link' })" variant="ghost">
            <span :class="cn('flex items-center gap-1')">
              <span>更多</span>
              <Icon icon="ant-design:down-outlined" />
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" :side-offset="4" class="w-auto p-0">
          <component :is="renderMoreDropdownContent" />
        </PopoverContent>
      </Popover>
    </template>
  </div>
</template>
