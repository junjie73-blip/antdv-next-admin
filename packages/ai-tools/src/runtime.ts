import type { ChatTool } from 'vue-llm';

import type {
  FillFormFieldsArgs,
  FillFormFieldsResult,
  GenerateFormArgs,
  GenerateFormResult,
  NavigateToArgs,
  SearchTableArgs,
  SearchTableResult,
} from './tool-types';
import type { ToolConfirmation, ToolOutcome, ToolRuntime } from './types';

/**
 * 工具工厂：把纯推理函数包装成 vue-llm 的 ChatTool。
 * 所有浏览器/框架能力都从 ToolRuntime 注入，这里只做编排与审计。
 */
import { defineTool } from 'vue-llm';

import {
  dedupeFilters,
  inferFormSchema,
  inferFormValues,
  matchNavigation,
  parseTableQuery,
} from './infer';

let traceSeq = 0;
function nextTraceId(prefix: string): string {
  traceSeq += 1;
  return `${prefix}_${Date.now().toString(36)}_${traceSeq}`;
}

function outcome<T>(
  ok: boolean,
  message: string,
  data?: T,
  confirmation?: ToolConfirmation,
): ToolOutcome<T> {
  return { ok, message, data, confirmation, traceId: nextTraceId('tool') };
}

/** 参数白名单：只透出声明过的字段，防止模型塞入额外参数 */
function pickArgs<T extends Record<string, unknown>>(
  args: unknown,
  keys: readonly string[],
): T {
  const source = (args && typeof args === 'object' ? args : {}) as Record<
    string,
    unknown
  >;
  const picked: Record<string, unknown> = {};
  for (const key of keys)
    if (source[key] !== undefined) picked[key] = source[key];
  return picked as T;
}

const JSON_OBJECT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
} as const;

export interface AiTools {
  searchTable: ReturnType<typeof createSearchTable>;
  generateForm: ReturnType<typeof createGenerateForm>;
  fillFormFields: ReturnType<typeof createFillFormFields>;
  navigateTo: ReturnType<typeof createNavigateTo>;
  confirmAction: ReturnType<typeof createConfirmAction>;
  all: Array<ChatTool<any, any>>;
}

function createSearchTable(runtime: ToolRuntime) {
  return defineTool<SearchTableArgs, ToolOutcome<SearchTableResult>>({
    name: 'search_table',
    description:
      '根据自然语言生成筛选/排序条件并应用到当前表格。仅使用当前页面声明的字段字典。',
    parameters: {
      ...JSON_OBJECT_SCHEMA,
      properties: {
        utterance: { type: 'string', description: '用户的原始描述' },
        target: { type: 'string', description: '可选：目标表格 id' },
      },
      required: ['utterance'],
    },
    async execute(args) {
      const started = performance.now();
      const ctx = runtime.context();
      const query = parseTableQuery(args.utterance, ctx.fields);
      const filters = dedupeFilters(query.filters);
      const table = runtime.table(args.target);

      if (!table) {
        const result = outcome(
          false,
          '当前页面没有可操作的表格，请切换到列表页后重试。',
          {
            applied: false,
            filters,
            sorts: query.sorts,
            summary: '无表格句柄',
          },
        );
        runtime.audit({
          args: { ...args },
          ms: performance.now() - started,
          result: 'error',
          route: ctx.route,
          tool: 'search_table',
          traceId: result.traceId,
        });
        return result;
      }

      await table.applyQuery({ ...query, filters });
      const result = outcome(
        true,
        filters.length > 0 || query.sorts.length > 0
          ? `已应用 ${filters.length} 个筛选、${query.sorts.length} 个排序条件。`
          : '未识别到明确条件，已保留当前筛选。',
        {
          applied: filters.length > 0 || query.sorts.length > 0,
          filters,
          sorts: query.sorts,
          summary: `筛选 ${filters.length} 项 / 排序 ${query.sorts.length} 项`,
        },
      );
      runtime.audit({
        args: { ...args },
        ms: performance.now() - started,
        result: 'success',
        route: ctx.route,
        tool: 'search_table',
        traceId: result.traceId,
      });
      return result;
    },
  });
}

function createGenerateForm(runtime: ToolRuntime) {
  return defineTool<GenerateFormArgs, ToolOutcome<GenerateFormResult>>({
    name: 'generate_form',
    description:
      '根据自然语言描述生成 JSON Schema，并打开新建/编辑弹窗；只打开表单，不提交数据。',
    parameters: {
      ...JSON_OBJECT_SCHEMA,
      properties: {
        description: { type: 'string', description: '用户想要的表单描述' },
        template: { type: 'string', description: '可选：已有模板 id' },
      },
      required: ['description'],
    },
    async execute(args) {
      const started = performance.now();
      const ctx = runtime.context();
      const form = runtime.form();
      const schema = inferFormSchema(
        args.description,
        ctx.fields ?? [],
        ctx.title,
      );
      if (!form) {
        const result = outcome(false, '当前页面没有可打开的表单。', {
          opened: false,
          schema,
          formId: '',
        });
        runtime.audit({
          args: { ...args },
          ms: performance.now() - started,
          result: 'error',
          route: ctx.route,
          tool: 'generate_form',
          traceId: result.traceId,
        });
        return result;
      }

      await form.open(schema);
      const result = outcome(
        true,
        `已生成含 ${Object.keys(schema.properties).length} 个字段的表单，请确认后提交。`,
        {
          opened: true,
          schema,
          formId: form.id,
        },
      );
      runtime.audit({
        args: { ...args },
        ms: performance.now() - started,
        result: 'success',
        route: ctx.route,
        tool: 'generate_form',
        traceId: result.traceId,
      });
      return result;
    },
  });
}

function createFillFormFields(runtime: ToolRuntime) {
  return defineTool<FillFormFieldsArgs, ToolOutcome<FillFormFieldsResult>>({
    name: 'fill_form_fields',
    description:
      'Smart Fill：根据当前选中行、路由参数和用户描述推断字段值并回填表单，低置信度字段留空，人工确认后才提交。',
    parameters: {
      ...JSON_OBJECT_SCHEMA,
      properties: {
        fields: {
          type: 'array',
          items: { type: 'string' },
          description: '要填充的字段 key',
        },
        source: {
          type: 'string',
          description: 'context | history | description',
        },
      },
    },
    async execute(args) {
      const started = performance.now();
      const ctx = runtime.context();
      const form = runtime.form();
      const allFields = (ctx.fields ?? []).filter(
        (field) => !args.fields?.length || args.fields.includes(field.key),
      );
      const inferred = inferFormValues({
        fields: allFields,
        selectedRows: ctx.selectedRows,
        routeParams: {},
        minConfidence: 0.7,
      });

      if (!form) {
        const result = outcome(false, '当前页面没有可回填的表单。', {
          ...inferred,
          filled: Object.keys(inferred.values),
        });
        runtime.audit({
          args: { ...args },
          ms: performance.now() - started,
          result: 'error',
          route: ctx.route,
          tool: 'fill_form_fields',
          traceId: result.traceId,
        });
        return result;
      }

      await form.fill(inferred.values);
      const filled = Object.keys(inferred.values);
      const result = outcome(
        true,
        filled.length > 0
          ? `已预填 ${filled.length} 个字段，${inferred.skipped.length} 个字段需人工补录。请检查后提交。`
          : '没有足够可靠的数据可预填，请手动填写。',
        { ...inferred, filled },
      );
      runtime.audit({
        args: { ...args },
        ms: performance.now() - started,
        result: 'success',
        route: ctx.route,
        tool: 'fill_form_fields',
        traceId: result.traceId,
      });
      return result;
    },
  });
}

function createNavigateTo(runtime: ToolRuntime) {
  return defineTool<NavigateToArgs, ToolOutcome<{ routeName: string }>>({
    name: 'navigate_to',
    description: '根据意图跳转到当前页面声明过的目标路由，禁止自由拼 path。',
    parameters: {
      ...JSON_OBJECT_SCHEMA,
      properties: {
        utterance: { type: 'string', description: '用户的跳转意图' },
      },
      required: ['utterance'],
    },
    async execute(args) {
      const started = performance.now();
      const ctx = runtime.context();
      const intent = matchNavigation(args.utterance, ctx.links ?? []);
      if (!intent) {
        const result = outcome<{ routeName: string }>(
          false,
          '没有找到匹配的页面，请换一种描述或从左侧菜单进入。',
        );
        runtime.audit({
          args: { ...args },
          ms: performance.now() - started,
          result: 'error',
          route: ctx.route,
          tool: 'navigate_to',
          traceId: result.traceId,
        });
        return result;
      }

      const navigation = await runtime.navigate(intent);
      const result = outcome<{ routeName: string }>(
        navigation.ok,
        navigation.message,
        {
          routeName: intent.routeName,
        },
      );
      runtime.audit({
        args: { ...args },
        ms: performance.now() - started,
        result: navigation.ok ? 'success' : 'error',
        route: ctx.route,
        tool: 'navigate_to',
        traceId: result.traceId,
      });
      return result;
    },
  });
}

function createConfirmAction(runtime: ToolRuntime) {
  return defineTool<
    { title: string; impact: string; risks?: string[] },
    ToolOutcome<undefined>
  >({
    name: 'confirm_action',
    description:
      '危险操作的 Human-in-the-loop 网关：只返回确认卡片，不执行写操作；必须人工确认后由调用方提交。',
    parameters: {
      ...JSON_OBJECT_SCHEMA,
      properties: {
        title: { type: 'string', description: '操作标题' },
        impact: { type: 'string', description: '影响范围' },
        risks: {
          type: 'array',
          items: { type: 'string' },
          description: '风险提示',
        },
      },
      required: ['title', 'impact'],
    },
    async execute(args) {
      const ctx = runtime.context();
      const result = outcome(
        false,
        '此操作需要人工确认，尚未执行。',
        undefined,
        {
          defaultAction: 'cancel',
          impact: args.impact,
          risks: args.risks ?? [],
          title: args.title,
        },
      );
      runtime.audit({
        args: pickArgs(args, ['title', 'impact']),
        ms: 0,
        result: 'cancelled',
        route: ctx.route,
        tool: 'confirm_action',
        traceId: result.traceId,
      });
      return result;
    },
  });
}

/** 创建工具集。每次调用返回独立实例，避免跨会话状态串线。 */
export function createAiTools(runtime: ToolRuntime): AiTools {
  const searchTable = createSearchTable(runtime);
  const generateForm = createGenerateForm(runtime);
  const fillFormFields = createFillFormFields(runtime);
  const navigateTo = createNavigateTo(runtime);
  const confirmAction = createConfirmAction(runtime);
  return {
    all: [searchTable, generateForm, fillFormFields, navigateTo, confirmAction],
    confirmAction,
    fillFormFields,
    generateForm,
    navigateTo,
    searchTable,
  };
}
