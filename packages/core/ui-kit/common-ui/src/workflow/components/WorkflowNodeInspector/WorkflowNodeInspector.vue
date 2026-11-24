<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

import type {
  AssigneeRule,
  AssigneeStrategyName,
  MultiInstanceMode,
  RejectTarget,
  WorkflowActionName,
  WorkflowDefinition,
} from '../../core/types';

import { computed } from 'vue';

import {
  Badge,
  Button,
  Checkbox,
  Input,
  Label,
  NativeSelect,
  NativeSelectOption,
  ScrollArea,
  Separator,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

import {
  addNode,
  bindBranch,
  branchView,
  DESIGNER_NODE_KINDS,
  nodeKindMeta,
  patchNodeData,
  removeNode,
  renameNode,
  setAssignees,
  setDefaultBranchEdge,
  WorkflowDesignerError,
} from '../../core/designer';
import { ACTION_LABELS } from '../../utils/labels';

/**
 * 审批流设计器的属性面板。
 *
 * 它是 `core/designer.ts` 的一层皮：每个控件的 change 做的都是
 * 「拿 props.definition 调一个纯函数 → emit 新定义」，面板自己**不持有**定义副本。
 * 这么写的收益很具体：宿主要接撤销/重做，只要把 emit 出来的定义压进栈即可，
 * 不需要知道面板内部有什么；面板被换成只读实现也不影响语义。
 *
 * 只改 `node.data` 与 `label`，不改图结构 —— 增删节点、连线属于画布组件。
 * 全部控件来自 `@antdv/shadcn-ui`，本包不许出现第二个 UI 库。
 */
const props = defineProps<{
  class?: HTMLAttributes['class'];
  definition: WorkflowDefinition;
  /** 当前选中的节点；为空时面板给出"选一个"的引导而不是空白 */
  nodeId?: string;
}>();

const emit = defineEmits<{
  /** 新定义；宿主直接覆盖自己的状态即可 */
  'update:definition': [definition: WorkflowDefinition];
  /** 校验类失败（表达式指向了别的节点等），已经是一句中文，宿主只需要落日志/toast */
  warn: [message: string];
}>();

const STRATEGY_OPTIONS: Array<{ label: string; value: AssigneeStrategyName }> =
  [
    { label: '指定人', value: 'user' },
    { label: '角色', value: 'role' },
    { label: '流程变量', value: 'expression' },
    { label: '发起人', value: 'initiator' },
    { label: '部门负责人', value: 'departmentHead' },
  ];

const MULTI_OPTIONS: Array<{ label: string; value: MultiInstanceMode }> = [
  { label: '或签：一人办完即推进', value: 'any' },
  { label: '会签：全部办完才推进', value: 'all' },
  { label: '顺序会签：按次序逐人办理', value: 'sequence' },
];

const ACTION_OPTIONS = Object.keys(ACTION_LABELS) as WorkflowActionName[];

const node = computed(() =>
  props.definition.nodes.find((item) => item.id === props.nodeId),
);
const data = computed(() => node.value?.data ?? {});
const meta = computed(() =>
  node.value ? nodeKindMeta(node.value.type) : undefined,
);
const isApprovalLike = computed(
  () => node.value?.type === 'approval' || node.value?.type === 'cc',
);

/** 面板里出现的类型 = 内置六类 + 定义里用到的自定义类型（后者由宿主注册处理器） */
const kindOptions = computed(() => {
  const builtIn = DESIGNER_NODE_KINDS.map((item) => ({
    label: item.label,
    value: item.kind,
  }));
  const used = new Set(props.definition.nodes.map((item) => item.type));
  const extra = [...used]
    .filter((kind) => !builtIn.some((item) => item.value === kind))
    .map((kind) => ({ label: `${kind}（自定义）`, value: kind }));
  return [...builtIn, ...extra];
});

/** 驳回落点：两个语义化落点 + 定义里除自己以外的节点 */
const rejectOptions = computed(() => [
  { label: '回上一节点', value: 'previous' },
  { label: '回发起人', value: 'initiator' },
  ...props.definition.nodes
    .filter((item) => item.id !== props.nodeId)
    .map((item) => ({
      label: `回「${item.label ?? item.id}」`,
      value: item.id,
    })),
]);

/** 条件节点：已绑定分支 + 未绑定出线，全部由纯函数算出，面板不自己拼 */
const branchState = computed(() => {
  if (node.value?.type !== 'condition') return undefined;
  try {
    return branchView(props.definition, node.value.id);
  } catch (error) {
    emit('warn', errorMessage(error));
    return undefined;
  }
});

/** 条件节点的出线，供"默认边"下拉直接枚举 */
const conditionEdges = computed(() =>
  node.value
    ? props.definition.edges.filter((edge) => edge.source === node.value!.id)
    : [],
);

function errorMessage(error: unknown): string {
  return error instanceof WorkflowDesignerError ? error.message : String(error);
}

/** 一切改动的统一出口：纯函数报错就转成一条 warn，绝不 emit 半成品定义 */
function apply(build: (def: WorkflowDefinition) => WorkflowDefinition): void {
  const target = node.value;
  if (!target) return;
  try {
    emit('update:definition', build(props.definition));
  } catch (error) {
    emit('warn', errorMessage(error));
  }
}

// ---------- 名称 ----------
function onRename(label: string): void {
  const target = node.value;
  if (!target) return;
  try {
    emit('update:definition', renameNode(props.definition, target.id, label));
  } catch (error) {
    emit('warn', errorMessage(error));
  }
}

// ---------- 办理人 ----------
/**
 * `params` 摊成一个输入框：策略决定了这一个字符串是什么（用户 id 列表 / 角色码 / 变量模板），
 * 比给每种策略画一套控件更好懂，也不会让人误以为"填了 userIds 还能填 roleCode"。
 */
function ruleToText(rule: AssigneeRule): string {
  const params = rule.params ?? {};
  if (rule.strategy === 'user') {
    const ids = (params.userIds ?? params.users) as string[] | undefined;
    return (ids ?? []).join(',');
  }
  if (rule.strategy === 'role')
    return String(params.roleCode ?? params.role ?? '');
  if (rule.strategy === 'expression')
    return String(params.expression ?? params.value ?? '');
  return '';
}

function ruleParamsOf(
  strategy: AssigneeStrategyName,
  text: string,
): Record<string, unknown> | undefined {
  if (strategy === 'user')
    return { userIds: text.split(/[,，\s]+/u).filter(Boolean) };
  if (strategy === 'role') return { roleCode: text.trim() };
  if (strategy === 'expression') return { expression: text.trim() };
  return undefined;
}

const rules = computed<AssigneeRule[]>(() => data.value.assignees ?? []);

function patchRules(next: AssigneeRule[]): void {
  apply((def) => setAssignees(def, node.value!.id, next));
}

function addRule(): void {
  patchRules([...rules.value, { params: { userIds: [] }, strategy: 'user' }]);
}

function updateRule(index: number, patch: Partial<AssigneeRule>): void {
  const current = rules.value[index];
  if (!current) return;
  const strategy = patch.strategy ?? current.strategy;
  const next = rules.value.map((item, i) =>
    i === index ? { ...item, ...patch, strategy } : item,
  );
  patchRules(next);
}

function onRuleText(index: number, text: string): void {
  const current = rules.value[index];
  if (!current) return;
  updateRule(index, {
    params: ruleParamsOf(current.strategy, text),
    text,
  } as Partial<AssigneeRule>);
}

/**
 * `NativeSelect` 把 `update:modelValue` 的签名声明成零参函数（组件包里 emits 的写法所致），
 * 于是 `@update:model-value="(value: any) => ..."` 一定撞 TS2322。走原生 change 语义等价、
 * 少一层断言，也与 `Calendar.vue` 的既有套路一致。
 */
function selectValue(event: Event): string {
  return String((event.target as HTMLSelectElement).value);
}

function onRuleStrategy(index: number, strategy: AssigneeStrategyName): void {
  updateRule(index, { params: ruleParamsOf(strategy, ''), strategy });
}

function removeRule(index: number): void {
  patchRules(rules.value.filter((_, i) => i !== index));
}

// ---------- 其余 data 字段 ----------
function onMulti(mode: MultiInstanceMode): void {
  // 切到顺序会签时把并发数默认成 1：留空等于"一次一个"，但显式写出来面板才可解释
  apply((def) =>
    patchNodeData(
      def,
      node.value!.id,
      mode === 'sequence'
        ? { multi: mode, sequentialBatch: 1 }
        : { multi: mode },
    ),
  );
}

function onAction(action: WorkflowActionName, checked: boolean): void {
  const current = new Set(data.value.actions ?? []);
  if (checked) current.add(action);
  else current.delete(action);
  const actions = ACTION_OPTIONS.filter((item) => current.has(item));
  apply((def) =>
    patchNodeData(def, node.value!.id, {
      actions: actions.length === 0 ? undefined : actions,
    }),
  );
}

function onRejectTo(value: string): void {
  apply((def) =>
    patchNodeData(def, node.value!.id, { rejectTo: value as RejectTarget }),
  );
}

function onTimeoutSeconds(value: string): void {
  const seconds = Number(value);
  const timeoutMs =
    Number.isFinite(seconds) && seconds > 0
      ? Math.round(seconds * 1000)
      : undefined;
  apply((def) => patchNodeData(def, node.value!.id, { timeoutMs }));
}

function onTimeoutAction(value: string): void {
  const timeoutAction = (value || undefined) as
    | 'approve'
    | 'reject'
    | 'remind'
    | undefined;
  apply((def) => patchNodeData(def, node.value!.id, { timeoutAction }));
}

function onSequentialBatch(value: string): void {
  const batch = Number(value);
  apply((def) =>
    patchNodeData(def, node.value!.id, {
      sequentialBatch:
        Number.isFinite(batch) && batch > 0 ? Math.floor(batch) : undefined,
    }),
  );
}

// ---------- 条件分支 ----------
function onBindBranch(edgeId: string, expression: string): void {
  apply((def) => bindBranch(def, node.value!.id, { edgeId, expression }));
}

function onDefaultEdge(edgeId: string): void {
  apply((def) => setDefaultBranchEdge(def, node.value!.id, edgeId || null));
}

// ---------- 删除 ----------
function onRemove(): void {
  const target = node.value;
  if (!target || meta.value?.singleton) return;
  try {
    emit(
      'update:definition',
      removeNode(props.definition, target.id).definition,
    );
  } catch (error) {
    emit('warn', errorMessage(error));
  }
}

/**
 * 供宿主在"选中节点旁边插一个同类节点"时用；面板自己不放新增入口，
 * 新增归左侧调色板，两条入口只留一条才不会让人找不到节点去哪了。
 */
function addSibling(kind: string): void {
  try {
    emit('update:definition', addNode(props.definition, { kind }).definition);
  } catch (error) {
    emit('warn', errorMessage(error));
  }
}

defineExpose({ addSibling, isApprovalLike });
</script>

<template>
  <div
    :class="cn('flex h-full w-full flex-col border-l bg-card', props.class)"
    data-slot="workflow-node-inspector"
  >
    <div class="flex items-center justify-between gap-2 border-b px-3 py-2">
      <span class="truncate font-medium text-sm">
        {{ node ? (node.label ?? node.id) : '属性面板' }}
      </span>
      <Badge v-if="meta" variant="outline">{{ meta.label }}</Badge>
    </div>

    <ScrollArea class="flex-1">
      <div class="space-y-4 p-3">
        <p v-if="!node" class="py-8 text-center text-muted-foreground text-xs">
          在画布上点一个节点，这里就编辑它。
        </p>

        <template v-else>
          <p class="text-muted-foreground text-xs leading-relaxed">
            {{ meta?.hint }}
          </p>

          <div class="space-y-1.5">
            <Label for="wf-node-label">节点名称</Label>
            <Input
              id="wf-node-label"
              :model-value="node.label ?? ''"
              placeholder="审批节点"
              @update:model-value="(value: any) => onRename(String(value))"
            />
            <p class="font-mono text-muted-foreground text-[11px]">
              id：{{ node.id }}
            </p>
          </div>

          <!-- 审批 / 抄送 -->
          <template v-if="isApprovalLike">
            <Separator />
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <Label>办理人规则</Label>
                <Button size="xs" variant="outline" @click="addRule">
                  添加规则
                </Button>
              </div>
              <p class="text-muted-foreground text-[11px]">
                多条规则解析出的人合并去重；顺序即优先级，主策略没人时走该条的兜底。
              </p>
              <div
                v-for="(rule, index) in rules"
                :key="`${node.id}-rule-${index}`"
                class="space-y-1.5 rounded-md border p-2"
              >
                <div class="flex items-center gap-2">
                  <NativeSelect
                    class="flex-1"
                    :model-value="rule.strategy"
                    @change="
                      (e: Event) =>
                        onRuleStrategy(
                          index,
                          selectValue(e) as AssigneeStrategyName,
                        )
                    "
                  >
                    <NativeSelectOption
                      v-for="option in STRATEGY_OPTIONS"
                      :key="option.value"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </NativeSelectOption>
                  </NativeSelect>
                  <Button size="xs" variant="ghost" @click="removeRule(index)">
                    删除
                  </Button>
                </div>
                <Input
                  v-if="
                    rule.strategy === 'user' ||
                    rule.strategy === 'role' ||
                    rule.strategy === 'expression'
                  "
                  :model-value="ruleToText(rule)"
                  :placeholder="
                    rule.strategy === 'user'
                      ? 'admin,custom'
                      : rule.strategy === 'role'
                        ? 'hrManager'
                        : '{{ form.deptLeader }}'
                  "
                  @update:model-value="
                    (value: any) => onRuleText(index, String(value))
                  "
                />
                <p v-else class="text-muted-foreground text-[11px]">
                  该策略不需要参数。
                </p>
              </div>
            </div>

            <div class="space-y-1.5">
              <Label>多人推进</Label>
              <NativeSelect
                class="w-full"
                :model-value="data.multi ?? 'any'"
                @change="
                  (e: Event) => onMulti(selectValue(e) as MultiInstanceMode)
                "
              >
                <NativeSelectOption
                  v-for="option in MULTI_OPTIONS"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </NativeSelectOption>
              </NativeSelect>
              <template v-if="data.multi === 'sequence'">
                <Label class="pt-1" for="wf-seq-batch">同时激活几条</Label>
                <Input
                  id="wf-seq-batch"
                  :model-value="String(data.sequentialBatch ?? 1)"
                  min="1"
                  type="number"
                  @update:model-value="
                    (value: any) => onSequentialBatch(String(value))
                  "
                />
              </template>
            </div>

            <div class="space-y-1.5">
              <Label>允许动作</Label>
              <div class="grid grid-cols-2 gap-1.5">
                <label
                  v-for="action in ACTION_OPTIONS"
                  :key="action"
                  class="flex cursor-pointer items-center gap-2 text-xs"
                >
                  <Checkbox
                    :checked="(data.actions ?? []).includes(action)"
                    @update:checked="
                      (value: any) => onAction(action, Boolean(value))
                    "
                  />
                  {{ ACTION_LABELS[action] }}
                </label>
              </div>
              <p class="text-muted-foreground text-[11px]">
                全不勾＝不限，引擎按内置规则放行。
              </p>
            </div>

            <div class="space-y-1.5">
              <Label>驳回落点</Label>
              <NativeSelect
                class="w-full"
                :model-value="data.rejectTo ?? 'previous'"
                @change="(e: Event) => onRejectTo(selectValue(e))"
              >
                <NativeSelectOption
                  v-for="option in rejectOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </NativeSelectOption>
              </NativeSelect>
            </div>
          </template>

          <!-- 条件分支 -->
          <template v-else-if="node.type === 'condition'">
            <Separator />
            <div class="space-y-2">
              <Label>分支表达式</Label>
              <p class="text-muted-foreground text-[11px]">
                按顺序取第一条命中的出线。表达式走图内核的受限语法（变量名、比较、与或非），不是
                JS。
              </p>
              <div
                v-for="branch in branchState?.bound ?? []"
                :key="branch.edgeId"
                class="space-y-1 rounded-md border p-2"
              >
                <div
                  class="flex items-center justify-between gap-2 text-[11px]"
                >
                  <span class="font-mono text-muted-foreground">{{
                    branch.edgeId
                  }}</span>
                  <span class="truncate text-muted-foreground">→ {{ branch.target }}</span>
                </div>
                <Input
                  :model-value="branch.expression"
                  placeholder="days >= 3"
                  @update:model-value="
                    (value: any) => onBindBranch(branch.edgeId, String(value))
                  "
                />
              </div>
              <div
                v-for="edge in branchState?.unbound ?? []"
                :key="edge.id"
                class="flex items-center gap-2 rounded-md border border-dashed p-2"
              >
                <span
                  class="shrink-0 font-mono text-[11px] text-muted-foreground"
                  >{{ edge.id }}</span>
                <Input
                  class="flex-1"
                  placeholder="表达式，留空则不绑定"
                  @update:model-value="
                    (value: any) =>
                      String(value) && onBindBranch(edge.id, String(value))
                  "
                />
              </div>
              <p
                v-if="
                  (branchState?.bound ?? []).length === 0 &&
                  (branchState?.unbound ?? []).length === 0
                "
                class="text-muted-foreground text-xs"
              >
                还没有出线：从节点右侧的锚点拖一条线到目标节点。
              </p>

              <Separator />
              <div class="space-y-1.5">
                <Label>默认边（都不命中时走）</Label>
                <NativeSelect
                  class="w-full"
                  :model-value="branchState?.defaultEdgeId ?? ''"
                  @change="(e: Event) => onDefaultEdge(selectValue(e))"
                >
                  <NativeSelectOption value="">未设置</NativeSelectOption>
                  <NativeSelectOption
                    v-for="edge in conditionEdges"
                    :key="edge.id"
                    :value="edge.id"
                  >
                    {{ edge.id }} → {{ edge.target }}
                  </NativeSelectOption>
                </NativeSelect>
              </div>
            </div>
          </template>

          <!-- 定时等待 -->
          <template v-else-if="node.type === 'timer'">
            <Separator />
            <div class="space-y-1.5">
              <Label for="wf-timeout-seconds">等待时长（秒）</Label>
              <Input
                id="wf-timeout-seconds"
                :model-value="
                  data.timeoutMs ? String(data.timeoutMs / 1000) : ''
                "
                placeholder="60"
                type="number"
                @update:model-value="
                  (value: any) => onTimeoutSeconds(String(value))
                "
              />
              <p class="text-muted-foreground text-[11px]">
                引擎不看钟：到期由宿主调
                <code>engine.tick(now)</code> 或后台扫描唤醒。
              </p>
            </div>
          </template>

          <!-- 超时动作：approval 与 timer 都读这个字段 -->
          <template v-if="node.type === 'timer' || isApprovalLike">
            <div class="space-y-1.5">
              <Label>超时后自动执行</Label>
              <NativeSelect
                class="w-full"
                :model-value="data.timeoutAction ?? ''"
                @change="(e: Event) => onTimeoutAction(selectValue(e))"
              >
                <NativeSelectOption value="">不自动处理</NativeSelectOption>
                <NativeSelectOption value="remind">
                  提醒办理人
                </NativeSelectOption>
                <NativeSelectOption value="approve">
                  自动同意
                </NativeSelectOption>
                <NativeSelectOption value="reject">自动驳回</NativeSelectOption>
              </NativeSelect>
              <p class="text-muted-foreground text-[11px]">
                需要先配上「超时时长」，否则永远不会触发。
              </p>
            </div>
          </template>

          <Separator />
          <div class="space-y-1.5">
            <Label>节点类型（只读）</Label>
            <NativeSelect class="w-full" disabled :model-value="node.type">
              <NativeSelectOption
                v-for="option in kindOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </NativeSelectOption>
            </NativeSelect>
            <p class="text-muted-foreground text-[11px]">
              换类型会丢掉已有配置，面板不做这件事；要换就从左侧调色板新增一个再删掉旧的。
            </p>
          </div>

          <Button
            :disabled="meta?.singleton"
            class="w-full"
            variant="outline"
            @click="onRemove"
          >
            {{ meta?.singleton ? '入口节点不可删除' : '删除该节点及其连线' }}
          </Button>
        </template>
      </div>
    </ScrollArea>
  </div>
</template>
