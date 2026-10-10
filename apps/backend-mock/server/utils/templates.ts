/**
 * mockjs 模板层
 *
 * 承载 legacy /mock-center/templates 的预置模板与 /mock-center/preview 的渲染逻辑。
 * 面板生成的自定义接口命中时（server/middleware/generated.ts）同样用 mockFromTemplate 编译。
 */

import type {
  GeneratedRouteDefinition,
  MockTemplatePreset,
} from '@antdv/types';

import Mock from 'mockjs';

/** 预置模板：与 legacy mock-center.fake.ts 的 PRESET_TEMPLATES 一一对应 */
export const PRESET_TEMPLATES: MockTemplatePreset[] = [
  {
    name: '分页列表',
    template: {
      'list|10': [
        {
          'id|+1': 1,
          email: '@email',
          name: '@cname',
          'status|1': [0, 1],
          createTime: '@datetime("yyyy-MM-dd HH:mm:ss")',
        },
      ],
      // mockjs 的自增规则只有 `|+1` 生效，且只在数组重复规则里累加；
      // 标量位置写 `|+100` 会被整条忽略，这里直接给固定总数
      total: 100,
    },
    key: '[GET]/demo/page-list',
    title: '演示分页列表',
  },
  {
    name: '统计概览',
    template: {
      'today|100-999': 1,
      'week|1000-9999': 1,
      'growth|-20-50': 1,
      'online|10-200': 1,
    },
    key: '[GET]/demo/statistics',
    title: '演示统计概览',
  },
  {
    name: '树形结构',
    template: {
      'items|3': [
        {
          id: '@guid',
          'label|1': ['一级', '二级', '三级'],
          'children|0-2': [{ id: '@guid', label: '子节点' }],
        },
      ],
    },
    key: '[GET]/demo/tree',
    title: '演示树形数据',
  },
  {
    name: '中文名单',
    template: {
      'rows|20': [
        {
          'id|+1': 1,
          name: '@cname',
          phone: '@integer(13000000000, 13999999999)',
          address: '@county(true)',
        },
      ],
    },
    key: '[GET]/demo/names',
    title: '演示中文名单',
  },
];

/** 用 mockjs 模板生成数据，支持 `'list|10': [...]` 这类语法 */
export function mockFromTemplate(
  template: GeneratedRouteDefinition['template'],
): unknown {
  return Mock.mock(template);
}

/** 模板必须是 JSON 对象 / 数组文本，mockjs 语法写在字符串值里 */
export function parseTemplate(input: unknown): {
  error?: string;
  template?: GeneratedRouteDefinition['template'];
} {
  if (input && typeof input === 'object')
    return { template: input as GeneratedRouteDefinition['template'] };
  if (typeof input !== 'string' || input.trim().length === 0)
    return { error: '响应模板不能为空' };
  try {
    const parsed: unknown = JSON.parse(input);
    if (parsed === null || typeof parsed !== 'object')
      return { error: '响应模板需为 JSON 对象或数组' };
    return { template: parsed as GeneratedRouteDefinition['template'] };
  } catch {
    return { error: '响应模板不是合法 JSON，请检查引号与逗号' };
  }
}

/** 渲染一次模板并序列化为可 JSON 展示的样本，预览与保存前校验共用 */
export function renderPreview(
  input: unknown,
): { error: string } | { sample: unknown } {
  const parsed = parseTemplate(input);
  if (parsed.error) return { error: parsed.error };
  try {
    return {
      sample: JSON.parse(JSON.stringify(mockFromTemplate(parsed.template!))),
    };
  } catch (error: unknown) {
    return {
      error: `模板渲染失败：${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
