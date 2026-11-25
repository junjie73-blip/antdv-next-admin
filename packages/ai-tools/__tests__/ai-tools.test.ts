import { describe, expect, it } from 'vitest';

import {
  createAiTools,
  dedupeFilters,
  inferFormSchema,
  inferFormValues,
  matchNavigation,
  parseTableQuery,
  resolveSelection,
} from '../src/index';
import type { AiContextSnapshot, ToolRuntime } from '../src/index';

const fields = [
  { key: 'status', label: '执行状态', options: [
    { label: '失败', value: 'failed' },
    { label: '成功', value: 'success' },
  ] },
  { key: 'duration', label: '耗时', type: 'number' as const },
  { key: 'name', label: '实例名称' },
];

const baseContext: AiContextSnapshot = {
  route: 'ApprovalMine',
  title: '我的审批',
  entity: 'approval',
  fields,
  tools: ['search_table', 'generate_form', 'fill_form_fields', 'navigate_to'],
  links: [{ name: '我的审批', intent: '我的审批', routeName: 'ApprovalMine' }],
  selectedRows: [{ id: 'AP-1', name: '采购申请' }],
};

function mockRuntime(overrides: Partial<ToolRuntime> = {}): ToolRuntime & {
  applied: unknown[];
  navigated: unknown[];
  opened: unknown[];
  filled: unknown[];
  audits: unknown[];
} {
  const state = { applied: [] as unknown[], navigated: [] as unknown[], opened: [] as unknown[], filled: [] as unknown[], audits: [] as unknown[] };
  return {
    ...state,
    context: () => baseContext,
    table: () => ({
      id: 'instances',
      applyQuery: (query: unknown) => { state.applied.push(query); },
    }),
    form: () => ({
      id: 'editor',
      open: (schema: unknown) => { state.opened.push(schema); },
      fill: (values: unknown) => { state.filled.push(values); },
    }),
    navigate: async (intent) => {
      state.navigated.push(intent);
      return { ok: true, message: '已跳转', traceId: 'nav_1' };
    },
    audit: (event) => { state.audits.push(event); },
    ...overrides,
  };
}

describe('parseTableQuery', () => {
  it('把中文状态词映射到字段字典里声明的枚举值', () => {
    const query = parseTableQuery('有哪些失败的实例', fields);
    expect(query.filters).toEqual([{ field: 'status', op: 'eq', value: 'failed' }]);
  });

  it('识别耗时最长与前 N 个', () => {
    const query = parseTableQuery('列出耗时最长的 3 个实例', fields);
    expect(query.sorts).toEqual([{ field: 'duration', order: 'desc' }]);
    expect(query.limit).toBe(3);
  });

  it('没有字段字典时不推断任何字段', () => {
    expect(parseTableQuery('失败的前 5 个', [])).toEqual({
      filters: [],
      sorts: [],
      limit: 5,
    });
  });

  it('字典外字段不会被生成', () => {
    const query = parseTableQuery('按金额排序且部门=财务', fields);
    expect(query.filters).toEqual([]);
    expect(query.sorts).toEqual([]);
  });
});

describe('schema 与 Smart Fill', () => {
  it('生成的 Schema 只包含声明字段且带组件名', () => {
    const schema = inferFormSchema('新建实例，名称与状态', fields);
    expect(Object.keys(schema.properties)).toEqual(['status', 'name']);
    expect(schema.properties.status?.component).toBe('Select');
    expect(schema.properties.name?.component).toBe('Input');
  });

  it('选中行优先，低置信度字段留空', () => {
    const result = inferFormValues({
      fields,
      selectedRows: [{ name: '合同审批' }],
      description: '耗时: 1200',
      minConfidence: 0.7,
    });
    expect(result.values.name).toBe('合同审批');
    expect(result.values.duration).toBeUndefined();
    expect(result.skipped).toContain('duration');
  });

  it('重复筛选按字段去重，保留最后值', () => {
    expect(
      dedupeFilters([
        { field: 'status', op: 'eq', value: 'failed' },
        { field: 'status', op: 'eq', value: 'success' },
      ]),
    ).toEqual([{ field: 'status', op: 'eq', value: 'success' }]);
  });
});

describe('路由与指代', () => {
  it('只在受控链接里匹配路由', () => {
    expect(matchNavigation('打开我的审批', baseContext.links!)).toMatchObject({
      routeName: 'ApprovalMine',
    });
    expect(matchNavigation('打开不存在的页面', baseContext.links!)).toBeUndefined();
  });

  it('有指代时才注入选中行', () => {
    expect(resolveSelection('处理这些单据', baseContext)).toEqual(baseContext.selectedRows);
    expect(resolveSelection('查看所有单据', baseContext)).toEqual([]);
  });
});

describe('createAiTools', () => {
  it('search_table 应用筛选并写审计', async () => {
    const runtime = mockRuntime();
    const tools = createAiTools(runtime);
    const result = await tools.searchTable.execute?.(
      { utterance: '有哪些失败的实例' },
      { signal: new AbortController().signal, toolCallId: 'c1' },
    ) as { ok: boolean; traceId: string };
    expect(result.ok).toBe(true);
    expect(runtime.applied).toEqual([
      { filters: [{ field: 'status', op: 'eq', value: 'failed' }], sorts: [], limit: undefined },
    ]);
    expect(runtime.audits).toHaveLength(1);
  });

  it('confirm_action 只返回确认卡片，不执行写操作', async () => {
    const runtime = mockRuntime();
    const tools = createAiTools(runtime);
    const result = await tools.confirmAction.execute?.(
      { title: '批量通过审批', impact: '3 张单据将被标记为通过' },
      { signal: new AbortController().signal, toolCallId: 'c2' },
    ) as { confirmation?: { defaultAction: string }; ok: boolean };
    expect(result.ok).toBe(false);
    expect(result.confirmation?.defaultAction).toBe('cancel');
    expect(runtime.navigated).toHaveLength(0);
  });

  it('navigate_to 走受控跳转', async () => {
    const runtime = mockRuntime();
    const tools = createAiTools(runtime);
    await tools.navigateTo.execute?.(
      { utterance: '去我的审批' },
      { signal: new AbortController().signal, toolCallId: 'c3' },
    );
    expect(runtime.navigated).toMatchObject([{ routeName: 'ApprovalMine' }]);
  });
});
