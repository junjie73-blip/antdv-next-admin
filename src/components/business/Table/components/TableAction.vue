<script setup lang="ts">

import { Button, Divider, Dropdown, Popconfirm } from "antdv-next";
import { isFunction } from "es-toolkit";
import { computed, defineComponent, h, isVNode } from "vue";

import type { VNode } from "vue";

import type { ActionItem } from "../types";


import { IconifyIcon as Icon } from "@/components/common/Icon";
import { cn } from "@/utils/cn";





type ButtonType = "default" | "link" | "dashed" | "text" | "primary";

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
  name: "RenderVNode",
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
  const type = action.type || "link";
  // antdv-next 不支持 ghost，映射为 default
  if (type === "ghost") return "default";
  return type as ButtonType;
}

function getButtonSize(action: ActionItem): "small" | "middle" | "large" | undefined {
  return action.size || undefined;
}

function hasAuth(auth: ActionItem["auth"]): boolean {
  if (!auth) return true;
  // 可根据实际权限系统调整
  return true;
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
  label: ActionItem["label"],
  record: Record<string, any>,
): string | VNode | undefined {
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
    visibleCount > maxShowCountRef.value ? maxShowCountRef.value - 1 : maxShowCountRef.value;
  return visibleActions.value.slice(0, displayCount);
});

/** 放入"更多"下拉的操作项 */
const dropdownActions = computed(() => {
  if (visibleActions.value.length <= maxShowCountRef.value) return [];
  return visibleActions.value.slice(maxShowCountRef.value - 1);
});

const hasDropdown = computed(() => dropdownActions.value.length > 0);

/** "更多"下拉菜单项 */
const moreDropdownItems = computed(() => {
  return dropdownActions.value.map((action, i) => ({
    key: i,
    label: getActionLabel(action.label, currentRecord.value) || "操作",
    danger: action.danger,
    disabled: isDisabled(action, currentRecord.value),
  }));
});

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

function onSubDropdownMenuClick(action: ActionItem, info: { key: string; domEvent?: Event }) {
  if (action.dropdown) {
    handleDropdownMenuClick(action.dropdown, info);
  }
}

// ============================
// 渲染辅助
// ============================

/** 获取某个 action 的 label VNode（兼容字符串 / VNode） */
function getLabelVNode(action: ActionItem): VNode | null {
  const label = getActionLabel(action.label, currentRecord.value);
  if (!label) return null;
  if (isVNode(label)) return label;
  return h("span", String(label));
}

/** 获取子级 Dropdown 菜单项 */
function getSubDropdownItems(action: ActionItem) {
  return (
    action.dropdown
      ?.filter((item) => item.ifShow !== false)
      ?.map((item, i) => ({
        key: i,
        label: getActionLabel(item.label, currentRecord.value),
        danger: item.danger,
        disabled: isDisabled(item, currentRecord.value),
      })) ?? []
  );
}

/** 强制 Popconfirm / Dropdown 渲染到 body，避免被表格固定列裁剪 */
function getPopupContainer() {
  return document.body;
}
</script>

<template>
  <div :class="cn('flex items-center justify-center')">
    <template v-for="(action, index) in showActions"
:key="index">
      <!-- 分割线 -->
      <Divider v-if="index !== 0"
type="vertical"
:class="cn('mx-0')" />

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
          <template v-if="action.icon"
#icon>
            <Icon :icon="action.icon" />
          </template>
          <template #default>
            <RenderVNode v-if="getLabelVNode(action)"
:vnode="getLabelVNode(action)" />
          </template>
        </Button>
      </Popconfirm>

      <!-- ============ Dropdown 类型 ============ -->
      <Dropdown
        v-else-if="action.dropdown && action.dropdown.length > 0"
        :menu="{ items: getSubDropdownItems(action) }"
        :get-popup-container="getPopupContainer"
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
              <Icon v-if="action.icon"
:icon="action.icon" />
              <RenderVNode v-if="getLabelVNode(action)"
:vnode="getLabelVNode(action)" />
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
        <template v-if="action.icon"
#icon>
          <Icon :icon="action.icon" />
        </template>
        <template #default>
          <RenderVNode v-if="getLabelVNode(action)"
:vnode="getLabelVNode(action)" />
        </template>
      </Button>
    </template>

    <!-- ============ "更多" 下拉菜单 ============ -->
    <template v-if="hasDropdown">
      <Divider type="vertical"
:class="cn('mx-0')" />
      <Dropdown
        :menu="{ items: moreDropdownItems }"
        :get-popup-container="getPopupContainer"
        @menu-click="(info) => handleDropdownMenuClick(dropdownActions, info)"
      >
        <Button type="link"
:class="cn('!px-0.5')">
          <span :class="cn('flex items-center gap-1')">
            <span>更多</span>
            <Icon icon="ant-design:down-outlined" />
          </span>
        </Button>
      </Dropdown>
    </template>
  </div>
</template>
