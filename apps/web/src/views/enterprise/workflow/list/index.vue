<script setup lang="ts">
import type { WorkflowDefinition, WorkflowListData } from '~/api/enterprise';

import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Card, PageHeader, Popconfirm, Segmented, Tag } from '@antdv/common-ui';
import { BasicModal, message, useModal } from '@antdv/popup-ui';
import { Button, Input } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { Icon } from '@iconify/vue';
import {
  deleteWorkflow,
  getWorkflowList,
  saveWorkflow,
  updateWorkflowStatus,
} from '~/api/enterprise';
import { formatCount, unwrapApi } from '~/utils/log-format';

import AsyncState from '../../../system/components/AsyncState.vue';
import ResourceCard from '../../components/ResourceCard.vue';

/**
 * 流程列表（参考实现 `/template/workflow/list`）。
 *
 * 与既有 `/enterprise/workflow` 的「单流程引擎演示」不同，这一页是**流程定义的台账**：
 * 卡片墙 + 状态/负责人/分类筛选 + 新建/启停/删除 + 分页，数据全部来自 backend-mock，
 * 改完刷新页面仍在，不再是内存里一刷新就重置的假数据。
 */
defineOptions({ name: 'EnterpriseWorkflowList' });

const STATUS_LABELS: Record<string, string> = {
  disabled: '已停用',
  draft: '草稿',
  published: '已发布',
};
const STATUS_TONES: Record<
  string,
  'error' | 'info' | 'neutral' | 'success' | 'warning'
> = {
  disabled: 'neutral',
  draft: 'warning',
  published: 'success',
};
const STATUS_OPTIONS = ['全部状态', '已发布', '草稿', '已停用'];
const SORT_OPTIONS = ['最近更新', '运行次数', '名称升序'];
const STATUS_VALUE: Record<string, string> = {
  全部状态: '',
  已发布: 'published',
  草稿: 'draft',
  已停用: 'disabled',
};
const SORT_VALUE: Record<string, string> = {
  最近更新: 'updated',
  运行次数: 'runs',
  名称升序: 'name',
};

const router = useRouter();

const containerClassName = cn('space-y-4');
const cardClassName = cn('shadow-sm');
const filterClassName = cn('flex flex-wrap items-center gap-3');
const gridClassName = cn(
  'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4',
);
const footerClassName = cn(
  'border-border mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4',
);
const metaClassName = cn('text-muted-foreground truncate text-xs');
const hintClassName = cn('text-muted-foreground text-xs');
const formClassName = cn('space-y-3');
const fieldLabelClassName = cn(
  'text-muted-foreground mb-1.5 block text-xs font-medium',
);

const keyword = ref('');
const statusTab = ref('全部状态');
const sortTab = ref('最近更新');
const pageNum = ref(1);
const pageSize = 12;

const data = ref<null | WorkflowListData>(null);
const loading = ref(false);
const error = ref('');
const submitting = ref(false);
const pendingId = ref('');

const form = ref({ category: '', description: '', name: '', owner: '' });
const [modalRegister, modalMethods] = useModal();

const totalPages = computed(() =>
  Math.max(1, Math.ceil((data.value?.total ?? 0) / pageSize)),
);
const summary = computed(
  () =>
    data.value?.summary ?? { disabled: 0, draft: 0, published: 0, total: 0 },
);
const list = computed(() => data.value?.list ?? []);

let searchTimer: ReturnType<typeof setTimeout> | undefined;

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const res = await getWorkflowList({
      keyword: keyword.value,
      pageNum: pageNum.value,
      pageSize,
      sort: SORT_VALUE[sortTab.value],
      status: STATUS_VALUE[statusTab.value],
    });
    data.value = unwrapApi<null | WorkflowListData>(res) ?? null;
  } catch (error) {
    error.value =
      error instanceof Error ? error.message : '流程列表接口暂不可用';
  } finally {
    loading.value = false;
  }
}

onMounted(load);
onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer);
});

function onKeywordChange() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    pageNum.value = 1;
    load();
  }, 350);
}

function onFilterChange() {
  pageNum.value = 1;
  load();
}

function changePage(delta: number) {
  const next = Math.min(Math.max(pageNum.value + delta, 1), totalPages.value);
  if (next === pageNum.value) return;
  pageNum.value = next;
  load();
}

function openCreate() {
  form.value = { category: '', description: '', name: '', owner: '' };
  modalMethods.openModal();
}

async function handleCreate() {
  if (submitting.value) return;
  if (!form.value.name.trim()) {
    message.warning('请输入流程名称');
    return;
  }
  submitting.value = true;
  try {
    await saveWorkflow({ ...form.value });
    message.success('流程已创建');
    modalMethods.closeModal();
    pageNum.value = 1;
    await load();
  } catch (error) {
    message.error(
      error instanceof Error ? error.message : '新建失败，请稍后重试',
    );
  } finally {
    submitting.value = false;
  }
}

async function toggleStatus(item: WorkflowDefinition) {
  if (pendingId.value) return;
  pendingId.value = item.id;
  try {
    const next = item.status === 'published' ? 'disabled' : 'published';
    await updateWorkflowStatus({ id: item.id, status: next });
    message.success('流程状态已更新');
    await load();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '状态更新失败');
  } finally {
    pendingId.value = '';
  }
}

async function handleDelete(item: WorkflowDefinition) {
  if (pendingId.value) return;
  pendingId.value = item.id;
  try {
    await deleteWorkflow(item.id);
    message.success('流程已删除');
    await load();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '删除失败');
  } finally {
    pendingId.value = '';
  }
}

function openDesigner() {
  router.push('/enterprise/workflow');
}

function clearFilters() {
  keyword.value = '';
  statusTab.value = '全部状态';
  sortTab.value = '最近更新';
  pageNum.value = 1;
  load();
}
</script>

<template>
  <div data-page-view :class="containerClassName">
    <PageHeader
      title="流程列表"
      :description="`共 ${summary.total} 个流程，${summary.published} 个已发布，${summary.draft + summary.disabled} 个待发布`"
      icon="carbon:flow"
    >
      <template #extra>
        <Button size="sm" @click="openCreate">
          <Icon icon="carbon:add" />
          新建流程
        </Button>
      </template>
    </PageHeader>

    <Card :class="cardClassName">
      <div :class="filterClassName">
        <Input
          v-model="keyword"
          class="max-w-72"
          placeholder="搜索名称、分类或负责人"
          @update:model-value="onKeywordChange"
        />
        <Segmented
          v-model:value="statusTab"
          :options="STATUS_OPTIONS"
          size="small"
          @update:value="onFilterChange"
        />
        <Segmented
          v-model:value="sortTab"
          :options="SORT_OPTIONS"
          size="small"
          @update:value="onFilterChange"
        />
        <Tag color="blue">{{ data?.total ?? 0 }} 条</Tag>
      </div>
    </Card>

    <AsyncState
      :loading="loading"
      :error="error"
      :empty="!loading && list.length === 0"
      @retry="load"
    >
      <template #empty>
        <Icon icon="carbon:flow" class="size-8 text-muted-foreground" />
        <p :class="hintClassName">没有符合筛选条件的流程</p>
        <Button variant="outline" size="sm" @click="clearFilters">
          清除筛选
        </Button>
      </template>

      <div :class="gridClassName">
        <ResourceCard
          v-for="item in list"
          :key="item.id"
          :title="item.name"
          :eyebrow="`${item.version} · ${item.category}`"
          :description="item.description"
          icon="carbon:flow"
          :tags="[item.category]"
          :status-label="STATUS_LABELS[item.status]"
          :status-tone="STATUS_TONES[item.status]"
          :metrics="[
            { label: '运行次数', value: formatCount(item.runCount) },
            { label: '节点数', value: String(item.nodeCount) },
            { label: '负责人', value: item.owner },
          ]"
        >
          <template #meta>
            <span
              :class="metaClassName"
              :title="`${item.owner} · 更新于 ${item.updatedAt}`"
            >
              {{ item.owner }} · {{ item.updatedAt }}
            </span>
          </template>
          <template #actions>
            <Button variant="link" size="sm" @click="openDesigner">
              进入设计器
            </Button>
            <Button
              variant="ghost"
              size="sm"
              :disabled="pendingId === item.id"
              @click="toggleStatus(item)"
            >
              {{ item.status === 'published' ? '停用' : '启用' }}
            </Button>
            <Popconfirm
              :title="`确定删除「${item.name}」吗？删除后无法恢复。`"
              danger
              @confirm="handleDelete(item)"
            >
              <Button
                variant="ghost"
                size="sm"
                :disabled="pendingId === item.id"
              >
                删除
              </Button>
            </Popconfirm>
          </template>
        </ResourceCard>
      </div>

      <div :class="footerClassName">
        <span :class="hintClassName">共 {{ data?.total ?? 0 }} 条流程 · 每页 {{ pageSize }} 条</span>
        <div class="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            :disabled="pageNum <= 1 || loading"
            @click="changePage(-1)"
          >
            <Icon icon="carbon:chevron-left" />
            上一页
          </Button>
          <span :class="hintClassName">{{ pageNum }} / {{ totalPages }}</span>
          <Button
            variant="outline"
            size="sm"
            :disabled="pageNum >= totalPages || loading"
            @click="changePage(1)"
          >
            下一页
            <Icon icon="carbon:chevron-right" />
          </Button>
        </div>
      </div>
    </AsyncState>

    <BasicModal
      title="新建流程"
      :width="560"
      @register="modalRegister"
      @ok="handleCreate"
    >
      <div :class="formClassName">
        <div>
          <label :class="fieldLabelClassName" for="wf-name">流程名称</label>
          <Input
            id="wf-name"
            v-model="form.name"
            placeholder="例如：客户退款审批"
          />
        </div>
        <div>
          <label :class="fieldLabelClassName" for="wf-category">流程分类</label>
          <Input
            id="wf-category"
            v-model="form.category"
            placeholder="例如：风险控制"
          />
        </div>
        <div>
          <label :class="fieldLabelClassName" for="wf-owner">负责人</label>
          <Input id="wf-owner" v-model="form.owner" placeholder="例如：张敏" />
        </div>
        <div>
          <label :class="fieldLabelClassName" for="wf-desc">流程说明</label>
          <Input
            id="wf-desc"
            v-model="form.description"
            placeholder="简要描述这条流程的用途"
          />
        </div>
        <p :class="hintClassName">
          新建流程默认为草稿状态，可在列表中启用后进入设计器编排。
        </p>
      </div>
    </BasicModal>
  </div>
</template>
