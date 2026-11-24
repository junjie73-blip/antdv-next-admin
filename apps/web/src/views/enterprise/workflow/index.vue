<script setup lang="ts">
import type {
  WorkflowActionName,
  WorkflowDefinition,
  WorkflowNodeHandler,
  WorkflowTask,
} from '@antdv/common-ui/workflow';

import { computed, ref, watch } from 'vue';

import { Alert, Card, Space } from '@antdv/common-ui';
import {
  cloneDeep,
  createConfiguredWorkflowEngine,
  createMemoryWorkflowStore,
  createNodeHandlerRegistry,
  INSTANCE_STATUS_LABELS,
  OPEN_TASK_STATUSES,
  useWorkflow,
  useWorkflowTasks,
  validateWorkflowDefinition,
  WorkflowApprovalBar,
  WorkflowDefinitionDesigner,
  WorkflowTaskList,
  WorkflowTimeline,
} from '@antdv/common-ui/workflow';
import { message } from '@antdv/popup-ui';
import { Badge, Button, Input, Separator } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { useUserStore } from '@antdv/stores';

/**
 * 工作流引擎示例：一条「请假」流程把引擎的六个语义全走一遍 ——
 * 或签、会签、条件分支、抄送（不阻塞）、定时节点（等宿主 `tick()`）、
 * 驳回回溯，外加一个宿主自己注册的自定义节点处理器。
 *
 * 这一页刻意**不接后端接口**：存储走 `createMemoryWorkflowStore()`，
 * 刷新页面就重置。要接真实服务，只换 `configureWorkflow({ store })`
 * 里那一个适配器实现（六个方法），页面代码一行都不用动 ——
 * 这正是 `@antdv/common-ui/workflow` 不 import 宿主 `~/api` 的换取方式。
 */

/** 演示用的两个办理人身份：真实宿主由登录态决定，这里给页面一个开关，方便看会签/或签差异 */
const userStore = useUserStore();
const actor = ref(String(userStore.userInfo?.username || 'admin'));

/** 自定义节点：ERP 归档。注册处理器即可新增节点类型，不必 fork 引擎 */
const erpSyncHandler: WorkflowNodeHandler = {
  kind: 'erpSync',
  run: (ctx) => {
    ctx.setVariable('erpSyncedAt', ctx.now);
    return { status: 'advance' };
  },
};

const definition: WorkflowDefinition = {
  edges: [
    { id: 'e0', source: 's', target: 'leader' },
    { id: 'e1', source: 'leader', target: 'gw' },
    { id: 'toHr', source: 'gw', target: 'hr' },
    { id: 'toCc', source: 'gw', target: 'cc' },
    { id: 'e2', source: 'hr', target: 'cc' },
    { id: 'e3', source: 'cc', target: 'archive' },
    { id: 'e4', source: 'archive', target: 'sync' },
    { id: 'e5', source: 'sync', target: 'e' },
  ],
  id: 'leave-demo',
  name: '请假审批（或签 / 会签 / 条件分支 / 定时）',
  nodes: [
    { id: 's', label: '发起', type: 'start' },
    {
      data: {
        assignees: [
          { params: { userIds: ['admin', 'custom'] }, strategy: 'user' },
        ],
        multi: 'any',
        rejectTo: 'initiator',
      },
      id: 'leader',
      label: '主管审批（或签：任一人办完即过）',
      type: 'approval',
    },
    {
      data: {
        branches: [{ edgeId: 'toHr', expression: 'days >= 3' }],
        defaultEdgeId: 'toCc',
      },
      id: 'gw',
      label: '按天数分流',
      type: 'condition',
    },
    {
      data: {
        // 办理人来自流程变量：由发起表单填进来，引擎不认组织架构
        assignees: [
          { params: { expression: 'hrOwners' }, strategy: 'expression' },
        ],
        multi: 'all',
        rejectTo: 'previous',
      },
      id: 'hr',
      label: '人事会签（全部办完才过）',
      type: 'approval',
    },
    {
      data: {
        assignees: [{ params: { userIds: ['admin'] }, strategy: 'user' }],
      },
      id: 'cc',
      label: '抄送部门群（建任务但不拦流程）',
      type: 'cc',
    },
    {
      // 定时节点：引擎不看钟，到期靠宿主调 engine.tick(now) 唤醒
      data: { timeoutMs: 5000 },
      id: 'archive',
      label: '归档等待 5 秒（点「推进定时」唤醒）',
      type: 'timer',
    },
    { id: 'sync', label: '写入 ERP（自定义节点处理器）', type: 'erpSync' },
    { id: 'e', label: '结束', type: 'end' },
  ],
  version: 1,
};

/**
 * 设计器编辑的是这份定义的**副本**，且 id 换成 `-draft`。
 * 换 id 不是审美问题：引擎 `resolveRun()` 先看 `instance.definitionId === definition.id`，
 * 同 id 的草稿会被原始定义抢先命中 —— 于是"改了定义再发起"看起来生效、跑起来还是老流程。
 * 换了 id，草稿就落在下面那张 `liveDefinitions` 表里，每一步推进读的都是编辑后的版本。
 */
const draft = ref<WorkflowDefinition>({
  ...cloneDeep(definition),
  id: 'leave-demo-draft',
  name: `${definition.name}（设计器草稿）`,
  version: 2,
});

/** 引擎的多版本定义集：设计器每次 emit 都把它刷成最新那份 */
const liveDefinitions: Record<string, WorkflowDefinition> = {
  [draft.value.id]: draft.value,
};
watch(draft, (value) => {
  liveDefinitions[value.id] = value;
});

const registry = createNodeHandlerRegistry([erpSyncHandler]);

/** 只用来在画布下面复述一句"你选的是谁"；属性面板自己会跟着选中态走 */
const selectedNodeOfDraft = ref<string>();

/**
 * 设计器把"语义上不允许"（起点连回自己、重复 id…）以一句人话 emit 出来。
 * 写成脚本里的具名函数：模板内联箭头那版 `@warn="(text) => message.warning(text)"`
 * 会在 vue-tsc 下报一条指不到 `.value` 的 TS2339（把 `message` 当成了 ref），
 * 换成具名函数后这条消失 —— 内联表达式里引用 setup 作用域的对象成员，本页面还有其他处（`@click`）没事，
 * 所以别在这条路上继续省两行，走具名 handler 更稳。
 */
function onDesignerWarn(text: string): void {
  message.warning(text);
}

/** 时间线/待办上的节点名取自"发起那一刻"的定义，中途改设计器不会让历史里的名字跟着变 */
const startedWith = ref<WorkflowDefinition>(draft.value);

const labelOf = (nodeId: string) =>
  startedWith.value.nodes.find((node) => node.id === nodeId)?.label ?? nodeId;

/** 定义期校验：跑歪的流程先在这里说清楚，而不是等业务卡住 */
const issues = computed(() =>
  validateWorkflowDefinition(draft.value, registry),
);

const store = createMemoryWorkflowStore();
const engine = createConfiguredWorkflowEngine(definition, {
  definitions: liveDefinitions,
  handlers: [erpSyncHandler],
  store,
});

const currentInstanceId = ref<string>();
const days = ref('4');
const reason = ref('家中有事，需请假处理');
const hrOwners = ref('admin,custom');
const selected = ref<WorkflowTask>();

const wf = useWorkflow({
  engine,
  instanceId: currentInstanceId,
  onError: (error) =>
    message.error(error instanceof Error ? error.message : String(error)),
});

/** 待办取数：整张任务表交给 composable 去筛（办理人 + 未办完状态 + 分页） */
const tasksApi = useWorkflowTasks({
  assignee: actor,
  load: () => store.findTasks(() => true),
  onError: (error) => message.error(`待办读取失败：${String(error)}`),
  pageSize: 6,
  statuses: OPEN_TASK_STATUSES,
});

const instance = computed(() => wf.instance.value);
const canAct = computed(
  () =>
    !!selected.value &&
    selected.value.assignee === actor.value &&
    ['pending', 'queued'].includes(selected.value.status),
);

async function start() {
  // Number(...) 而不是 Number.getNumber：后者还在提案阶段，lib 里没有这个静态方法
  const parsed = Number(days.value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    message.warning('请假天数要填正数');
    return;
  }
  const snapshot = draft.value;
  await wf.start({
    definition: snapshot,
    initiator: actor.value,
    variables: {
      days: parsed,
      hrOwners: hrOwners.value.split(/[,，\s]+/).filter(Boolean),
      reason: reason.value,
    },
  });
  startedWith.value = snapshot;
  currentInstanceId.value = wf.instance.value?.id;
  selected.value = undefined;
  await tasksApi.refresh();
  message.success(`流程已发起：${wf.instance.value?.id ?? ''}`);
}

/** 审批条只发「动作 + 意见 + 人员」，落库语义全在引擎那侧，页面只做参数拼装 */
async function onAction(payload: {
  action: WorkflowActionName;
  comment: string;
  users: string[];
}) {
  const task = selected.value;
  if (!task) return;
  const input = { actor: actor.value, comment: payload.comment };
  switch (payload.action) {
    case 'addSign': {
      await wf.addSign(task.id, {
        ...input,
        mode: 'before',
        users: payload.users,
      });
      break;
    }
    case 'approve': {
      await wf.complete(task.id, input);
      break;
    }
    case 'reject': {
      await wf.reject(task.id, input);
      break;
    }
    case 'skip': {
      await wf.skip(task.id, input);
      break;
    }
    case 'transfer': {
      await wf.transfer(task.id, { ...input, to: payload.users[0] ?? 'admin' });
      break;
    }
    case 'withdraw': {
      await wf.withdraw(input);
      break;
    }
  }
  selected.value = undefined;
  await tasksApi.refresh();
}

function pick(task: WorkflowTask) {
  selected.value = task;
  currentInstanceId.value = task.instanceId;
}

/** 定时节点与任务超时都靠这一次扫描；返回值是这一轮触发的事件数 */
async function drive() {
  const fired = await wf.tick();
  await tasksApi.refresh();
  message.info(fired > 0 ? `推进了 ${fired} 个到期项` : '当前没有到期项');
}

const containerClassName = cn('space-y-6');
const hintClassName = cn('text-sm', 'leading-relaxed', 'text-muted-foreground');
const fieldClassName = cn('flex', 'w-44', 'flex-col', 'gap-1');
const codeClassName = cn(
  'rounded-sm',
  'bg-muted',
  'px-1',
  'py-0.5',
  'font-mono',
  'text-xs',
);
</script>

<template>
  <div :class="containerClassName">
    <!-- 1. 发起 -->
    <Card title="发起流程" variant="borderless">
      <p :class="hintClassName">
        表单值进的是流程变量（<code :class="codeClassName">days</code> /
        <code :class="codeClassName">hrOwners</code> /
        <code :class="codeClassName">reason</code>）：条件分支读
        <code>days</code>， 人事会签的办理人直接来自
        <code>hrOwners</code>。办理人开关只是演示登录身份，
        真实宿主由登录态给出。
      </p>
      <Space :size="4" wrap>
        <label :class="fieldClassName">
          <span class="text-sm">当前办理人</span>
          <Input v-model="actor" placeholder="admin / custom" />
        </label>
        <label :class="fieldClassName">
          <span class="text-sm">请假天数</span>
          <Input v-model="days" type="number" min="1" />
        </label>
        <label :class="cn(fieldClassName, 'w-64')">
          <span class="text-sm">事由</span>
          <Input v-model="reason" />
        </label>
        <label :class="cn(fieldClassName, 'w-64')">
          <span class="text-sm">人事会签成员（逗号分隔）</span>
          <Input v-model="hrOwners" />
        </label>
        <Button :disabled="wf.busy.value" @click="start">发起</Button>
      </Space>
      <Alert
        v-if="issues.length > 0"
        class="mt-4"
        type="warning"
        show-icon
        :message="`流程定义有 ${issues.length} 条待确认项`"
        :description="issues.map((issue) => issue.message).join('；')"
      />
    </Card>

    <!-- 2. 审批流设计器 -->
    <Card title="流程设计器" variant="borderless">
      <p :class="hintClassName">
        画布引擎是
        <code :class="codeClassName">@vue-flow/core</code>，节点卡片与右侧属性面板的 每一个控件（Button / Input / NativeSelect /
        Switch / Badge）都出自
        <code :class="codeClassName">@antdv/shadcn-ui</code>。编辑动作本身不在这个组件里： 新增、连线、改办理人、自动布局全部走
        <code :class="codeClassName">@antdv/common-ui/workflow/core/designer</code>
        的纯函数， 组件只负责把画布事件翻译成一次纯函数调用再把新定义 emit
        回来。
      </p>
      <p :class="cn(hintClassName, 'mt-2')">
        改完直接点上面「发起」—— 走的是
        <code :class="codeClassName">engine.start({ definition })</code>，
        实例引用的是这张画布上的草稿，无需重启页面。拖拽坐标会写回
        <code :class="codeClassName">node.position</code>，保存下来下次打开就是同一个样子。
      </p>
      <div class="mt-3">
        <WorkflowDefinitionDesigner
          v-model:definition="draft"
          height="460px"
          :registry="registry"
          @select-node="selectedNodeOfDraft = $event"
          @warn="onDesignerWarn"
        />
      </div>
      <p v-if="selectedNodeOfDraft" :class="cn(hintClassName, 'mt-2')">
        当前选中节点
        <code :class="codeClassName">{{ selectedNodeOfDraft }}</code>
        ——属性面板就在画布右侧，改完即生效。
      </p>
    </Card>

    <!-- 3. 待办中心 -->
    <Card title="我的待办" variant="borderless">
      <div class="mb-2 flex flex-wrap items-center gap-3">
        <Badge variant="secondary">{{ actor }}</Badge>
        <span :class="hintClassName">
          共 {{ tasksApi.total.value }} 条（含未轮到的会签），当前第
          {{ tasksApi.page.value }} /
          {{ Math.max(tasksApi.totalPages.value, 1) }} 页
        </span>
        <div class="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" @click="tasksApi.refresh()">
            刷新
          </Button>
          <Button size="sm" variant="outline" @click="drive">推进定时</Button>
        </div>
      </div>
      <WorkflowTaskList
        :tasks="tasksApi.items.value"
        :loading="tasksApi.loading.value"
        :label-of="labelOf"
        empty-text="这个身份下没有待办；换个办理人，或先发起一条流程"
        @select="pick"
      />
      <div
        v-if="tasksApi.totalPages.value > 1"
        class="mt-3 flex items-center gap-2"
      >
        <Button
          size="sm"
          variant="outline"
          :disabled="tasksApi.page.value <= 1"
          @click="tasksApi.page.value -= 1"
        >
          上一页
        </Button>
        <Button
          size="sm"
          variant="outline"
          :disabled="tasksApi.page.value >= tasksApi.totalPages.value"
          @click="tasksApi.page.value += 1"
        >
          下一页
        </Button>
      </div>
    </Card>

    <!-- 4. 单据详情与办理 -->
    <Card title="单据详情" variant="borderless">
      <template v-if="instance">
        <div class="flex flex-wrap items-center gap-3">
          <Badge
            :variant="instance.status === 'running' ? 'default' : 'outline'"
          >
            {{ INSTANCE_STATUS_LABELS[instance.status] }}
          </Badge>
          <span class="font-medium text-sm">{{ startedWith.name }}</span>
          <span :class="hintClassName">
            发起人 {{ instance.initiator }} · 实例 {{ instance.id }}
          </span>
          <div class="ml-auto flex items-center gap-2">
            <Button
              v-if="instance.status === 'running'"
              size="sm"
              variant="outline"
              :disabled="wf.busy.value"
              @click="wf.suspend({ actor })"
            >
              挂起
            </Button>
            <Button
              v-if="instance.status === 'suspended'"
              size="sm"
              variant="outline"
              :disabled="wf.busy.value"
              @click="wf.resume({ actor })"
            >
              恢复
            </Button>
            <Button
              v-if="
                instance.status === 'running' || instance.status === 'suspended'
              "
              size="sm"
              variant="destructive"
              :disabled="wf.busy.value"
              @click="wf.cancel({ actor, comment: '示例页取消' })"
            >
              取消流程
            </Button>
          </div>
        </div>
        <Separator class="my-3" />
        <p :class="hintClassName">
          当前变量：{{ JSON.stringify(instance.variables) }}
          <template
            v-if="instance.status === 'running' && wf.tasks.value.length === 0"
          >
            —— 没有待办任务，说明流程停在定时节点上，点上面的「推进定时」。
          </template>
        </p>
        <div class="mt-3 grid gap-4 lg:grid-cols-2">
          <WorkflowTimeline
            :entries="instance.history"
            :issues="issues"
            :label-of="labelOf"
          />
          <div>
            <template v-if="selected">
              <div class="mb-2 flex items-center gap-2 text-sm">
                <span class="font-medium">{{ labelOf(selected.nodeId) }}</span>
                <span :class="hintClassName">办理人 {{ selected.assignee }}</span>
              </div>
              <WorkflowApprovalBar
                v-if="canAct"
                :loading="wf.busy.value"
                :actions="[
                  'approve',
                  'reject',
                  'transfer',
                  'addSign',
                  'skip',
                  'withdraw',
                ]"
                @action="onAction"
              />
              <Alert
                v-else
                type="info"
                show-icon
                message="这条任务现在办不了"
                :description="`当前是 ${selected.status}，办理人是 ${selected.assignee}；把上面的办理人改成它，或换一条待办。`"
              />
            </template>
            <p v-else :class="hintClassName">
              从左边待办里选一条，这里出现办理区。
            </p>
          </div>
        </div>
      </template>
      <p v-else :class="hintClassName">
        还没发起流程 —— 填好上面那张表单点「发起」。
      </p>
    </Card>

    <!-- 5. 接线说明 -->
    <Card title="接到自己后端上" variant="borderless">
      <p :class="hintClassName">
        页面里出现的只有三样东西：一个引擎（<code :class="codeClassName">createConfiguredWorkflowEngine</code>）、 两个 composable（<code :class="codeClassName">useWorkflow</code> /
        <code :class="codeClassName">useWorkflowTasks</code>）、三个展示组件。
        要换掉内存存储，在应用启动时注一次：
      </p>
      <pre class="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs">{{
        `configureWorkflow({\n  store: {\n    getInstance: (id) => http.Get(\`/workflow/instance/\${id}\`).then((r) => r.data),\n    saveInstance: (inst) => http.Post('/workflow/instance', inst),\n    saveTasks: (tasks) => http.Post('/workflow/tasks', tasks),\n    tasksOf: (instanceId) => http.Get('/workflow/tasks', { params: { instanceId } }).then((r) => r.data),\n    runningInstances: () => http.Get('/workflow/running').then((r) => r.data),\n  },\n  // 组织架构查询同样是注入的，包不 import 宿主 store\n  resolveRole: (code) => roleUsersMap[code] ?? [],\n})`
      }}</pre>
      <p :class="cn(hintClassName, 'mt-2')">
        定时节点与任务超时都不靠引擎自己看钟：把
        <code :class="codeClassName">engine.tick(now)</code>
        挂在宿主的定时任务或这一页的「推进定时」按钮上即可，重复调用安全（提醒只发一次）。
      </p>
    </Card>
  </div>
</template>
