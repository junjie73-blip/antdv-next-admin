<script setup lang="ts">
import type { FormSchema } from '@antdv/form-ui';
import type { BasicColumn } from '@antdv/table-ui';

import { computed, onMounted, ref, useTemplateRef } from 'vue';

import {
  Alert,
  Badge,
  Card,
  Divider,
  PageHeader,
  Popconfirm,
  Tag,
  Transfer,
} from '@antdv/common-ui';
import { DictType } from '@antdv/enums';
import { BasicForm, useForm } from '@antdv/form-ui';
import {
  BasicDrawer,
  BasicModal,
  message,
  useDrawer,
  useModal,
} from '@antdv/popup-ui';
import { Button, Input } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { BasicTable, useTable } from '@antdv/table-ui';
import { Icon } from '@iconify/vue';
import {
  addPost,
  deletePost,
  getDeptTree,
  getPostList,
  getUserList,
  updatePost,
} from '~/api/system';
import { useDictStore } from '~/stores';

defineOptions({ name: 'SystemPost' });

interface PostRecord {
  id: number;
  name: string;
  code: string;
  deptId: number;
  deptName: string;
  sortOrder: number;
  status: 0 | 1;
  remark: string;
  createdAt: string;
  userCount: number;
  userIds: number[];
}

interface UserRecord {
  id: number;
  username: string;
  nickname: string;
  avatar?: string;
  deptName: string;
}

// ========== 样式类名 ==========
const containerClassName = cn('space-y-4');
const cardClassName = cn('shadow-sm');
const tagClassName = cn('inline-flex items-center gap-1');
const actionClassName = cn(
  'flex',
  'items-center',
  'justify-center',
  'whitespace-nowrap',
);
const btnClassName = cn('h-auto', 'px-0.5!');
const dangerLinkBtnClassName = cn(
  btnClassName,
  'hover:text-destructive text-destructive',
);
const dividerClassName = cn('mx-0');

// ========== 状态映射 ==========
const dictStore = useDictStore();

const statusOptions = computed(() =>
  dictStore.getOptions(DictType.NORMAL_DISABLE),
);

const statusColorMap: Record<number, string> = {
  1: 'green',
  0: 'red',
};
const statusLabelMap: Record<number, string> = {
  1: '正常',
  0: '停用',
};

// 部门树结构（用于表单筛选）
interface DeptTreeNode {
  id: number;
  name: string;
  children?: DeptTreeNode[];
}

/** 部门树来自真实部门接口；异步回填后由函数式 componentProps 自动刷新 */
const deptTreeData = ref<DeptTreeNode[]>([]);

// 用户池 — 用于分配用户功能，数据来自真实用户列表接口
const userPool = ref<UserRecord[]>([]);

onMounted(async () => {
  try {
    const [deptRes, userRes] = await Promise.all([
      getDeptTree(),
      getUserList({ pageNum: 1, pageSize: 200 }),
    ]);
    const depts = (
      Array.isArray(deptRes)
        ? deptRes
        : ((deptRes as { data?: unknown })?.data ?? [])
    ) as DeptTreeNode[];
    deptTreeData.value = depts;
    const data = (userRes as { data?: unknown })?.data ?? userRes;
    const rows = ((data as { list?: unknown })?.list ?? []) as Array<
      Record<string, unknown>
    >;
    userPool.value = rows.map((row) => ({
      id: Number(row.id),
      username: String(row.username ?? ''),
      nickname: String(row.nickname ?? row.username ?? ''),
      avatar: typeof row.avatar === 'string' ? row.avatar : undefined,
      deptName: String(row.deptName ?? ''),
    }));
  } catch (error) {
    const detail = error instanceof Error ? error.message : '未知错误';
    console.error('[post] 基础数据加载失败', error);
    message.error(`部门/用户数据加载失败：${detail}，请刷新页面重试`);
  }
});

// ========== 状态管理 ==========
const isEditing = ref(false);
const currentRecord = ref<null | PostRecord>(null);
const assignPostRecord = ref<null | PostRecord>(null);
const assignSearchKeyword = ref('');
const selectedAssignUserIds = ref<number[]>([]);

const tableRef = useTemplateRef<InstanceType<typeof BasicTable>>('tableRef');
const [drawerRegister, drawerMethods] = useDrawer();
const [assignModalRegister, assignModalMethods] = useModal();
const [tableRegister, tableMethods] = useTable();
const [formRegister, formMethods] = useForm();

// ========== 搜索表单配置 ==========
const searchFormSchemas: FormSchema[] = [
  {
    field: 'name',
    label: '岗位名称',
    component: 'Input',
    colProps: { span: 6 },
    componentProps: {
      placeholder: '搜索岗位名称...',
      allowClear: true,
    },
  },
  {
    field: 'deptId',
    label: '所属部门',
    component: 'TreeSelect',
    colProps: { span: 6 },
    componentProps: () => ({
      treeData: deptTreeData.value,
      fieldNames: { children: 'children', label: 'name', value: 'id' },
      placeholder: '选择部门',
      allowClear: true,
      treeDefaultExpandAll: true,
    }),
  },
  {
    field: 'status',
    label: '状态',
    component: 'Select',
    colProps: { span: 6 },
    componentProps: () => ({
      placeholder: '选择状态',
      allowClear: true,
      options: statusOptions.value,
    }),
  },
];

// ========== 弹窗表单配置 ==========
const modalFormSchemas: FormSchema[] = [
  {
    field: 'name',
    label: '岗位名称',
    component: 'Input',
    required: true,
    colProps: { span: 24 },
    componentProps: { placeholder: '请输入岗位名称' },
  },
  {
    field: 'code',
    label: '岗位编码',
    component: 'Input',
    required: true,
    colProps: { span: 24 },
    componentProps: { placeholder: '请输入岗位编码（唯一），如 POST_FE_001' },
  },
  {
    field: 'deptId',
    label: '所属部门',
    component: 'TreeSelect',
    required: true,
    colProps: { span: 24 },
    componentProps: () => ({
      treeData: deptTreeData.value,
      fieldNames: { children: 'children', label: 'name', value: 'id' },
      placeholder: '请选择所属部门',
      treeDefaultExpandAll: true,
    }),
  },
  {
    field: 'sortOrder',
    label: '排序号',
    component: 'InputNumber',
    colProps: { span: 12 },
    defaultValue: 0,
    componentProps: {
      min: 0,
      placeholder: '数字越小越靠前',
      style: { width: '100%' },
    },
  },
  {
    field: 'status',
    label: '状态',
    component: 'RadioGroup',
    colProps: { span: 12 },
    defaultValue: 0,
    componentProps: () => ({
      optionType: 'button',
      buttonStyle: 'solid',
      options: statusOptions.value,
    }),
  },
  {
    field: 'remark',
    label: '备注',
    component: 'InputTextArea',
    colProps: { span: 24 },
    componentProps: { placeholder: '请输入备注信息...', rows: 3 },
  },
];

// ========== API 适配层 ==========
async function postListApi(params: Record<string, any>) {
  try {
    const res = await getPostList(params);
    const data = (res as { data?: unknown })?.data ?? res;
    const payload = data as undefined | { list?: unknown[]; total?: number };
    return { items: payload?.list ?? [], total: payload?.total ?? 0 };
  } catch (error) {
    const detail = error instanceof Error ? error.message : '未知错误';
    message.error(`岗位列表加载失败：${detail}`);
    return { items: [], total: 0 };
  }
}

// ========== 分配用户相关计算属性与方法 ==========
const availableUsers = computed(() => {
  let list = [...userPool.value];
  if (assignSearchKeyword.value) {
    const kw = assignSearchKeyword.value.toLowerCase();
    list = list.filter(
      (u) =>
        u.nickname.toLowerCase().includes(kw) ||
        u.username.toLowerCase().includes(kw),
    );
  }
  return list;
});

const _assignedUsers = computed(() => {
  if (!assignPostRecord.value) return [];
  return userPool.value.filter((u) =>
    assignPostRecord.value!.userIds.includes(u.id),
  );
});

const _unassignedUsers = computed(() => {
  const assignedIds = new Set(selectedAssignUserIds.value);
  return availableUsers.value.filter((u) => !assignedIds.has(u.id));
});

const transferDataSource = computed(() =>
  userPool.value.map((u) => ({
    key: u.id,
    title: `${u.nickname} (${u.username})`,
  })),
);

function handleOpenAssign(record: PostRecord) {
  assignPostRecord.value = record;
  selectedAssignUserIds.value = [...record.userIds];
  assignSearchKeyword.value = '';
  assignModalMethods.openModal();
}

function _handleToggleAssignUser(user: UserRecord) {
  const idx = selectedAssignUserIds.value.indexOf(user.id);
  if (idx === -1) {
    selectedAssignUserIds.value.push(user.id);
  } else {
    selectedAssignUserIds.value.splice(idx, 1);
  }
}

async function handleSaveAssign() {
  if (!assignPostRecord.value) return;
  try {
    await updatePost(assignPostRecord.value.id, {
      userIds: selectedAssignUserIds.value,
    });
    message.success(
      `已为「${assignPostRecord.value.name}」分配 ${selectedAssignUserIds.value.length} 名用户`,
    );
    assignModalMethods.closeModal();
    tableMethods.value?.reload();
  } catch (error: any) {
    message.error(error?.message || '保存失败');
  }
}

// ========== CRUD 操作 ==========
function handleAdd() {
  isEditing.value = false;
  currentRecord.value = null;
  formMethods.setFieldsValue({
    name: '',
    code: '',
    deptId: undefined,
    sortOrder: 0,
    status: 0,
    remark: '',
  });
  formMethods.clearValidate();
  drawerMethods.openDrawer();
}

function handleEdit(record: PostRecord) {
  isEditing.value = true;
  currentRecord.value = record;
  formMethods.setFieldsValue({
    name: record.name,
    code: record.code,
    deptId: record.deptId,
    sortOrder: record.sortOrder,
    status: record.status,
    remark: record.remark,
  });
  formMethods.clearValidate();
  drawerMethods.openDrawer();
}

async function handleDelete(record: PostRecord) {
  try {
    await deletePost(record.id);
    message.success(`已删除岗位：${record.name}`);
    tableMethods.value?.reload();
  } catch (error: any) {
    message.error(error?.message || '删除失败');
  }
}

async function handleToggleStatus(record: PostRecord) {
  try {
    await updatePost(record.id, { status: record.status === 1 ? 0 : 1 });
    message.success(
      `已${record.status === 1 ? '停用' : '启用'}：${record.name}`,
    );
    tableMethods.value?.reload();
  } catch (error: any) {
    message.error(error?.message || '操作失败');
  }
}

async function handleSave() {
  const values = await formMethods.validate();
  if (!values) return;

  if (!values.name || !values.code) {
    message.warning('请填写岗位名称和编码');
    return;
  }

  try {
    if (isEditing.value && currentRecord.value) {
      await updatePost(currentRecord.value.id, values);
      message.success(`已更新岗位：${values.name}`);
    } else {
      await addPost(values);
      message.success(`已新增岗位：${values.name}`);
    }

    drawerMethods.closeDrawer();
    tableMethods.value?.reload();
  } catch (error: any) {
    message.error(error?.message || '保存失败');
  }
}

// ========== 表格列配置 ==========
const columns: BasicColumn[] = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 70, align: 'center' },
  { title: '岗位名称', dataIndex: 'name', key: 'name', width: 160 },
  {
    title: '岗位编码',
    dataIndex: 'code',
    key: 'code',
    width: 180,
    align: 'center',
  },
  {
    title: '所属部门',
    dataIndex: 'deptName',
    key: 'deptName',
    width: 120,
    align: 'center',
  },
  {
    title: '排序号',
    dataIndex: 'sortOrder',
    key: 'sortOrder',
    width: 80,
    align: 'center',
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 80,
    align: 'center',
  },
  {
    title: '关联用户数',
    dataIndex: 'userCount',
    key: 'userCount',
    width: 100,
    align: 'center',
  },
  {
    title: '创建时间',
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: 170,
    align: 'center',
  },
  { title: '备注', dataIndex: 'remark', key: 'remark', ellipsis: true },
];
</script>

<template>
  <div data-page-view :class="containerClassName">
    <PageHeader
      title="岗位管理"
      description="维护岗位信息与排序，用于人事编制与岗位归属"
      icon="carbon:badge"
    >
      <template #extra>
        <Button @click="handleAdd">
          <Icon icon="ant-design:plus-outlined" />
          新增岗位
        </Button>
      </template>
    </PageHeader>

    <Card title="岗位列表" :class="cardClassName">
      <BasicTable
        ref="tableRef"
        :columns="columns"
        :api="postListApi"
        :immediate="true"
        :use-search-form="true"
        :form-config="{ schemas: searchFormSchemas, labelWidth: 80 }"
        :pagination="{
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50'],
        }"
        :scroll="{ x: 1400 }"
        :action-column="{ width: 280, title: '操作', fixed: 'right' }"
        @register="tableRegister"
      >
        <template #cell-status="{ record }">
          <Tag :color="statusColorMap[record.status] || 'default'">
            <span :class="tagClassName">
              <Icon
                :icon="
                  record.status === 1
                    ? 'carbon:checkmark-outline'
                    : 'carbon:close-outline'
                "
              />
              {{ statusLabelMap[record.status] || '未知' }}
            </span>
          </Tag>
        </template>

        <template #cell-userCount="{ record }">
          <Badge
            :count="record.userCount"
            :number-style="{ backgroundColor: '#1677ff' }"
          />
        </template>

        <template #action="{ record }">
          <div :class="actionClassName">
            <Button
              :class="btnClassName"
              variant="link"
              @click="() => handleOpenAssign(record as PostRecord)"
            >
              <Icon icon="ant-design:user-switch-outlined" />
              分配用户
            </Button>
            <Divider type="vertical" :class="dividerClassName" />
            <Button
              :class="btnClassName"
              variant="link"
              @click="() => handleEdit(record as PostRecord)"
            >
              <Icon icon="ant-design:edit-outlined" />
              编辑
            </Button>
            <Divider type="vertical" :class="dividerClassName" />
            <Popconfirm
              :title="`确定要「${record.status === 1 ? '停用' : '启用'}」岗位「${record.name}」吗？`"
              @confirm="() => handleToggleStatus(record as PostRecord)"
            >
              <Button
                v-if="record.status === 1"
                :class="btnClassName"
                variant="link"
              >
                停用
              </Button>
              <Button v-else :class="btnClassName" variant="link">
                启用
              </Button>
            </Popconfirm>
            <Divider type="vertical" :class="dividerClassName" />
            <Popconfirm
              :title="`确定要删除岗位「${record.name}」吗？`"
              @confirm="() => handleDelete(record as PostRecord)"
            >
              <Button :class="dangerLinkBtnClassName" variant="link">
                <Icon icon="ant-design:delete-outlined" />
                删除
              </Button>
            </Popconfirm>
          </div>
        </template>
      </BasicTable>
    </Card>

    <!-- 新增/编辑抽屉 -->
    <BasicDrawer
      :title="isEditing ? '编辑岗位' : '新增岗位'"
      :width="560"
      @register="drawerRegister"
      @ok="handleSave"
    >
      <BasicForm
        :schemas="modalFormSchemas"
        :label-width="90"
        :show-action-button-group="false"
        :grid="{ cols: 2, gutter: 16 }"
        @register="formRegister"
      />
    </BasicDrawer>

    <!-- 分配用户弹窗 -->
    <BasicModal
      :title="`分配用户 - ${assignPostRecord?.name || ''}`"
      :width="720"
      @register="assignModalRegister"
      @ok="handleSaveAssign"
    >
      <div class="space-y-4">
        <!-- 岗位信息提示 -->
        <Alert
          message="选择要分配到该岗位的用户，支持多选"
          type="info"
          show-icon
        />

        <div class="flex items-center gap-4 text-muted-foreground text-sm">
          <span>岗位编码：<Tag color="blue">{{
              assignPostRecord?.code
            }}</Tag></span>
          <span>所属部门：<Tag color="cyan">{{
              assignPostRecord?.deptName
            }}</Tag></span>
          <span>已选：<Tag color="orange">{{ selectedAssignUserIds.length }} 人</Tag></span>
        </div>

        <!-- 搜索框 -->
        <div class="relative">
          <Icon
            class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            icon="ant-design:search-outlined"
          />
          <Input
            v-model="assignSearchKeyword"
            class="pl-8"
            placeholder="搜索用户名/昵称..."
            type="search"
          />
        </div>

        <!-- Transfer 穿梭框 -->
        <Transfer
          v-model:target-keys="selectedAssignUserIds"
          :data-source="transferDataSource"
          :titles="['待选用户', '已选用户']"
          :render="(item: any) => item.title"
          show-search
        />
      </div>
    </BasicModal>
  </div>
</template>
