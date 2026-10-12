<script setup lang="ts">
import type { BasicColumn, Recordable } from '~/components/business/Table';

import { computed, ref } from 'vue';

import { cn } from '@antdv/shared/cn';
import { message } from 'antdv-next';
import { BasicTable, useTable } from '~/components/business/Table';

const containerClassName = cn('space-y-6');
const toolbarClassName = cn(
  'mb-4',
  'flex',
  'flex-wrap',
  'justify-between',
  'items-center',
  'gap-2',
);
const descriptionClassName = cn('text-sm', 'text-gray-500');
const orderClassName = cn('mt-3', 'flex', 'flex-wrap', 'items-center', 'gap-1');
const dragHandleClassName = cn(
  'drag-handle',
  'cursor-grab',
  'select-none',
  'text-gray-400',
);
const savedLineClassName = cn('mt-3', 'font-mono', 'text-sm', 'text-gray-500');

const stageColorMap: Record<string, string> = {
  进行中: 'blue',
  已完成: 'green',
  待启动: 'orange',
};

/**
 * 拖拽排序是 `BasicTable` 的属性（`dragSort` + `dragSortConfig`），
 * 组件挂载时会把 Sortable 绑到自己的 `<tbody>` 上，排完直接改内部数据源。
 * 页面只在 `onDragEnd` 里把新顺序写回自己的状态（真实项目里这一步是调后端保存接口）。
 */

// ============================================
// 1. 基础拖拽排序
// ============================================

const basicList = ref<Recordable[]>([
  { id: 1, name: '首页改版', owner: '王芳', stage: '进行中' },
  { id: 2, name: '订单中心', owner: '李强', stage: '已完成' },
  { id: 3, name: '商品库', owner: '赵敏', stage: '进行中' },
  { id: 4, name: '库存同步', owner: '陈晨', stage: '待启动' },
  { id: 5, name: '数据报表', owner: '刘洋', stage: '进行中' },
  { id: 6, name: '系统设置', owner: '孙磊', stage: '已完成' },
]);

const basicColumns: BasicColumn[] = [
  { title: '模块', dataIndex: 'name', key: 'name' },
  { title: '负责人', dataIndex: 'owner', key: 'owner', width: 120 },
  {
    title: '阶段',
    dataIndex: 'stage',
    key: 'stage',
    width: 120,
    align: 'center',
  },
];

const dragCount = ref(0);

const [registerBasic] = useTable({
  columns: basicColumns,
  rowKey: 'id',
  pagination: false,
  scroll: {},
  rowClassName: cn('cursor-move'),
  dragSort: true,
  dragSortConfig: {
    onDragEnd: (newData) => {
      basicList.value = newData;
      dragCount.value += 1;
    },
  },
});

// ============================================
// 2. 手柄拖拽
// ============================================

const handleList = ref<Recordable[]>([
  { id: 1, name: '快捷入口', note: '首页金刚区配置项' },
  { id: 2, name: '消息通知', note: '站内信与推送开关' },
  { id: 3, name: '常用报表', note: '可拖到工作台顶部' },
  { id: 4, name: '审批流模板', note: '仅管理员可见' },
  { id: 5, name: '帮助文档', note: '按使用频率排序' },
]);

const handleColumns: BasicColumn[] = [
  { title: '拖拽', key: 'dragHandle', width: 60, align: 'center' },
  { title: '功能块', dataIndex: 'name', key: 'name', width: 160 },
  { title: '说明', dataIndex: 'note', key: 'note' },
];

const [registerHandle] = useTable({
  columns: handleColumns,
  rowKey: 'id',
  pagination: false,
  scroll: {},
  dragSort: true,
  dragSortConfig: {
    handle: '.drag-handle',
    onDragEnd: (newData) => {
      handleList.value = newData;
    },
  },
});

// ============================================
// 3. 禁止某些行被拖动 / 禁止落点
// ============================================

const frozenList = ref<Recordable[]>([
  { id: 1, name: '置顶公告', pinned: true },
  { id: 2, name: '活动 Banner' },
  { id: 3, name: '新人指南' },
  { id: 4, name: '系统基线', locked: true },
  { id: 5, name: '版本说明' },
  { id: 6, name: '常见问题' },
]);

const frozenColumns: BasicColumn[] = [
  { title: '栏目', dataIndex: 'name', key: 'name' },
  { title: '约束', key: 'constraint', width: 160, align: 'center' },
];

/** 开关演示 `disabled: true` 的布尔形态：整表冻结，任何行都拖不起来 */
const freezeAll = ref(false);

/**
 * 走模板属性绑定而不是 `useTable` 的初始 props：配置对象换了引用，
 * `BasicTable` 内部按属性现读，开关一拨就立刻生效，不需要重建 Sortable。
 */
const frozenConfig = computed(() => ({
  disabled: freezeAll.value
    ? true
    : (record: Recordable) => record.pinned === true,
  canDrop: (_drag: Recordable, drop: Recordable) => drop.locked !== true,
  onDragEnd: (newData: Recordable[]) => {
    frozenList.value = newData;
  },
}));

const [registerFrozen] = useTable({
  columns: frozenColumns,
  rowKey: 'id',
  pagination: false,
  scroll: {},
});

// ============================================
// 4. 保存顺序
// ============================================

const saveList = ref<Recordable[]>([
  { id: 1, name: '轮播图', count: 5 },
  { id: 2, name: '热门榜单', count: 12 },
  { id: 3, name: '最近更新', count: 8 },
  { id: 4, name: '编辑精选', count: 3 },
  { id: 5, name: '页脚导航', count: 6 },
]);

const saveColumns: BasicColumn[] = [
  { title: '首页栏目', dataIndex: 'name', key: 'name' },
  {
    title: '内容数',
    dataIndex: 'count',
    key: 'count',
    width: 100,
    align: 'center',
  },
];

const savedOrder = ref('');

const currentOrder = computed(() =>
  saveList.value.map((item) => item.id).join(','),
);
const orderDirty = computed(() => currentOrder.value !== savedOrder.value);

const [registerSave] = useTable({
  columns: saveColumns,
  rowKey: 'id',
  pagination: false,
  scroll: {},
  rowClassName: cn('cursor-move'),
  dragSort: true,
  dragSortConfig: {
    onDragEnd: (newData) => {
      saveList.value = newData;
    },
  },
});

// 仓库请求层（src/api）没有可复用的排序保存接口，这里明确用本地 ref 模拟落库：
// 不发网络请求、不伪造后端调用，刷新页面即回到初始顺序。
function handleSaveOrder() {
  savedOrder.value = currentOrder.value;
  message.success(
    `已保存 ${saveList.value.length} 条顺序（本地模拟，未调用后端接口）`,
  );
}
</script>

<template>
  <div :class="containerClassName">
    <a-card title="基础拖拽排序" variant="borderless">
      <div :class="toolbarClassName">
        <span :class="descriptionClassName">
          `dragSort: true`
          后整行任意位置均可按住拖动，松开即换位；下方实时展示当前顺序。
        </span>
        <a-tag color="blue">已调整 {{ dragCount }} 次</a-tag>
      </div>
      <BasicTable :data-source="basicList" @register="registerBasic">
        <template #cell-stage="{ record }">
          <a-tag :color="stageColorMap[record?.stage] || 'default'">
            {{ record?.stage }}
          </a-tag>
        </template>
      </BasicTable>
      <div :class="orderClassName">
        <span :class="descriptionClassName">当前顺序：</span>
        <a-tag v-for="(item, index) in basicList" :key="item.id">
          {{ index + 1 }}. {{ item.name }}
        </a-tag>
      </div>
    </a-card>

    <a-card title="手柄拖拽" variant="borderless">
      <div :class="toolbarClassName">
        <span :class="descriptionClassName">
          `dragSortConfig.handle` 把拖拽触发区收敛到 ⠿
          图标列：行内文字仍可正常选中复制，
          不会出现“想选字却把整行拖走”的误操作，这是带文本表格的推荐默认。
        </span>
      </div>
      <BasicTable :data-source="handleList" @register="registerHandle">
        <template #cell-dragHandle>
          <span :class="dragHandleClassName" title="按住此处拖动整行">⠿</span>
        </template>
      </BasicTable>
    </a-card>

    <a-card title="禁止某些行被拖动 / 禁止落点" variant="borderless">
      <div :class="toolbarClassName">
        <span :class="descriptionClassName">
          函数形态 `disabled` 让“置顶公告”拖不起来；`canDrop`
          在落点经过“系统基线”（锁定行） 时返回
          false，任何行都无法越过它。开关切成布尔形态 `disabled:
          true`，一次性冻结整张表。
        </span>
        <span class="flex items-center gap-2">
          <span :class="descriptionClassName">整表冻结</span>
          <a-switch v-model:checked="freezeAll" />
        </span>
      </div>
      <BasicTable
        :data-source="frozenList"
        :drag-sort="true"
        :drag-sort-config="frozenConfig"
        @register="registerFrozen"
      >
        <template #cell-constraint="{ record }">
          <a-tag v-if="record?.pinned" color="red">置顶 · 不可拖动</a-tag>
          <a-tag v-else-if="record?.locked" color="purple">
            锁定 · 不可跨越
          </a-tag>
          <span v-else>—</span>
        </template>
      </BasicTable>
    </a-card>

    <a-card title="保存顺序" variant="borderless">
      <div :class="toolbarClassName">
        <span :class="descriptionClassName">
          仓库请求层（src/api）没有现成的排序保存接口，这里用本地 ref
          模拟持久化， 不伪造后端调用：点“保存顺序”只把当前 id
          序列快照进页面状态，刷新即丢。
        </span>
        <a-space>
          <a-tag v-if="!orderDirty" color="green">顺序与已保存一致</a-tag>
          <a-tag v-else color="orange">有未保存的改动</a-tag>
          <a-button
            type="primary"
            size="small"
            :disabled="!orderDirty"
            @click="handleSaveOrder"
          >
            保存顺序
          </a-button>
        </a-space>
      </div>
      <BasicTable :data-source="saveList" @register="registerSave" />
      <div :class="savedLineClassName">
        {{
          savedOrder
            ? `最近一次保存（本地 ref）：${savedOrder}`
            : '最近一次保存（本地 ref）：尚未保存'
        }}
      </div>
    </a-card>
  </div>
</template>
