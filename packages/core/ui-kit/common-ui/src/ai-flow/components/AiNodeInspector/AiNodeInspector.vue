<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

import type {
  AiFlowNode,
  AiNodeData,
  AiNodeKind,
  AiOutputFormat,
} from '../../core/types';

import { computed } from 'vue';

import {
  Badge,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Slider,
  Switch,
  Textarea,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

/**
 * 节点检查器：把 `AiNodeData` 摊成一张按类型收敛的表单。
 *
 * 分层位置：`components/AiNodeInspector`，只做「读一个节点、改一个节点」，
 * 不碰运行器、不碰注册表 —— 它连 `llm` 节点会调哪家供应商都不知道，只认识字段名。
 * 可选项（模型名、工具名、类型清单）一律由宿主当 props 传进来，因为本包不许猜宿主有什么。
 *
 * 为什么按类型只显示相关字段：`AiNodeData` 是八个 kind 拍在一起的宽类型，
 * 全摊开等于让人在二十个框里找那三个该填的，还会把「给 tool 节点填 model」这种
 * 看着合法、跑起来无效的图放出去。
 *
 * 刻意不做的事：不校验（规则在 `core/validate.ts`，这里连表达式都不解析）、
 * 不保存（改完 emit，持久化是宿主的）、不就地改 props（父组件持有图，就地改会让撤销栈失效）。
 */
const props = defineProps<{
  class?: HTMLAttributes['class'];
  /** 可切换的类型清单；不传则类型只读（不允许在检查器里换类型） */
  kinds?: AiNodeKind[];
  /** 可选模型名清单；不传则 model 退化为自由文本 */
  models?: string[];
  /** 正在编辑的节点；组件不改它 */
  node: AiFlowNode;
  /** 已注册的工具名；不传则 tool 退化为自由文本 */
  toolNames?: string[];
}>();

const emit = defineEmits<{ 'update:node': [node: AiFlowNode] }>();

const OUTPUT_FORMATS: AiOutputFormat[] = ['json', 'lines', 'regex', 'text'];

const data = computed<AiNodeData>(() => props.node.data ?? {});

/**
 * 类型 → 可见字段。
 *
 * 这份表和 `core/registry.ts` 里各处理器真正读取的字段一一对应；
 * 新增处理器字段时这里要跟着加，否则会出现「运行器读得到、设计器改不了」的暗字段。
 * `branches` / `args` / `fewShot` 这类结构化字段不在这里编辑：需要行增删的 UI，属于宿主的设计器。
 */
const VISIBLE_FIELDS: Record<string, string[]> = {
  condition: ['expression', 'defaultEdgeId'],
  end: ['prompt', 'outputKey'],
  human: ['resumeLabel', 'outputKey'],
  llm: [
    'model',
    'system',
    'prompt',
    'outputKey',
    'outputFormat',
    'temperature',
    'maxTokens',
    'stream',
    'retries',
    'timeoutMs',
    'inputKeys',
    'tools',
  ],
  prompt: ['system', 'prompt', 'outputKey'],
  start: [],
  tool: ['tool', 'outputKey', 'timeoutMs', 'retries'],
  transform: ['expression', 'outputKey'],
};

const fields = computed<string[]>(() => VISIBLE_FIELDS[props.node.type] ?? []);

/** 空值一律「删掉这个键」而不是写成 ''：留 `model: ''` 会让运行器以为配过了，回落不到默认模型 */
function patch(key: string, value: unknown): void {
  const nextData: Record<string, unknown> = { ...data.value };
  const isEmpty =
    value === '' ||
    value === undefined ||
    (Array.isArray(value) && value.length === 0);
  if (isEmpty) delete nextData[key];
  else nextData[key] = value;
  emit('update:node', { ...props.node, data: nextData as AiNodeData });
}

/** `label` 和 `position` 在节点上而不在 `data` 里，所以单独走一条路径 */
function patchNode(partial: Partial<AiFlowNode>): void {
  emit('update:node', { ...props.node, ...partial });
}

function listField(key: string): string {
  const value = data.value[key as keyof AiNodeData];
  return Array.isArray(value) ? value.join(', ') : '';
}

function fromList(value: number | string): string[] {
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/** 数字框允许清空：清空就是「不配」，而不是 0 —— 0 个 maxTokens 是会把请求打死的 */
function fromNumber(value: number | string): number | undefined {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && String(value).trim() !== ''
    ? parsed
    : undefined;
}

function onPositionChange(event: Event, axis: 'x' | 'y'): void {
  const raw = (event.target as HTMLInputElement).value;
  const value = Number(raw);
  patchNode({
    position: {
      ...(props.node.position ?? { x: 0, y: 0 }),
      [axis]: Number.isFinite(value) ? value : 0,
    },
  });
}

/**
 * `Select` 的 `update:modelValue` 声明的是 reka-ui 的 `AcceptableValue`（含 null），
 * 处理程序只能按它声明的宽类型接住，再在这里收成字符串：null / undefined 归一成空串，
 * 交给 `patch` 走「空值即删键」那条路径，与输入框留空的语义保持一致。
 */
function fromSelect(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

/** 类型只能换成清单里的一项：null（理论上不会出现）或空串就当没改 */
function onKindChange(value: unknown): void {
  const kind = fromSelect(value);
  if (kind) patchNode({ type: kind });
}
</script>

<template>
  <div
    :class="
      cn(
        'flex w-full flex-col gap-4 rounded-md border bg-card p-4',
        props.class,
      )
    "
    data-slot="ai-node-inspector"
  >
    <div
      class="flex items-center justify-between gap-2"
      data-slot="ai-node-inspector-header"
    >
      <div class="flex min-w-0 items-center gap-2">
        <Badge variant="outline">{{ node.type }}</Badge>
        <span class="truncate font-medium text-sm">{{
          node.label ?? node.id
        }}</span>
      </div>
      <span class="shrink-0 font-mono text-muted-foreground text-xs">{{
        node.id
      }}</span>
    </div>

    <div class="grid gap-2">
      <Label for="ai-inspector-label">名称</Label>
      <Input
        id="ai-inspector-label"
        :model-value="node.label ?? ''"
        @update:model-value="
          (value: number | string) =>
            patchNode({ label: String(value) || undefined })
        "
      />
    </div>

    <div v-if="kinds?.length" class="grid gap-2">
      <Label for="ai-inspector-kind">类型</Label>
      <Select :model-value="node.type" @update:model-value="onKindChange">
        <SelectTrigger id="ai-inspector-kind">
          <SelectValue placeholder="选择节点类型" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="item in kinds" :key="item" :value="item">
            {{ item }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div v-else class="text-muted-foreground text-xs">
      类型只读（未提供可切换的类型清单）
    </div>

    <template v-for="field in fields" :key="field">
      <div v-if="field === 'model'" class="grid gap-2">
        <Label for="ai-inspector-model">模型</Label>
        <Input
          v-if="!models?.length"
          id="ai-inspector-model"
          :model-value="data.model ?? ''"
          placeholder="留空则用运行时默认模型"
          @update:model-value="
            (value: number | string) => patch('model', value)
          "
        />
        <Select
          v-else
          :model-value="data.model ?? ''"
          @update:model-value="
            (value: unknown) => patch('model', fromSelect(value))
          "
        >
          <SelectTrigger id="ai-inspector-model">
            <SelectValue placeholder="运行时默认模型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="item in models" :key="item" :value="item">
              {{ item }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div v-else-if="field === 'system'" class="grid gap-2">
        <Label for="ai-inspector-system">系统提示词</Label>
        <Textarea
          id="ai-inspector-system"
          :model-value="data.system ?? ''"
          :rows="3"
          @update:model-value="
            (value: number | string) => patch('system', value)
          "
        />
      </div>

      <div v-else-if="field === 'prompt'" class="grid gap-2">
        <Label for="ai-inspector-prompt">{{
          node.type === 'end' ? '收口模板' : '用户提示词'
        }}</Label>
        <Textarea
          id="ai-inspector-prompt"
          :model-value="data.prompt ?? ''"
          :rows="node.type === 'end' ? 2 : 4"
          @update:model-value="
            (value: number | string) => patch('prompt', value)
          "
        />
      </div>

      <div v-else-if="field === 'expression'" class="grid gap-2">
        <Label for="ai-inspector-expression">
          {{ node.type === 'condition' ? '条件表达式' : '表达式' }}
        </Label>
        <Textarea
          id="ai-inspector-expression"
          :model-value="data.expression ?? ''"
          class="font-mono text-xs"
          :rows="2"
          @update:model-value="
            (value: number | string) => patch('expression', value)
          "
        />
      </div>

      <div v-else-if="field === 'outputKey'" class="grid gap-2">
        <Label for="ai-inspector-output-key">产物键</Label>
        <Input
          id="ai-inspector-output-key"
          :model-value="data.outputKey ?? ''"
          placeholder="留空则用节点 id"
          @update:model-value="
            (value: number | string) => patch('outputKey', value)
          "
        />
      </div>

      <div v-else-if="field === 'outputFormat'" class="grid gap-2">
        <Label for="ai-inspector-output-format">输出解析</Label>
        <Select
          :model-value="data.outputFormat ?? 'text'"
          @update:model-value="
            (value: unknown) => patch('outputFormat', fromSelect(value))
          "
        >
          <SelectTrigger id="ai-inspector-output-format">
            <SelectValue placeholder="text" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="item in OUTPUT_FORMATS"
              :key="item"
              :value="item"
            >
              {{ item }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div v-else-if="field === 'tool'" class="grid gap-2">
        <Label for="ai-inspector-tool">工具</Label>
        <Input
          v-if="!toolNames?.length"
          id="ai-inspector-tool"
          :model-value="data.tool ?? ''"
          placeholder="工具名"
          @update:model-value="(value: number | string) => patch('tool', value)"
        />
        <Select
          v-else
          :model-value="data.tool ?? ''"
          @update:model-value="
            (value: unknown) => patch('tool', fromSelect(value))
          "
        >
          <SelectTrigger id="ai-inspector-tool">
            <SelectValue placeholder="选择工具" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="item in toolNames" :key="item" :value="item">
              {{ item }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div v-else-if="field === 'tools'" class="grid gap-2">
        <Label for="ai-inspector-tools">可用工具（逗号分隔）</Label>
        <Input
          id="ai-inspector-tools"
          :model-value="listField('tools')"
          @update:model-value="
            (value: number | string) => patch('tools', fromList(value))
          "
        />
      </div>

      <div v-else-if="field === 'inputKeys'" class="grid gap-2">
        <Label for="ai-inspector-input-keys">上下文键（逗号分隔）</Label>
        <Input
          id="ai-inspector-input-keys"
          :model-value="listField('inputKeys')"
          @update:model-value="
            (value: number | string) => patch('inputKeys', fromList(value))
          "
        />
      </div>

      <div v-else-if="field === 'temperature'" class="grid gap-2">
        <Label for="ai-inspector-temperature">温度 {{ (data.temperature ?? 0).toFixed(2) }}</Label>
        <Slider
          id="ai-inspector-temperature"
          :max="2"
          :model-value="[data.temperature ?? 0]"
          :step="0.05"
          @update:model-value="
            (value: number[] | undefined) => patch('temperature', value?.[0])
          "
        />
      </div>

      <div v-else-if="field === 'maxTokens'" class="grid gap-2">
        <Label for="ai-inspector-max-tokens">最大输出 token</Label>
        <Input
          id="ai-inspector-max-tokens"
          :model-value="data.maxTokens ?? ''"
          type="number"
          @update:model-value="
            (value: number | string) => patch('maxTokens', fromNumber(value))
          "
        />
      </div>

      <div v-else-if="field === 'timeoutMs'" class="grid gap-2">
        <Label for="ai-inspector-timeout">超时（ms）</Label>
        <Input
          id="ai-inspector-timeout"
          :model-value="data.timeoutMs ?? ''"
          type="number"
          @update:model-value="
            (value: number | string) => patch('timeoutMs', fromNumber(value))
          "
        />
      </div>

      <div v-else-if="field === 'retries'" class="grid gap-2">
        <Label for="ai-inspector-retries">失败重试次数</Label>
        <Input
          id="ai-inspector-retries"
          :model-value="data.retries ?? ''"
          type="number"
          @update:model-value="
            (value: number | string) => patch('retries', fromNumber(value))
          "
        />
      </div>

      <div
        v-else-if="field === 'stream'"
        class="flex items-center justify-between gap-2"
      >
        <Label for="ai-inspector-stream">流式输出</Label>
        <Switch
          id="ai-inspector-stream"
          :model-value="data.stream ?? false"
          @update:model-value="(value: boolean) => patch('stream', value)"
        />
      </div>

      <div v-else-if="field === 'defaultEdgeId'" class="grid gap-2">
        <Label for="ai-inspector-default-edge">默认分支边 id</Label>
        <Input
          id="ai-inspector-default-edge"
          :model-value="data.defaultEdgeId ?? ''"
          placeholder="所有分支都不命中时走这条边"
          @update:model-value="
            (value: number | string) => patch('defaultEdgeId', value)
          "
        />
      </div>

      <div v-else-if="field === 'resumeLabel'" class="grid gap-2">
        <Label for="ai-inspector-resume-label">等待提示语</Label>
        <Input
          id="ai-inspector-resume-label"
          :model-value="data.resumeLabel ?? ''"
          placeholder="展示在运行面板的确认框上方"
          @update:model-value="
            (value: number | string) => patch('resumeLabel', value)
          "
        />
      </div>
    </template>

    <p v-if="fields.length === 0" class="text-muted-foreground text-sm">
      该类型没有可配置项。
    </p>

    <div class="grid grid-cols-2 gap-2" data-slot="ai-node-inspector-position">
      <div class="grid gap-1">
        <Label for="ai-inspector-x">X</Label>
        <Input
          id="ai-inspector-x"
          :model-value="String(node.position?.x ?? 0)"
          type="number"
          @change="onPositionChange($event, 'x')"
        />
      </div>
      <div class="grid gap-1">
        <Label for="ai-inspector-y">Y</Label>
        <Input
          id="ai-inspector-y"
          :model-value="String(node.position?.y ?? 0)"
          type="number"
          @change="onPositionChange($event, 'y')"
        />
      </div>
    </div>
  </div>
</template>
