/**
 * 纯推理函数：自然语言 → 结构化意图。
 *
 * 这一层刻意保持「弱模型」：只做字段字典约束下的关键词匹配，不生成任意字段名、
 * 不拼路由 path。真实模型接入后可在适配层替换本层，但契约不变。
 */
import type {
  AiContextSnapshot,
  AiFieldDescriptor,
  AiLinkDescriptor,
  FilterSpec,
  JsonSchemaObject,
  NavigateIntent,
  SortSpec,
  TableQuery,
} from './types';

const STATUS_WORDS: Record<string, string[]> = {
  failed: ['失败', '异常', '错误', 'failed', 'error'],
  success: ['成功', '完成', 'success', 'succeeded'],
  running: ['运行中', '执行中', 'running'],
  waiting: ['等待', '待处理', 'waiting', 'pending'],
  terminated: ['终止', '已终止', 'terminated'],
};

const SORT_WORDS: Array<{
  words: string[];
  fieldHints: string[];
  order: SortSpec['order'];
}> = [
  {
    words: ['耗时最长', '最慢', '耗时排序', '用时最长'],
    fieldHints: ['duration', 'cost', 'elapsed', '耗时'],
    order: 'desc',
  },
  {
    words: ['最新', '最近', '按时间倒序'],
    fieldHints: ['startTime', 'createdAt', 'time', '时间'],
    order: 'desc',
  },
  {
    words: ['最早', '从旧到新'],
    fieldHints: ['startTime', 'createdAt', 'time', '时间'],
    order: 'asc',
  },
];

/** 匹配字段：label 命中优先，其次 key 命中；字典外的字段一律不认 */
function findField(
  fields: AiFieldDescriptor[],
  hints: string[],
): AiFieldDescriptor | undefined {
  const lower = hints.map((item) => item.toLowerCase());
  return (
    fields.find((field) =>
      lower.some((hint) => field.label.toLowerCase().includes(hint)),
    ) ??
    fields.find((field) =>
      lower.some((hint) => field.key.toLowerCase().includes(hint)),
    )
  );
}

function collectLimit(text: string): number | undefined {
  const match =
    text.match(/(?:前|top)\s*(\d{1,3})\s*(?:个|条|项)?/i) ??
    text.match(/(\d{1,3})\s*(?:个|条|项)/u);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? Math.min(value, 100) : undefined;
}

/** 中文标签允许「实例名称」被「名称」命中；两字片段是可接受的最小语义单位 */
function labelMatches(text: string, label: string): boolean {
  if (!label) return false;
  if (text.includes(label)) return true;
  for (let index = 0; index < label.length - 1; index += 1) {
    if (text.includes(label.slice(index, index + 2))) return true;
  }
  return false;
}

/**
 * 自然语言 → 表格筛选/排序。
 * 未声明字段字典时返回空条件，让调用方提示「当前页未提供字段上下文」。
 */
export function parseTableQuery(
  utterance: string,
  fields: AiFieldDescriptor[] = [],
): TableQuery {
  const text = utterance.trim();
  const filters: FilterSpec[] = [];
  const sorts: SortSpec[] = [];
  if (!text || fields.length === 0) {
    return { filters, sorts, limit: collectLimit(text) };
  }

  const statusField = findField(fields, ['status', '状态', '执行状态']);
  if (statusField) {
    for (const [value, words] of Object.entries(STATUS_WORDS)) {
      if (!words.some((word) => text.toLowerCase().includes(word))) continue;
      const option = statusField.options?.find((item) =>
        words.some((word) => String(item.label).toLowerCase().includes(word)),
      );
      filters.push({
        field: statusField.key,
        op: 'eq',
        value: option?.value ?? value,
      });
      break;
    }
  }

  // 字段字典里显式声明的枚举值优先于状态词表，避免误判业务状态
  for (const field of fields) {
    if (!field.options?.length) continue;
    const hit = field.options.find(
      (option) =>
        String(option.label).length > 1 &&
        text.includes(String(option.label)) &&
        !filters.some((filter) => filter.field === field.key),
    );
    if (hit) filters.push({ field: field.key, op: 'eq', value: hit.value });
  }

  for (const rule of SORT_WORDS) {
    if (!rule.words.some((word) => text.includes(word))) continue;
    const field = findField(fields, rule.fieldHints);
    if (field) sorts.push({ field: field.key, order: rule.order });
    break;
  }

  return { filters, sorts, limit: collectLimit(text) };
}

/** 去重：同字段后写覆盖前写 */
export function dedupeFilters(filters: FilterSpec[]): FilterSpec[] {
  const map = new Map<string, FilterSpec>();
  for (const filter of filters) map.set(filter.field, filter);
  return [...map.values()];
}

function componentOf(type: string, enumValues?: unknown[]): string {
  if (enumValues?.length) return 'Select';
  if (type === 'number') return 'InputNumber';
  if (type === 'boolean') return 'Switch';
  if (
    type === 'string' &&
    /描述|说明|备注|content|description|remark/i.test(type)
  )
    return 'InputTextArea';
  return 'Input';
}

/** 自然语言 → JSON Schema，字段只允许来自实体字段字典 */
export function inferFormSchema(
  description: string,
  fields: AiFieldDescriptor[],
  title = 'AI 生成表单',
): JsonSchemaObject {
  const text = description.trim();
  const selected = fields.filter((field) => {
    if (!text) return true;
    return (
      labelMatches(text, field.label) ||
      text.toLowerCase().includes(field.key.toLowerCase())
    );
  });
  const usable = selected.length > 0 ? selected : fields;
  const properties: JsonSchemaObject['properties'] = {};

  for (const field of usable) {
    properties[field.key] = {
      type: (field.type ?? 'string') as 'boolean' | 'number' | 'string',
      title: field.label,
      ...(field.options?.length
        ? { enum: field.options.map((item) => item.value) }
        : {}),
      component: componentOf(
        field.type ?? 'string',
        field.options?.map((item) => item.value),
      ),
    };
  }

  return {
    type: 'object',
    title,
    properties,
    required: usable
      .filter((field) => field.label.includes('名称'))
      .map((field) => field.key),
  };
}

export interface FillInput {
  fields: AiFieldDescriptor[];
  selectedRows?: Record<string, unknown>[];
  routeParams?: Record<string, string>;
  description?: string;
  /** 低于该置信度的值不自动回填 */
  minConfidence?: number;
}

export interface FillResult {
  values: Record<string, unknown>;
  skipped: string[];
  confidence: Record<string, number>;
}

/**
 * Smart Fill：选中行 > 路由参数 > 用户描述，低置信度留空交给人工。
 * 不做网络请求，不写任何状态。
 */
export function inferFormValues(input: FillInput): FillResult {
  const threshold = input.minConfidence ?? 0.7;
  const row = input.selectedRows?.[0];
  const values: Record<string, unknown> = {};
  const confidence: Record<string, number> = {};
  const skipped: string[] = [];
  const text = input.description ?? '';

  for (const field of input.fields) {
    const fromRow = row?.[field.key];
    if (fromRow !== undefined && fromRow !== null && fromRow !== '') {
      values[field.key] = fromRow;
      confidence[field.key] = 1;
      continue;
    }
    const fromParam = input.routeParams?.[field.key];
    if (fromParam) {
      values[field.key] = fromParam;
      confidence[field.key] = 0.9;
      continue;
    }
    const quoted = text.match(
      new RegExp(`${escapeRegExp(field.label)}[:：]\\s*([^,，;；。]+)`, 'u'),
    );
    if (quoted?.[1]) {
      values[field.key] = quoted[1].trim();
      confidence[field.key] = 0.6;
      continue;
    }
    skipped.push(field.key);
  }

  // 回填后统一按阈值再过滤一次，保证低置信度值不落到表单
  for (const key of Object.keys(values)) {
    if ((confidence[key] ?? 0) < threshold) {
      delete values[key];
      if (!skipped.includes(key)) skipped.push(key);
    }
  }

  return { values, skipped, confidence };
}

function escapeRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

/** 受控路由匹配：只在 meta.aiContext.links 声明过的目标里选 */
export function matchNavigation(
  utterance: string,
  links: AiLinkDescriptor[],
): NavigateIntent | undefined {
  const text = utterance.trim().toLowerCase();
  if (!text) return undefined;
  let best: undefined | { score: number; link: AiLinkDescriptor };

  for (const link of links) {
    const candidates = [link.intent, link.name]
      .filter(Boolean)
      .map((item) => item.toLowerCase());
    const score = candidates.reduce(
      (sum, candidate) =>
        sum +
        candidate
          .split(/[\s/·-]+/u)
          .filter((word) => word.length > 1 && text.includes(word)).length,
      0,
    );
    if (score > 0 && (!best || score > best.score)) best = { score, link };
  }

  return best
    ? { routeName: best.link.routeName, query: { from: 'copilot' } }
    : undefined;
}

/** 指代消解：「它们 / 这些 / 当前行」→ 选中行；无选中行返回空数组 */
export function resolveSelection(
  utterance: string,
  snapshot: AiContextSnapshot,
): Record<string, unknown>[] {
  const hasReference = /(它们|这些|这条|当前(行|选中)|selected|它)/iu.test(
    utterance,
  );
  if (!hasReference) return [];
  return snapshot.selectedRows ?? [];
}
