<script setup lang="ts">
import type { AiResourceItem, AiResourcesData } from '~/api/enterprise';

import { computed, onMounted, onUnmounted, ref } from 'vue';

import {
  Card,
  Descriptions,
  DescriptionsItem,
  PageHeader,
  Segmented,
  TabPane,
  Tabs,
  Tag,
} from '@antdv/common-ui';
import { BasicDrawer, useDrawer } from '@antdv/popup-ui';
import { Button, Input } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { Icon } from '@iconify/vue';
import { getAiResources } from '~/api/enterprise';
import { unwrapApi } from '~/utils/log-format';

import AsyncState from '../../system/components/AsyncState.vue';
import ResourceCard from '../components/ResourceCard.vue';

/**
 * AI 资源中心（对应参考实现「Ai开发」分组的 Agent / 模型列表 / 知识库 / 模型供应商）。
 *
 * 四个 Tab 共用一次接口取数：卡片墙、状态与关键字筛选、指标行、详情抽屉，
 * 展示口径与参考实现一致；数据来自 backend-mock，不再散落在各页的 data.ts 里。
 */
defineOptions({ name: 'EnterpriseAiResources' });

const STATUS_LABELS: Record<string, string> = {
  disabled: '已停用',
  draft: '草稿',
  running: '运行中',
};
const STATUS_TONES: Record<
  string,
  'error' | 'info' | 'neutral' | 'success' | 'warning'
> = {
  disabled: 'neutral',
  draft: 'warning',
  running: 'success',
};
const STATUS_OPTIONS = ['全部状态', '运行中', '草稿', '已停用'];
const STATUS_VALUE: Record<string, string> = {
  全部状态: '',
  运行中: 'running',
  草稿: 'draft',
  已停用: 'disabled',
};

const containerClassName = cn('space-y-4');
const cardClassName = cn('shadow-sm');
const filterClassName = cn('flex flex-wrap items-center gap-3');
const gridClassName = cn(
  'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4',
);
const metaClassName = cn('text-muted-foreground truncate text-xs');
const hintClassName = cn('text-muted-foreground text-xs');
const tableClassName = cn('w-full border-collapse text-sm');
const headCellClassName = cn(
  'border-border text-muted-foreground border-b py-2 text-left font-medium',
);
const bodyCellClassName = cn('border-border text-foreground border-b py-2');

const activeTab = ref('agents');
const keyword = ref('');
const statusTab = ref('全部状态');
const data = ref<AiResourcesData | null>(null);
const loading = ref(false);
const error = ref('');
const viewing = ref<AiResourceItem | null>(null);
const [drawerRegister, drawerMethods] = useDrawer();

let searchTimer: ReturnType<typeof setTimeout> | undefined;

const resources = computed<AiResourceItem[]>(() => {
  if (!data.value) return [];
  if (activeTab.value === 'models') return data.value.models;
  if (activeTab.value === 'knowledge') return data.value.knowledgeBases;
  if (activeTab.value === 'providers') return [];
  return data.value.agents;
});
const runningCount = computed(
  () => resources.value.filter((item) => item.status === 'running').length,
);

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const res = await getAiResources({
      keyword: keyword.value,
      status: STATUS_VALUE[statusTab.value],
    });
    data.value = unwrapApi<AiResourcesData | null>(res) ?? null;
  } catch (error) {
    error.value =
      error instanceof Error ? error.message : 'AI 资源接口暂不可用';
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
  searchTimer = setTimeout(load, 350);
}

function clearFilters() {
  keyword.value = '';
  statusTab.value = '全部状态';
  load();
}

function openDetail(item: AiResourceItem) {
  viewing.value = item;
  drawerMethods.openDrawer();
}
</script>

<template>
  <div data-page-view :class="containerClassName">
    <PageHeader
      title="AI 资源中心"
      description="Agent、模型、知识库与模型供应商的统一台账，支持状态筛选与详情查看"
      icon="carbon:machine-learning"
    >
      <template #extra>
        <Button variant="outline" size="sm" :disabled="loading" @click="load">
          <Icon icon="carbon:renew" />
          刷新
        </Button>
      </template>
    </PageHeader>

    <Card :class="cardClassName">
      <div :class="filterClassName">
        <Input
          v-model="keyword"
          class="max-w-72"
          placeholder="搜索名称、标签、描述或创建人"
          @update:model-value="onKeywordChange"
        />
        <Segmented
          v-model:value="statusTab"
          :options="STATUS_OPTIONS"
          size="small"
          @update:value="load"
        />
        <Tag color="blue">{{ resources.length }} 项</Tag>
        <span :class="hintClassName">{{ runningCount }} 项运行中</span>
      </div>
    </Card>

    <Tabs v-model:active-key="activeTab">
      <TabPane value="agents" tab="Agent">
        <AsyncState
          :loading="loading"
          :error="error"
          :empty="!loading && resources.length === 0"
          empty-text="没有符合条件的 Agent"
          @retry="load"
        >
          <template #empty>
            <Icon icon="carbon:cube" class="size-8 text-muted-foreground" />
            <p :class="hintClassName">没有符合条件的 Agent</p>
            <Button variant="outline" size="sm" @click="clearFilters">
清除筛选
</Button>
          </template>

          <div :class="gridClassName">
            <ResourceCard
              v-for="item in resources"
              :key="item.id"
              :title="item.name"
              :eyebrow="`${item.id} · ${item.owner}`"
              :description="item.description"
              :icon="item.icon"
              :tags="item.tags"
              :status-label="STATUS_LABELS[item.status]"
              :status-tone="STATUS_TONES[item.status]"
              :metrics="item.metrics"
            >
              <template #meta>
                <span :class="metaClassName" :title="item.updatedAt">更新于 {{ item.updatedAt }}</span>
              </template>
              <template #actions>
                <Button variant="link" size="sm" @click="openDetail(item)">
查看详情
</Button>
              </template>
            </ResourceCard>
          </div>
        </AsyncState>
      </TabPane>

      <TabPane value="models" tab="模型列表">
        <AsyncState
          :loading="loading"
          :error="error"
          :empty="!loading && resources.length === 0"
          @retry="load"
        >
          <div :class="gridClassName">
            <ResourceCard
              v-for="item in resources"
              :key="item.id"
              :title="item.name"
              :eyebrow="item.owner"
              :description="item.description"
              :icon="item.icon"
              :tags="item.tags"
              :status-label="STATUS_LABELS[item.status]"
              :status-tone="STATUS_TONES[item.status]"
              :metrics="item.metrics"
            >
              <template #meta>
<span :class="metaClassName">更新于 {{ item.updatedAt }}</span>
</template>
              <template #actions>
<Button variant="link" size="sm" @click="openDetail(item)">
查看详情
</Button>
</template>
            </ResourceCard>
          </div>
        </AsyncState>
      </TabPane>

      <TabPane value="knowledge" tab="知识库">
        <AsyncState
          :loading="loading"
          :error="error"
          :empty="!loading && resources.length === 0"
          @retry="load"
        >
          <div :class="gridClassName">
            <ResourceCard
              v-for="item in resources"
              :key="item.id"
              :title="item.name"
              :eyebrow="item.owner"
              :description="item.description"
              :icon="item.icon"
              :tags="item.tags"
              :status-label="STATUS_LABELS[item.status]"
              :status-tone="STATUS_TONES[item.status]"
              :metrics="item.metrics"
            >
              <template #meta>
<span :class="metaClassName">更新于 {{ item.updatedAt }}</span>
</template>
              <template #actions>
<Button variant="link" size="sm" @click="openDetail(item)">
查看详情
</Button>
</template>
            </ResourceCard>
          </div>
        </AsyncState>
      </TabPane>

      <TabPane value="providers" tab="模型供应商">
        <Card :class="cardClassName">
          <div class="overflow-x-auto">
            <table :class="tableClassName">
              <thead>
                <tr>
                  <th :class="headCellClassName">供应商名称</th>
                  <th :class="headCellClassName">调用协议</th>
                  <th :class="headCellClassName">描述</th>
                  <th :class="headCellClassName">创建时间</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="provider in data?.providers ?? []"
                  :key="provider.id"
                >
                  <td :class="bodyCellClassName">{{ provider.name }}</td>
                  <td :class="bodyCellClassName">
                    <Tag color="blue">{{ provider.protocol }}</Tag>
                  </td>
                  <td :class="bodyCellClassName">{{ provider.description }}</td>
                  <td :class="bodyCellClassName">{{ provider.createdAt }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </TabPane>
    </Tabs>

    <BasicDrawer
      title="资源详情"
      :width="600"
      :show-footer="false"
      @register="drawerRegister"
    >
      <template v-if="viewing">
        <Descriptions :column="2" bordered size="middle">
          <DescriptionsItem label="名称">{{ viewing.name }}</DescriptionsItem>
          <DescriptionsItem label="编号">{{ viewing.id }}</DescriptionsItem>
          <DescriptionsItem label="负责人">
{{
            viewing.owner
          }}
</DescriptionsItem>
          <DescriptionsItem label="状态">
{{
            STATUS_LABELS[viewing.status]
          }}
</DescriptionsItem>
          <DescriptionsItem label="标签" :span="2">
{{
            viewing.tags.join('、') || '-'
          }}
</DescriptionsItem>
          <DescriptionsItem label="描述" :span="2">
{{
            viewing.description
          }}
</DescriptionsItem>
          <DescriptionsItem label="更新时间" :span="2">
{{
            viewing.updatedAt
          }}
</DescriptionsItem>
        </Descriptions>
      </template>
      <p v-else :class="hintClassName">暂无资源详情</p>
    </BasicDrawer>
  </div>
</template>
