<script setup lang="ts">
import type { VNode } from 'vue';

import type { ActionItem } from '../types';

import { computed, defineComponent, h, isVNode } from 'vue';

import { cn } from '@antdv/shared/cn';
import { IconifyIcon as Icon } from '@antdv/ui/icon';
import { Button, Divider, Dropdown, Popconfirm } from 'antdv-next';
import { isFunction, isString } from 'es-toolkit';
import { usePermission } from '~/composables';

type ButtonType = 'dashed' | 'default' | 'link' | 'primary' | 'text';

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
const { hasPermission } = usePermission();
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

function getButtonType(action: ActionItem): ButtonType {
  const type = action.type || 'link';
  // antdv-next 不支持 ghost，映射为 default
  if (type === 'ghost') return 'default';
  return type as ButtonType;
}

function getButtonSize(
  action: ActionItem,
): 'large' | 'middle' | 'small' | undefined {
  return action.size || undefined;
}

function hasAuth(auth: ActionItem['auth']): boolean {
  if (!auth) return true;
  // 可根据实际权限系统调整
  return hasPermission(isString(auth) ? auth : auth.join(','));
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
const subDropdownOpenMap = ref(false);
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

function handleConfirm(action: ActionItem, e?: MouseEvent) {
  if (action.popConfirm?.confirm && e) {
    action.popConfirm.confirm(currentRecord.value, e);
  }
}

function handleCancel(action: ActionItem, e?: MouseEvent) {
  if (action.popConfirm?.cancel && e) {
    action.popConfirm.cancel(currentRecord.value, e);
  }
}

function handleDropdownMenuClick(
  actionList: ActionItem[],
  info: { key: string; domEvent?: Event },
) {
  const index = Number(info.key);
  const action = actionList[index];
  if (action?.onClick) {
    info.domEvent?.stopPropagation?.();
    action.onClick(currentRecord.value, info.domEvent as MouseEvent);
  }
}

function onSubDropdownMenuClick(
  action: ActionItem,
  info: { key: string; domEvent?: Event },
) {
  if (action.dropdown) {
    handleDropdownMenuClick(action.dropdown, info);
  }
}

// ============================
// 渲染辅助
// ============================

/** 获取某个 action 的 label VNode（兼容字符串 / VNode） */
function getLabelVNode(action: ActionItem): null | VNode {
  const label = getActionLabel(action.label, currentRecord.value);
  if (!label) return null;
  if (isVNode(label)) return label;
  return h('span', String(label));
}

/** 强制 Popconfirm / Dropdown 渲染到 body，避免被表格固定列裁剪 */
function getPopupContainer() {
  return document.body;
}
function getDropdownItemPopupContainer(trigger?: HTMLElement) {
  return trigger?.parentElement || document.body;
}
/** 渲染下拉菜单里的单个 action（含 Popconfirm 分支） */
function renderDropdownAction(
  action: ActionItem,
  key: number | string,
  closeDropdown: () => void,
) {
  const disabled = isDisabled(action, currentRecord.value);
  const label = getActionLabel(action.label, currentRecord.value) ?? '操作';
  const labelVNode = isVNode(label) ? label : h('span', String(label));

  // 核心：完全模拟 antdv-next 的 dropdown-item 样式
  const itemClass = cn(
    'mx-1 flex cursor-pointer items-center gap-2 rounded-sm px-3 py-1.5 text-sm transition-colors duration-200 select-none',
    // 危险操作（如删除）使用红色，普通操作使用灰色
    action.danger
      ? 'text-red-500 hover:bg-red-50'
      : 'text-gray-700 hover:bg-gray-100',
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
        if (action.popConfirm) return; // 有 Popconfirm 时不直接执行，交给 Popconfirm
        action.onClick?.(currentRecord.value, e);
        closeDropdown();
      },
    },
    [
      // 图标部分
      action.icon
        ? h(Icon, { icon: action.icon, class: 'text-base shrink-0' })
        : null,
      // 文本部分，超出截断
      h('span', { class: 'truncate' }, [labelVNode]),
    ],
  );

  // 没有二次确认，直接返回带事件的 div
  if (!action.popConfirm) {
    return h('div', { key }, [content]);
  }

  // 有二次确认，用 Popconfirm 包裹
  return h('div', { key }, [
    h(
      Popconfirm,
      {
        title: action.popConfirm.title,
        description: action.popConfirm.content,
        zIndex: 999_999,
        disabled, // 禁用时 Popconfirm 也不应弹出
        getPopupContainer: getDropdownItemPopupContainer,
        onConfirm: (e: MouseEvent) => {
          if (action.popConfirm?.confirm) {
            action.popConfirm.confirm(currentRecord.value, e);
          } else {
            action.onClick?.(currentRecord.value, e);
          }
          closeDropdown();
        },
        onCancel: (e: MouseEvent) => {
          action.popConfirm?.cancel?.(currentRecord.value, e);
        },
      },
      { default: () => content },
    ),
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
    { class: 'py-1.5 min-w-[120px] bg-white dark:bg-slate-500 rounded' },
    dropdownActions.value.map((action, i) =>
      renderDropdownAction(action, i, () => {
        moreDropdownOpen.value = false;
      }),
    ),
  );
}

/** 渲染子级下拉内容 */
function renderSubDropdownContent(action: ActionItem, index: number) {
  return h(
    'div',
    { class: 'py-1.5  min-w-[120px]  bg-white dark:bg-slate-500 rounded' },
    getVisibleSubActions(action).map((item, i) =>
      renderDropdownAction(item, i, () => {
        subDropdownOpenMap.value[index] = false;
      }),
    ),
  );
}
</script>

<template>
  <div :class="cn('flex items-center justify-center')">
    <template v-for="(action, index) in showActions" :key="index">
      <!-- 分割线 -->
      <Divider v-if="index !== 0" type="vertical" :class="cn('mx-0')" />

      <!-- ============ Popconfirm 类型 ============ -->
      <Popconfirm
        v-if="action.popConfirm"
        :title="action.popConfirm.title"
        :description="action.popConfirm.content"
        :get-popup-container="getPopupContainer"
        :z-index="999999"
        @confirm="(e) => handleConfirm(action, e)"
        @cancel="(e) => handleCancel(action, e)"
      >
        <Button
          :type="getButtonType(action)"
          :size="getButtonSize(action)"
          :disabled="isDisabled(action, currentRecord)"
          :danger="action.danger"
          :class="cn('!px-0.5')"
          @click="(e) => handleClick(action, e)"
        >
          <template v-if="action.icon" #icon>
            <Icon :icon="action.icon" />
          </template>
          <template #default>
            <RenderVNode
              v-if="getLabelVNode(action)"
              :vnode="getLabelVNode(action)"
            />
          </template>
        </Button>
      </Popconfirm>

      <!-- ============ Dropdown 类型 ============ -->
      <Dropdown
        v-else-if="action.dropdown && action.dropdown.length > 0"
        v-model:open="subDropdownOpenMap[index]"
        :popup-render="() => renderSubDropdownContent(action, index)"
        :styles="{ popup: { zIndex: 999999 } }"
        @menu-click="(info) => onSubDropdownMenuClick(action, info)"
      >
        <Button
          :type="getButtonType(action)"
          :size="getButtonSize(action)"
          :disabled="isDisabled(action, currentRecord)"
          :danger="action.danger"
          :class="cn('!px-0.5')"
        >
          <template #default>
            <span :class="cn('flex items-center gap-1')">
              <Icon v-if="action.icon" :icon="action.icon" />
              <RenderVNode
                v-if="getLabelVNode(action)"
                :vnode="getLabelVNode(action)"
              />
              <Icon icon="ant-design:down-outlined" />
            </span>
          </template>
        </Button>
      </Dropdown>

      <!-- ============ 普通按钮 ============ -->
      <Button
        v-else
        :type="getButtonType(action)"
        :size="getButtonSize(action)"
        :disabled="isDisabled(action, currentRecord)"
        :danger="action.danger"
        :class="cn('!px-0.5')"
        @click="(e) => handleClick(action, e)"
      >
        <template v-if="action.icon" #icon>
          <Icon :icon="action.icon" />
        </template>
        <template #default>
          <RenderVNode
            v-if="getLabelVNode(action)"
            :vnode="getLabelVNode(action)"
          />
        </template>
      </Button>
    </template>

    <!-- ============ "更多" 下拉菜单 ============ -->
    <template v-if="hasDropdown">
      <Divider type="vertical" :class="cn('mx-0')" />
      <Dropdown
        v-model:open="moreDropdownOpen"
        :popup-render="renderMoreDropdownContent"
        :get-popup-container="getPopupContainer"
        @menu-click="(info) => handleDropdownMenuClick(dropdownActions, info)"
      >
        <Button type="link" :class="cn('!px-0.5')">
          <span :class="cn('flex items-center gap-1')">
            <span>更多</span>
            <Icon icon="ant-design:down-outlined" />
          </span>
        </Button>
      </Dropdown>
    </template>
  </div>
</template>
