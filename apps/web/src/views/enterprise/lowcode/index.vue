<script setup lang="ts">
import type {
  InsertTarget,
  InspectorChange,
  MaterialEntry,
  NodeSchema,
  OutlineDropPayload,
  OutlineMovePayload,
  PageSchema,
} from '@antdv/common-ui/lowcode';

import { computed, ref } from 'vue';

import { Alert, Card, Space } from '@antdv/common-ui';
import {
  cloneSchema,
  configureLowcode,
  createMaterialNode,
  demoPageSchema,
  duplicateNode,
  findNode,
  insertNode,
  locateNode,
  LowCodeInspector,
  LowCodeOutline,
  LowCodePalette,
  LowCodeRenderer,
  moveNode,
  patchNode,
  removeNode,
  shiftNode,
  useLowcodePage,
} from '@antdv/common-ui/lowcode';
import { message } from '@antdv/popup-ui';
import { Badge, Button, Input, Separator } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

/**
 * 低代码搭建示例：物料面板 + 渲染画布 + 属性面板 + 大纲，四块拼一个最小设计器。
 *
 * 三件事决定了这个页面只有这点代码：
 * 1. **Schema 只有一份**，就在页面手里（`schema` ref）。渲染、大纲、属性面板全从它派生，
 *    谁都不持有私有副本 —— 所以「导出」就是导出这份 JSON，不会出现画布和数据两张皮。
 * 2. **改结构一律走 `core/dsl` 的纯函数**（`insertNode` / `patchNode` / `moveNode` / `removeNode` /
 *    `shiftNode` / `duplicateNode`），它们返回新树；页面只做一件事：把新树写回 `schema.value.tree`。
 *    页面里没有任何一条自创的树操作，也没有「先改视图再同步数据」的补丁。
 * 3. **取数靠注入**：`configureLowcode({ fetcher })` 是包内 `rest` 数据源唯一的出口。
 *    下面这个 fetcher 是**假实现**，只按 url 给写死的数据，因此断网、不起 `apps/backend-mock`
 *    也能跑通「绑定 → 求值 → 取数 → 写回 scope → 事件动作」完整链路；
 *    接真后端只需要把它换成 `(input) => http.request(input)`。
 * 4. **四块面板吃同一份装配**（`page.context`）。不传的话每个组件各 `createLowcodeContext()`
 *    一套注册表，功能上照样跑，但渲染器发现的「未知类型 / 表达式求值失败」只写在它自己那套的
 *    `report` 里，宿主永远看不到 —— 传同一个 context，这些运行期问题才会冒进下面那一栏。
 */

const DEMO_MEMBERS_URL = '/api/lowcode/demo/members';
const DEMO_SYNC_URL = '/api/lowcode/demo/sync';

configureLowcode({
  evaluatorContext: { tenantName: '示例租户' },
  fetcher: (input) => {
    if (input.url === DEMO_SYNC_URL) {
      return {
        syncedAt: new Date().toISOString().slice(0, 19).replaceAll('T', ' '),
        total: 128,
      };
    }
    if (input.url === DEMO_MEMBERS_URL) {
      return [
        { name: '张三', role: '管理员' },
        { name: '李四', role: '编辑' },
        { name: '王五', role: '访客' },
      ];
    }
    // 明确报错而不是返回空对象：免得页面把「没接线」看成「没数据」
    throw new Error(
      `示例页的假 fetcher 没有为 ${input.method} ${input.url} 准备数据`,
    );
  },
});

/** 每次开页拿一份新副本：改坏了刷新即可，preset 那份出厂数据永不被污染 */
const schema = ref<PageSchema>(cloneSchema(demoPageSchema));
const selectedId = ref<string>();

const page = useLowcodePage({
  onEvent: (name, payload) =>
    message.info(`宿主收到事件 ${name}：${JSON.stringify(payload ?? null)}`),
  onError: (text) => message.warning(text),
  schema,
});

const tree = computed<NodeSchema[]>(() => schema.value.tree);
const selectedNode = computed<NodeSchema | undefined>(() =>
  selectedId.value ? findNode(tree.value, selectedId.value) : undefined,
);

/** 选中节点自己的落点：新物料插成它的同层兄弟。根级选中时 `parentId` 为空，`refId` 已经够定位 */
const selectedTarget = computed<InsertTarget | undefined>(() => {
  const id = selectedId.value;
  if (!id) return undefined;
  const hit = locateNode(tree.value, id);
  if (!hit) return undefined;
  return {
    parentId: hit.parentId,
    position: 'after',
    refId: hit.node.id,
    slot: hit.slot,
  };
});

/**
 * 大纲用字符串 `'children'` 表达默认插槽，`dsl` 用 `slot === undefined` 表达，这里翻一次译。
 * 直接把 `'children'` 传下去会凭空造出一个叫 `children` 的**具名**插槽：渲染器按元数据一查
 * 发现物料没声明过它，内容就掉进默认插槽，表现是「拖进去了但位置不对」。
 */
function toDslTarget(payload: OutlineDropPayload): InsertTarget {
  return {
    position: payload.position,
    refId: payload.refId,
    slot: payload.slot === 'children' ? undefined : payload.slot,
  };
}

/** 属性面板只抛 `{ key, value }`，回写 Schema 是宿主的活 —— 这条分工让撤销栈有地方压 */
function onInspectorChange(change: InspectorChange): void {
  const node = selectedNode.value;
  if (!node) return;
  schema.value = {
    ...schema.value,
    tree: patchNode(tree.value, node.id, {
      props: { [change.key]: change.value },
    }),
  };
}

function onInspectorCondition(value: string | undefined): void {
  const node = selectedNode.value;
  if (!node) return;
  schema.value = {
    ...schema.value,
    tree: patchNode(tree.value, node.id, { condition: value }),
  };
}

/** 物料被点中：有选中就插成它的兄弟，没有就挂到根级末尾 */
function onPick(payload: { entry: MaterialEntry; type: string }): void {
  const node = createMaterialNode(payload.entry);
  schema.value = {
    ...schema.value,
    tree: insertNode(tree.value, node, selectedTarget.value ?? {}),
  };
  selectedId.value = node.id;
  message.success(`已插入「${payload.entry.meta.name}」（id：${node.id}）`);
}

/** 从面板拖进大纲：落点带 type 就回注册表取完整条目建节点，带 nodeId 就是挪已有节点 */
function onOutlineDrop(payload: OutlineDropPayload): void {
  if (payload.materialType) {
    const component = page.context.registry.get(payload.materialType);
    const meta = page.context.registry.getMeta(payload.materialType);
    if (!component || !meta) {
      message.warning(
        `物料「${payload.materialType}」没在注册表里，拖进来也渲染不了`,
      );
      return;
    }
    const node = createMaterialNode({ component, meta });
    schema.value = {
      ...schema.value,
      tree: insertNode(tree.value, node, toDslTarget(payload)),
    };
    selectedId.value = node.id;
    return;
  }
  if (payload.nodeId) {
    schema.value = {
      ...schema.value,
      tree: moveNode(tree.value, payload.nodeId, toDslTarget(payload)),
    };
  }
}

function onOutlineMove(payload: OutlineMovePayload): void {
  schema.value = {
    ...schema.value,
    tree: shiftNode(tree.value, payload.nodeId, payload.direction),
  };
}

/** 复制走 `duplicateNode`：子树 id 整体换新，选中态跟着搬到复制体上 */
function onOutlineDuplicate(nodeId: string): void {
  const { idMap, tree: nextTree } = duplicateNode(tree.value, nodeId);
  schema.value = { ...schema.value, tree: nextTree };
  const copyId = idMap[nodeId];
  if (copyId) selectedId.value = copyId;
  message.success(
    `已复制为「${copyId ?? '?'}」（子树 id 全部换新，不会撞渲染 key）`,
  );
}

function onOutlineRemove(nodeId: string): void {
  const { removed, tree: nextTree } = removeNode(tree.value, nodeId);
  if (!removed) return;
  schema.value = { ...schema.value, tree: nextTree };
  if (selectedId.value === nodeId) selectedId.value = undefined;
  message.info(
    `已删除「${removed.type}」，含子树共 ${countNodes([removed])} 个节点`,
  );
}

function countNodes(nodes: NodeSchema[]): number {
  return nodes.reduce(
    (total, node) =>
      total +
      1 +
      countNodes([
        ...(node.children ?? []),
        ...Object.values(node.slots ?? {}).flat(),
      ]),
    0,
  );
}

const keyword = ref('');
const nodeCount = computed(() => countNodes(tree.value));

/** 体检结果不写进 `errors`：那是运行态面板。`valid` 只看 error，warning 允许带病保存 */
function validate(): void {
  const result = page.validate();
  if (result.valid && result.warnings.length === 0) {
    message.success(
      `体检通过：${nodeCount.value} 个节点，结构 / 绑定 / 事件动作都干净`,
    );
    return;
  }
  const first = result.issues
    .slice(0, 2)
    .map((item) => item.message)
    .join('；');
  message[result.valid ? 'warning' : 'error'](
    `error ${result.errors.length} 条 / warning ${result.warnings.length} 条${first ? `：${first}` : ''}`,
  );
}

const exported = ref('');

function exportSchema(): void {
  exported.value = JSON.stringify(schema.value, null, 2);
  message.success(
    `Schema 已导出到下方（${exported.value.length} 字节，真宿主这里是保存接口）`,
  );
}

/**
 * 重置走「给一份新 id」而不是「改树」。
 *
 * `useLowcodePage` 的重载判据是页面 `id`：同 id 只换树是设计器改属性的常态，刻意**不**重置 scope，
 * 否则用户刚填的表单会被 `schema.state` 的初值冲掉。而"回到出厂示例页"要的恰恰就是把 scope 冲掉，
 * 所以正规入口就是换一次 id（同一份结构Revision 的第 N 次装载），
 * 顺带把数据源缓存、运行期问题列表一起带走。
 */
let revision = 0;

function reset(): void {
  revision += 1;
  const fresh = cloneSchema(demoPageSchema);
  schema.value = { ...fresh, id: `${fresh.id}-r${revision}` };
  selectedId.value = undefined;
  exported.value = '';
  message.info(
    `已回到出厂示例页（第 ${revision} 次重载：换页面 id 才会连 scope 一起清掉）`,
  );
}

/** 手动跑一个 `auto: false` 的数据源：演示「按钮 -> runDataSource -> scope 写回」这条链 */
async function runSyncSource(): Promise<void> {
  const state = await page.runDataSource('sync');
  if (state?.error) {
    message.error(`sync 数据源失败：${state.error}`);
    return;
  }
  message.success('已手动跑一次 sync 数据源');
}

const hintClassName = cn('text-sm', 'leading-relaxed', 'text-muted-foreground');
const codeClassName = cn(
  'rounded-sm',
  'bg-muted',
  'px-1',
  'py-0.5',
  'font-mono',
  'text-xs',
);
const panelClassName = cn(
  'h-[460px]',
  'overflow-y-auto',
  'rounded-md',
  'border',
);
</script>

<template>
  <div class="space-y-6">
    <Card title="搭建区" variant="borderless">
      <p :class="hintClassName">
        中间是 <code :class="codeClassName">LowCodeRenderer</code> 跑真实
        Schema： 左边
        <code :class="codeClassName">LowCodePalette</code> 出物料， 右边
        <code :class="codeClassName">LowCodeInspector</code> 改属性， 下面
        <code :class="codeClassName">LowCodeOutline</code>
        管结构。四个组件都不认识「设计器」这件事， 它们只认识 Schema 与事件 ——
        设计器是宿主用这四件拼出来的。
      </p>
      <div class="mt-3 grid gap-3 lg:grid-cols-[11rem_minmax(0,1fr)_18rem]">
        <div :class="panelClassName">
          <LowCodePalette
            :context="page.context"
            :keyword="keyword || undefined"
            @pick="onPick"
          />
        </div>
        <div :class="panelClassName">
          <LowCodeRenderer
            :context="page.context"
            :nodes="tree"
            :scope="page.scope"
            @event="page.dispatch"
          />
        </div>
        <div :class="panelClassName">
          <LowCodeInspector
            :context="page.context"
            :node="selectedNode"
            @change="onInspectorChange"
            @update:condition="onInspectorCondition"
          />
        </div>
      </div>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <Input
          class="max-w-60"
          :model-value="keyword"
          placeholder="过滤物料（按名称 / type / 分组）"
          @update:model-value="keyword = String($event)"
        />
        <Badge variant="secondary">{{ nodeCount }} 个节点</Badge>
        <Badge :variant="selectedId ? 'default' : 'outline'">
          {{ selectedId ? `选中 ${selectedId}` : '未选中节点' }}
        </Badge>
      </div>
      <Separator class="my-4" />
      <div class="h-[240px] overflow-y-auto rounded-md border">
        <LowCodeOutline
          :context="page.context"
          :nodes="tree"
          :selected-id="selectedId"
          @drop="onOutlineDrop"
          @duplicate="onOutlineDuplicate"
          @move="onOutlineMove"
          @remove="onOutlineRemove"
          @select="selectedId = $event"
        />
      </div>
    </Card>

    <Card title="运行态与体检" variant="borderless">
      <Space :size="4" wrap>
        <Button @click="validate">保存前体检</Button>
        <Button variant="outline" @click="exportSchema">导出 Schema</Button>
        <Button variant="outline" @click="runSyncSource">
          手动跑 sync 数据源
        </Button>
        <Button variant="ghost" @click="reset">重置示例页</Button>
        <Badge variant="secondary">
数据源
          {{ Object.keys(page.dataSources.value).length }} 个已装载
</Badge>
        <Badge :variant="page.loading.value ? 'default' : 'outline'">
          {{ page.loading.value ? '取数中' : '空闲' }}
        </Badge>
      </Space>
      <p v-if="page.errors.value.length" :class="cn(hintClassName, 'mt-3')">
        运行期问题：{{ page.errors.value.join('；') }}
      </p>
      <Alert
        v-else
        class="mt-3"
        type="success"
        show-icon
        message="没有运行期错误"
        description="表达式求值、数据源写回 scope、事件动作三条链路都干净。绑定语法与审批流的条件语法同源（都来自 @antdv/graph 的受限求值器），学一次两处通用。"
      />
      <p :class="cn(hintClassName, 'mt-3')">
        当前 scope：<code :class="codeClassName">{{
          JSON.stringify(page.scope).slice(0, 240)
        }}</code>
      </p>
      <!--
        `sync` 是 `auto: false` 的手动源，`path: 'syncResult'` 写回的结果在这里单独露一行。
        上面那段 scope 摘要截到 240 字符，`syncResult` 排在最后永远看不见 —— 而「点一下才取数」
        这条链路要能被断言，否则示例页只是看起来能点，实际写没写回 scope 无从判断。
      -->
      <p :class="cn(hintClassName, 'mt-2')">
        <Badge data-testid="demo-sync-scope" variant="outline">
          sync 写回：{{ JSON.stringify(page.scope.syncResult ?? null) }}
        </Badge>
      </p>
      <pre
        v-if="exported"
        class="mt-3 max-h-72 overflow-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed"
        >{{ exported }}</pre>
    </Card>
  </div>
</template>
