<script setup lang="ts">
import type {
  AiFlowDefinition,
  AiFlowNode,
  ToolSpec,
} from '@antdv/common-ui/ai-flow';

import { computed, ref } from 'vue';

import { Alert, Card, Space } from '@antdv/common-ui';
import {
  AiFlowCanvas,
  AiNodeInspector,
  AiRunPanel,
  configureAiFlow,
  createConfiguredAiRunner,
  createScriptedProvider,
  resetAiFlowRuntime,
  useAiFlow,
  validateAiFlow,
} from '@antdv/common-ui/ai-flow';
import { message } from '@antdv/popup-ui';
import { Badge, Button, Input, Separator } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

/**
 * AI 工作流编排示例。
 *
 * **全程离线**：Provider 用的是 `createScriptedProvider`（按请求文本/节点 id 回放写死的回复），
 * 页面不发任何网络请求，也不出现 API Key。要接真实模型，只需要把 `configureAiFlow({ provider })`
 * 那一行换成 `createFetchAiProvider({ baseUrl, fetcher })` 并把 `fetcher` 指向宿主自己的
 * 请求封装（凭据留在宿主侧），图、运行器、面板三处代码一行都不用改 —— 这就是这个包
 * 不 import `~/api`、不读环境变量的换取方式。
 *
 * 一条图把八种内置节点里的五种走了一遍：`llm`（带 JSON 输出约束）、`condition`
 * （按上游产物分支）、`tool`（宿主注册的工具）、`human`（挂起等确认，运行面板给续跑按钮）、
 * `end`（三种收口写法之一的模板拼装）。
 */

/** 演示流程：工单先分诊，紧急的查订单再回复，都不紧急的直接进人工确认 */
const flow = ref<AiFlowDefinition>({
  edges: [
    { id: 'e1', source: 'start', target: 'classify' },
    { id: 'e2', source: 'classify', target: 'route' },
    { id: 'eUrgent', source: 'route', target: 'lookup' },
    { id: 'eNormal', source: 'route', target: 'confirm' },
    { id: 'e3', source: 'lookup', target: 'reply' },
    { id: 'e4', source: 'reply', target: 'confirm' },
    { id: 'e5', source: 'confirm', target: 'end' },
  ],
  id: 'support-triage',
  name: '客服工单分诊（离线脚本 Provider）',
  nodes: [
    { id: 'start', label: '入口', position: { x: 40, y: 200 }, type: 'start' },
    {
      data: {
        model: 'fast',
        outputFormat: 'json',
        outputKey: 'classify',
        prompt: '{{ ticket }}',
        schema: {
          properties: {
            category: {
              enum: ['refund', 'logistics', 'other'],
              type: 'string',
            },
            urgent: { type: 'boolean' },
          },
          required: ['category', 'urgent'],
          type: 'object',
        },
        system:
          '你是电商客服的分诊助手。只输出 JSON，字段为 category 与 urgent。',
      },
      id: 'classify',
      label: '分诊（JSON 输出）',
      position: { x: 280, y: 200 },
      type: 'llm',
    },
    {
      data: {
        branches: [{ edgeId: 'eUrgent', expression: 'classify.urgent' }],
        defaultEdgeId: 'eNormal',
      },
      id: 'route',
      label: '按紧急度分流',
      position: { x: 520, y: 200 },
      type: 'condition',
    },
    {
      data: {
        args: { question: '{{ ticket }}' },
        outputKey: 'order',
        tool: 'orderLookup',
      },
      id: 'lookup',
      label: '查订单进度（工具）',
      position: { x: 760, y: 80 },
      type: 'tool',
    },
    {
      data: {
        model: 'default',
        outputKey: 'draft',
        prompt:
          '原话：{{ ticket }}；分诊：{{ classify.category }}；订单：{{ order.status }}。写一句给客户的回复。',
        // 流式：面板那段"逐字往外冒"的文本只有开了这个才看得到（Provider 实现了 stream 才生效）
        stream: true,
      },
      id: 'reply',
      label: '起草回复',
      position: { x: 1000, y: 80 },
      type: 'llm',
    },
    {
      data: { resumeLabel: '确认无误后点「发送」' },
      id: 'confirm',
      label: '人工确认',
      position: { x: 1240, y: 200 },
      type: 'human',
    },
    {
      // 非紧急那条分支没有 `draft`：收口必须给个兜底，否则运行期报「模板缺少变量」而不是发一句少半截的话
      data: {
        prompt: '【{{ classify.category }}】{{ draft ?? confirm_human }}',
      },
      id: 'end',
      label: '发出',
      position: { x: 1480, y: 200 },
      type: 'end',
    },
  ],
  version: 1,
});

/** 宿主注册的工具：没有 LLM 也能被 `tool` 节点直接调用，参数由 `args` 模板渲染 */
const orderLookup: ToolSpec = {
  description: '按问题文本查最近一笔订单的处置进度',
  name: 'orderLookup',
  parameters: [
    {
      description: '客户原话或订单号',
      name: 'question',
      required: true,
      type: 'string',
    },
  ],
  run: (args) => ({
    orderId: 'SO-20261107-0042',
    question: String(args.question ?? ''),
    status: '仓库已接单，预计 24 小时内发出',
  }),
};

/**
 * 脚本 Provider：同一个节点内先按 `contains` 分流，分不出才吃那条只写了 `id` 的默认回复。
 * 两条分诊回复让上面那条条件分支真的走两条路，方便看清画布上的状态涂色。
 */
const provider = createScriptedProvider({
  responses: [
    {
      contains: '退款',
      id: 'classify',
      text: '{"category":"refund","urgent":true}',
      usage: { completion: 12, prompt: 88, total: 100 },
    },
    {
      contains: '物流',
      id: 'classify',
      text: '{"category":"logistics","urgent":false}',
      usage: { completion: 12, prompt: 80, total: 92 },
    },
    { id: 'classify', text: '{"category":"other","urgent":false}' },
    {
      id: 'reply',
      text: '您的订单仓库已接单，预计 24 小时内发出，请留意物流通知。',
    },
  ],
});

configureAiFlow({
  models: { default: 'demo-large', fast: 'demo-small' },
  provider,
  toolSpecs: [orderLookup],
});

const runner = createConfiguredAiRunner();

const ticket = ref('物流一直不动，帮我看看这单到哪了');
const selectedNodeId = ref<string>();

const ai = useAiFlow({
  flow: flow.value,
  onError: (error) =>
    message.error(error instanceof Error ? error.message : String(error)),
  runner,
});

const selectedNode = computed<AiFlowNode | undefined>(() =>
  flow.value.nodes.find((node) => node.id === selectedNodeId.value),
);

/**
 * 定义期校验：画错图要在跑之前就说出来，而不是等运行到一半失败。
 * 签名是 `validateAiFlow(flow, registry, options)`：本图只用内置八种节点类型，注册表留空走默认；
 * 校验选项必须放**第三个**参数，塞在第二个位置会被当成注册表读，直接抛参数误用。
 * `knownInputs` 必须把运行入参 `ticket` 报给校验器 —— 模板里引用它的是**运行期**才有的变量，
 * 不声明的话每次打开页面都挂着三条「未知变量」，真正画错的那一条反而被淹没。
 */
const issues = computed(
  () =>
    validateAiFlow(flow.value, undefined, { knownInputs: ['ticket'] }).issues,
);

/**
 * `AiNodeInspector` 不改传入的节点，只把改好的整份节点交回来。
 * 这里做**原地替换数组项**而不是重建 `flow` 对象：`useAiFlow` 在 setup 时就把
 * `flow` 交给了运行器，换个对象引用等于跑的还是旧图，而面板看起来在改新图 ——
 * 这种"改了没生效"最难查。要支持整图替换就得先重建 composable，那是宿主的状态管理。
 */
function onNodeUpdate(next: AiFlowNode): void {
  const index = flow.value.nodes.findIndex((node) => node.id === next.id);
  if (index !== -1) flow.value.nodes[index] = next;
}

async function run() {
  await ai.run({ ticket: ticket.value });
}

function onCanvasSelect(nodeId: string): void {
  selectedNodeId.value = nodeId;
}

function resetRuntime(): void {
  resetAiFlowRuntime();
  message.info('已清空注入的运行时；本页刷新后会重新 configure 一次');
}

const containerClassName = cn('space-y-6');
const hintClassName = cn('text-sm', 'leading-relaxed', 'text-muted-foreground');
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
    <!-- 1. 跑一次 -->
    <Card title="运行" variant="borderless">
      <p :class="hintClassName">
        Provider 是
        <code :class="codeClassName">createScriptedProvider</code> 的离线回放，
        所以这里看到的每条模型回复都是本页写死的：<code :class="codeClassName">ticket</code>
        里写「退款」走紧急分支（查订单 → 起草回复），
        写「物流」走默认分支（直接进人工确认）。
      </p>
      <Space :size="4" class="mt-3" wrap>
        <label class="flex w-80 flex-col gap-1">
          <span class="text-sm">工单原话（进流程变量
            <code :class="codeClassName">ticket</code>）</span>
          <Input v-model="ticket" />
        </label>
        <Button :disabled="ai.running.value" @click="run">跑一次</Button>
        <Button
          :disabled="!ai.running.value"
          variant="outline"
          @click="ai.cancel()"
          >
取消
</Button>
        <Badge variant="outline">{{ ai.status.value ?? '未运行' }}</Badge>
        <Badge variant="secondary">
          token {{ ai.usage.value.total }}（入 {{ ai.usage.value.prompt }} / 出
          {{ ai.usage.value.completion }}）
        </Badge>
        <Button size="sm" variant="ghost" @click="resetRuntime">
清空注入的运行时
</Button>
      </Space>
      <Alert
        v-if="issues.length > 0"
        class="mt-4"
        type="warning"
        show-icon
        :message="`编排图有 ${issues.length} 条待确认项`"
        :description="issues.map((issue) => issue.message).join('；')"
      />
      <Separator class="my-4" />
      <AiRunPanel
        :error="ai.error.value"
        :events="ai.events.value"
        :flow="flow"
        :running="ai.running.value"
        :state="ai.state.value"
        @cancel="ai.cancel()"
        @resume="(value) => ai.resume(value)"
        @run="run"
        @select="onCanvasSelect"
      />
    </Card>

    <!-- 2. 画布 -->
    <Card title="编排画布（运行态涂色）" variant="borderless">
      <p :class="hintClassName">
        画布只做一件事：把
        <code :class="codeClassName">core/runner</code> 算完的
        <code :class="codeClassName">AiRunState</code>
        涂成节点外环。这一层没有运行语义 —— 点节点只是 emit 一个 id
        给宿主，重跑/续跑都由上面的面板触发。 没被走到的分支是
        <code :class="codeClassName">skipped</code>（只剩四成不透明度），
        和「还没轮到」的
        <code :class="codeClassName">pending</code> 不是一种颜色。
      </p>
      <div class="mt-3">
        <AiFlowCanvas
          :editable="false"
          :flow="flow"
          :state="ai.state.value"
          class="h-[420px]"
          @select="onCanvasSelect"
        />
      </div>
    </Card>

    <!-- 3. 属性面板 -->
    <Card title="节点属性" variant="borderless">
      <p :class="hintClassName">
        {{
          selectedNode
            ? `正在编辑 ${selectedNode.label ?? selectedNode.id}`
            : '先在画布或面板上点一个节点'
        }}
        ——面板不改动传进来的对象，改完把整份节点 emit
        回来，页面做一次不可变替换。
      </p>
      <div class="mt-3 h-[420px] overflow-hidden rounded-md border">
        <AiNodeInspector
          v-if="selectedNode"
          :kinds="[
            'condition',
            'end',
            'human',
            'llm',
            'prompt',
            'tool',
            'transform',
          ]"
          :models="['demo-large', 'demo-small']"
          :node="selectedNode"
          :tool-names="['orderLookup']"
          @update:node="onNodeUpdate"
        />
        <p v-else :class="cn(hintClassName, 'p-4')">
          这条链路上「谁能改什么」是切开的：面板只管一个节点的字段，图结构（加节点、连线）不在这个包里
          —— 它属于第二个图编辑库，仓库里刻意不做。
        </p>
      </div>
    </Card>

    <!-- 4. 接线说明 -->
    <Card title="接到真实模型上" variant="borderless">
      <p :class="hintClassName">
        只有两个接线点：<code :class="codeClassName">configureAiFlow()</code>
        注入 Provider / 模型别名 / 工具，
        <code :class="codeClassName">createConfiguredAiRunner()</code>
        造运行器。
      </p>
      <pre class="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs">{{
        `configureAiFlow({\n  // 1) 凭据与 baseUrl 都在宿主侧，包里不读环境变量\n  provider: createFetchAiProvider({\n    baseUrl: import.meta.env.VITE_AI_GATEWAY,\n    fetcher: (url, init) => http.post(url, init.body, { headers: init.headers }),\n  }),\n  // 2) 图里写别名，换模型不重画图\n  models: { default: 'gpt-4o-mini', fast: 'qwen-turbo' },\n  // 3) 工具由宿主注册：函数名就是图里 tool 节点填的名字\n  toolSpecs: [orderLookup],\n})`
      }}</pre>
      <p :class="cn(hintClassName, 'mt-2')">
        挂起的 <code :class="codeClassName">human</code> 节点全是纯数据（<code
          :class="codeClassName"
          >frontier</code>
        + <code :class="codeClassName">nodes[].input</code>），把
        <code :class="codeClassName">AiRunState</code> 存进库里， 换一台机器
        <code :class="codeClassName">runner.resume(savedState, 人的输入)</code>
        就能接着跑。
      </p>
    </Card>
  </div>
</template>
