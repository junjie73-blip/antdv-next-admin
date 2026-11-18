<script setup lang="ts">
import type { ReportResourcesData } from '~/api/enterprise';

import { onMounted, ref } from 'vue';

import {
  Card,
  Descriptions,
  DescriptionsItem,
  PageHeader,
  Tag,
} from '@antdv/common-ui';
import { BasicDrawer, useDrawer } from '@antdv/popup-ui';
import { Button } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { Icon } from '@iconify/vue';
import { getReportDatasets } from '~/api/enterprise';
import { formatCount, unwrapApi } from '~/utils/log-format';

import AsyncState from '../../../system/components/AsyncState.vue';
import ResourceCard from '../../components/ResourceCard.vue';

/**
 * 报表中心（补齐参考实现「报表设计器 + 图表设计器」的资源台账视角）。
 *
 * 本仓库已有 `/enterprise/report` 的设计器与 `/screen/monitor` 大屏，
 * 这里补上「有哪些数据集、有哪些图表组件、各自绑定哪个源」这一层，
 * 让报表能力从单点演示变成可检索、可预览的资源清单。
 */
defineOptions({ name: 'EnterpriseReportGallery' });

interface Widget {
  id: string;
  insight: string;
  kind: string;
  source: string;
  title: string;
}

const TYPE_LABELS: Record<string, string> = {
  rest: 'REST',
  sample: '样例数据',
  sql: 'SQL',
};
const WIDGET_ICONS: Record<string, string> = {
  'AI 洞察': 'carbon:machine-learning',
  占比环图: 'carbon:chart-pie',
  排行柱状图: 'carbon:chart-bar',
  指标卡: 'carbon:data-vis-1',
  转化漏斗: 'carbon:chart-3d',
  趋势面积图: 'carbon:chart-area',
};

const containerClassName = cn('space-y-4');
const cardClassName = cn('shadow-sm');
const gridClassName = cn(
  'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4',
);
const tableClassName = cn('w-full border-collapse text-sm');
const headCellClassName = cn(
  'border-border text-muted-foreground border-b py-2 text-left font-medium',
);
const bodyCellClassName = cn('border-border text-foreground border-b py-2');
const hintClassName = cn('text-muted-foreground text-xs');
const metaClassName = cn('text-muted-foreground truncate text-xs');

const data = ref<null | ReportResourcesData>(null);
const loading = ref(false);
const error = ref('');
const viewing = ref<null | Widget>(null);
const [drawerRegister, drawerMethods] = useDrawer();

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const res = await getReportDatasets();
    data.value = unwrapApi<null | ReportResourcesData>(res) ?? null;
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : '报表资源接口暂不可用';
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function openPreview(widget: Widget) {
  viewing.value = widget;
  drawerMethods.openDrawer();
}
</script>

<template>
  <div data-page-view :class="containerClassName">
    <PageHeader
      title="报表中心"
      description="报表数据集与图表组件清单 · 可预览组件口径，再进入设计器或大屏使用"
      icon="carbon:chart-line-data"
    >
      <template #extra>
        <Button variant="outline" size="sm" :disabled="loading" @click="load">
          <Icon icon="carbon:renew" />
          刷新
        </Button>
      </template>
    </PageHeader>

    <AsyncState
      :loading="loading"
      :error="error"
      :empty="!loading && !data"
      @retry="load"
    >
      <Card title="数据集" :class="cardClassName">
        <template #extra>
<Tag color="blue">
{{ data?.datasets.length ?? 0 }} 个数据集
</Tag>
</template>
        <div class="overflow-x-auto">
          <table :class="tableClassName">
            <thead>
              <tr>
                <th :class="headCellClassName">数据集名称</th>
                <th :class="headCellClassName">类型</th>
                <th :class="headCellClassName">数据行数</th>
                <th :class="headCellClassName">字段</th>
                <th :class="headCellClassName">更新时间</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="dataset in data?.datasets ?? []" :key="dataset.id">
                <td :class="bodyCellClassName">{{ dataset.name }}</td>
                <td :class="bodyCellClassName">
                  <Tag color="blue">
{{
                    TYPE_LABELS[dataset.type] || dataset.type
                  }}
</Tag>
                </td>
                <td :class="bodyCellClassName" class="tabular-nums">
                  {{ formatCount(dataset.rows) }}
                </td>
                <td
                  :class="bodyCellClassName"
                  class="max-w-72 truncate"
                  :title="dataset.fields.join('、')"
                >
                  {{ dataset.fields.join('、') }}
                </td>
                <td :class="bodyCellClassName">{{ dataset.updatedAt }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="图表组件" :class="cardClassName">
        <template #extra>
<Tag color="green">
{{ data?.widgets.length ?? 0 }} 个组件
</Tag>
</template>
        <div :class="gridClassName">
          <ResourceCard
            v-for="widget in data?.widgets ?? []"
            :key="widget.id"
            :title="widget.title"
            :eyebrow="`${widget.kind} · ${widget.source}`"
            :description="widget.insight"
            :icon="WIDGET_ICONS[widget.kind] || 'carbon:chart-line'"
            :tags="[widget.kind]"
          >
            <template #meta>
<span :class="metaClassName">数据源：{{ widget.source }}</span>
</template>
            <template #actions>
              <Button variant="link" size="sm" @click="openPreview(widget)">
预览
</Button>
            </template>
          </ResourceCard>
        </div>
        <p :class="hintClassName" class="mt-4">
          需要编辑版面与字段绑定时，请前往「报表设计器」；需要大屏布局时，请前往「实时监控大屏」。
        </p>
      </Card>
    </AsyncState>

    <BasicDrawer
      title="图表组件预览"
      :width="560"
      :show-footer="false"
      @register="drawerRegister"
    >
      <template v-if="viewing">
        <Descriptions :column="1" bordered size="middle">
          <DescriptionsItem label="组件名称">
{{
            viewing.title
          }}
</DescriptionsItem>
          <DescriptionsItem label="组件类型">
{{
            viewing.kind
          }}
</DescriptionsItem>
          <DescriptionsItem label="绑定数据源">
{{
            viewing.source
          }}
</DescriptionsItem>
          <DescriptionsItem label="业务洞察">
{{
            viewing.insight
          }}
</DescriptionsItem>
        </Descriptions>
      </template>
      <p v-else :class="hintClassName">暂无组件详情</p>
    </BasicDrawer>
  </div>
</template>
