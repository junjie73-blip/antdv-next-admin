/**
 * 响应模板层（确定性）。
 *
 * Mock 数据中心的模板生成能力已下线：这里不再引入任何模板引擎，
 * 也不在请求里生成随机数据。预置模板是系统内置的确定性 JSON 配置，
 * `renderPreview` 只做合法性校验与安全序列化，原样返回样本。
 *
 * 接口路径与返回结构保持不变，供「兼容调用方式」红线守护。
 */

import type { MockTemplatePreset } from '@antdv/types';

/** 内置响应模板：纯 JSON 值，不含任何占位符或生成规则 */
export const PRESET_TEMPLATES: MockTemplatePreset[] = [
  {
    name: '分页列表',
    template: {
      list: [
        {
          id: 1,
          name: '示例记录一',
          status: 1,
          createTime: '2026-11-01 09:00:00',
        },
        {
          id: 2,
          name: '示例记录二',
          status: 0,
          createTime: '2026-11-01 09:05:00',
        },
        {
          id: 3,
          name: '示例记录三',
          status: 1,
          createTime: '2026-11-01 09:10:00',
        },
      ],
      total: 3,
    },
    key: '[GET]/demo/page-list',
    title: '演示分页列表',
  },
  {
    name: '统计概览',
    template: {
      today: 128,
      week: 896,
      growth: 12,
      online: 36,
    },
    key: '[GET]/demo/statistics',
    title: '演示统计概览',
  },
  {
    name: '树形结构',
    template: {
      items: [
        {
          id: 'node-1',
          label: '一级',
          children: [{ id: 'node-1-1', label: '子节点' }],
        },
        { id: 'node-2', label: '二级', children: [] },
        { id: 'node-3', label: '三级', children: [] },
      ],
    },
    key: '[GET]/demo/tree',
    title: '演示树形数据',
  },
  {
    name: '中文名单',
    template: {
      rows: [
        {
          id: 1,
          name: '张伟',
          phone: '13800000001',
          address: '中关村大街 1 号',
        },
        {
          id: 2,
          name: '王芳',
          phone: '13800000002',
          address: '科技园南路 28 号',
        },
      ],
    },
    key: '[GET]/demo/names',
    title: '演示中文名单',
  },
];

/** 响应模板必须是 JSON 对象 / 数组，或可解析为该形态的字符串 */
export function parseTemplate(input: unknown): {
  error?: string;
  template?: Record<string, unknown>;
} {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return { template: input as Record<string, unknown> };
  }
  if (Array.isArray(input)) {
    return { template: { items: input } };
  }
  if (typeof input !== 'string' || input.trim().length === 0) {
    return { error: '响应模板不能为空' };
  }
  try {
    const parsed: unknown = JSON.parse(input);
    if (parsed === null || typeof parsed !== 'object') {
      return { error: '响应模板需为 JSON 对象或数组' };
    }
    return {
      template: Array.isArray(parsed)
        ? { items: parsed }
        : (parsed as Record<string, unknown>),
    };
  } catch {
    return { error: '响应模板不是合法 JSON，请检查引号与逗号' };
  }
}

/** 校验并安全序列化样本：不生成任何数据，仅回显解析结果 */
export function renderPreview(
  input: unknown,
): { error: string } | { sample: unknown } {
  const parsed = parseTemplate(input);
  if (parsed.error) return { error: parsed.error };
  try {
    return { sample: JSON.parse(JSON.stringify(parsed.template!)) };
  } catch (error: unknown) {
    return {
      error: `模板序列化失败：${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
