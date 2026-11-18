<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import {
  Card,
  Descriptions,
  DescriptionsItem,
  PageHeader,
  Tag,
} from '@antdv/common-ui';
import { Button, Input } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { Icon } from '@iconify/vue';
import { getDeptTree } from '~/api/system';
import { unwrapApi } from '~/utils/log-format';

import AsyncState from '../components/AsyncState.vue';
import StatusPill from '../components/StatusPill.vue';

/**
 * 组织架构图。
 *
 * 参考实现用 vue3-tree-org 画树；本仓库不引入任何第三方组件库，
 * 这里用「平铺 + 缩进 + 可折叠」的等价结构：层级、负责人、编码、编制数
 * 与右侧详情面板一致，交互（展开/收起/搜索/选中）也齐全。
 */
defineOptions({ name: 'SystemOrgChart' });

interface DeptNode {
  children?: DeptNode[];
  code: string;
  id: number;
  leader: string;
  name: string;
  parentId: number;
  phone: string;
  status: number;
  userCount: number;
}

interface FlatNode {
  ancestors: number[];
  depth: number;
  hasChildren: boolean;
  node: DeptNode;
}

const containerClassName = cn('space-y-4');
const cardClassName = cn('shadow-sm');
const layoutClassName = cn(
  'grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]',
);
const toolbarClassName = cn('flex flex-wrap items-center gap-2');
const rowClassName = cn(
  'border-border flex items-center gap-2 rounded-md border px-3 py-2',
  'hover:bg-muted/40 hover:border-primary/50 transition-colors',
);
const rowActiveClassName = cn('bg-muted/40 border-primary');
const nodeNameClassName = cn('text-foreground truncate text-sm font-medium');
const nodeMetaClassName = cn('text-muted-foreground text-xs');
const hintClassName = cn('text-muted-foreground text-xs');

const tree = ref<DeptNode[]>([]);
const collapsed = ref<Set<number>>(new Set());
const keyword = ref('');
const selectedId = ref<null | number>(null);
const loading = ref(false);
const error = ref('');

function flatten(
  nodes: DeptNode[],
  depth: number,
  ancestors: number[],
): FlatNode[] {
  const out: FlatNode[] = [];
  for (const node of nodes) {
    const children = node.children ?? [];
    out.push({ ancestors, depth, hasChildren: children.length > 0, node });
    if (children.length > 0)
      out.push(...flatten(children, depth + 1, [...ancestors, node.id]));
  }
  return out;
}

const allNodes = computed(() => flatten(tree.value, 0, []));

const visibleNodes = computed(() => {
  const text = keyword.value.trim().toLowerCase();
  return allNodes.value.filter((item) => {
    // 搜索时直接平铺命中节点，不做祖先折叠，避免「搜到了却被折叠挡住」
    if (text) {
      return [item.node.name, item.node.code, item.node.leader]
        .join(' ')
        .toLowerCase()
        .includes(text);
    }
    return !item.ancestors.some((id) => collapsed.value.has(id));
  });
});

const selected = computed(
  () =>
    allNodes.value.find((item) => item.node.id === selectedId.value)?.node ??
    null,
);
const totalUsers = computed(() =>
  allNodes.value.reduce(
    (sum, item) => sum + Number(item.node.userCount ?? 0),
    0,
  ),
);

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const res = await getDeptTree();
    const rows = unwrapApi<unknown>(res);
    tree.value = (Array.isArray(rows) ? rows : []) as DeptNode[];
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '部门树接口暂不可用';
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function toggle(id: number) {
  const next = new Set(collapsed.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  collapsed.value = next;
}

function expandAll() {
  collapsed.value = new Set();
}

function collapseAll() {
  collapsed.value = new Set(
    allNodes.value
      .filter((item) => item.hasChildren)
      .map((item) => item.node.id),
  );
}
</script>

<template>
  <div data-page-view :class="containerClassName">
    <PageHeader
      title="组织架构图"
      description="按层级查看部门、负责人与编制；支持展开收起、关键字检索与节点详情"
      icon="carbon:network-4"
    >
      <template #extra>
        <Tag color="blue">{{ allNodes.length }} 个部门</Tag>
        <Tag color="green">{{ totalUsers }} 人编制</Tag>
      </template>
    </PageHeader>

    <AsyncState
      :loading="loading"
      :error="error"
      :empty="!loading && allNodes.length === 0"
      empty-text="暂无部门数据"
      @retry="load"
    >
      <div :class="layoutClassName">
        <Card title="组织层级" :class="cardClassName">
          <div :class="toolbarClassName" class="mb-4">
            <Input
              v-model="keyword"
              class="max-w-64"
              placeholder="搜索部门 / 编码 / 负责人"
            />
            <Button variant="outline" size="sm" @click="expandAll">
              <Icon icon="carbon:chevron-down" />
              展开全部
            </Button>
            <Button variant="outline" size="sm" @click="collapseAll">
              <Icon icon="carbon:chevron-up" />
              收起全部
            </Button>
            <span :class="hintClassName">当前显示 {{ visibleNodes.length }} 个节点</span>
          </div>

          <div class="space-y-2">
            <div
              v-for="item in visibleNodes"
              :key="item.node.id"
              :class="[
                rowClassName,
                selectedId === item.node.id ? rowActiveClassName : '',
              ]"
              :style="{ marginLeft: `${Math.min(item.depth, 6) * 20}px` }"
            >
              <Button
                v-if="item.hasChildren && !keyword"
                variant="ghost"
                size="icon"
                :aria-label="
                  collapsed.has(item.node.id) ? '展开下级' : '收起下级'
                "
                @click="toggle(item.node.id)"
              >
                <Icon
                  :icon="
                    collapsed.has(item.node.id)
                      ? 'carbon:chevron-right'
                      : 'carbon:chevron-down'
                  "
                />
              </Button>
              <span v-else class="w-9"></span>

              <Icon
                icon="carbon:building"
                class="shrink-0 text-base text-primary"
              />
              <button
                type="button"
                class="min-w-0 flex-1 text-left"
                @click="selectedId = item.node.id"
              >
                <span :class="nodeNameClassName">{{ item.node.name }}</span>
                <span :class="nodeMetaClassName">
                  · {{ item.node.code }} · {{ item.node.leader }}</span>
              </button>
              <StatusPill
                :label="item.node.status === 1 ? '正常' : '停用'"
                :tone="item.node.status === 1 ? 'success' : 'neutral'"
              />
              <span :class="nodeMetaClassName">{{ item.node.userCount }} 人</span>
            </div>

            <p v-if="visibleNodes.length === 0" :class="hintClassName">
              没有匹配的部门
            </p>
          </div>
        </Card>

        <Card title="节点详情" :class="cardClassName">
          <template v-if="selected">
            <Descriptions :column="1" bordered size="small">
              <DescriptionsItem label="部门名称">
{{
                selected.name
              }}
</DescriptionsItem>
              <DescriptionsItem label="部门编码">
{{
                selected.code
              }}
</DescriptionsItem>
              <DescriptionsItem label="负责人">
{{
                selected.leader
              }}
</DescriptionsItem>
              <DescriptionsItem label="联系电话">
{{
                selected.phone
              }}
</DescriptionsItem>
              <DescriptionsItem label="编制人数">
{{ selected.userCount }} 人
</DescriptionsItem>
              <DescriptionsItem label="直属下级">
{{ (selected.children ?? []).length }} 个
</DescriptionsItem>
              <DescriptionsItem label="状态">
                <StatusPill
                  :label="selected.status === 1 ? '正常' : '停用'"
                  :tone="selected.status === 1 ? 'success' : 'neutral'"
                />
              </DescriptionsItem>
            </Descriptions>
            <Button
              variant="outline"
              size="sm"
              class="mt-4"
              @click="selectedId = null"
            >
              取消选中
            </Button>
          </template>
          <p v-else :class="hintClassName">点击左侧任一部门查看详情。</p>
        </Card>
      </div>
    </AsyncState>
  </div>
</template>
