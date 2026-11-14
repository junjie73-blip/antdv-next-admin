import { describe, expect, it } from 'vitest';

import {
  AI_AGENTS,
  createDefinition,
  paginate,
  selectResources,
  selectWorkflowDefinitions,
  summarizeWorkflowDefinitions,
  summarizeWorkflowInstances,
  WORKFLOW_DEFINITIONS,
  WORKFLOW_INSTANCES,
  WORKFLOW_STORE,
} from '../server/utils/db/enterprise';
import {
  CAPTCHA_LOG_DB,
  CLIENT_LOG_DB,
  CONFIG_DEFAULTS,
  CONFIG_PANELS,
  FIELD_LABELS,
  formatRecordValue,
  generateCaptchaLogs,
  generateClientLogs,
  healthOf,
  MONITOR_SNAPSHOT,
  RECORD_MODULES,
} from '../server/utils/db/monitor';

describe('paginate：分页参数归一化', () => {
  const items = Array.from({ length: 25 }, (_, index) => index);

  it('正常分页切出正确区间', () => {
    expect(paginate(items, 2, 10)).toEqual({
      list: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
      pageNum: 2,
      pageSize: 10,
      total: 25,
    });
  });

  it('非法页码、负数、非数字一律回落到第一页', () => {
    expect(paginate(items, 0, 10).pageNum).toBe(1);
    expect(paginate(items, -3, 10).pageNum).toBe(1);
    expect(paginate(items, 'abc', 10).pageNum).toBe(1);
    expect(paginate(items, undefined, 0).pageSize).toBe(10);
  });

  it('超大 pageSize 被夹到 200，越界页返回空列表', () => {
    expect(paginate(items, 1, 10_000).pageSize).toBe(200);
    expect(paginate(items, 99, 10).list).toEqual([]);
  });
});

describe('selectWorkflowDefinitions：筛选与排序', () => {
  it('按状态 / 分类 / 负责人 / 关键字组合筛选', () => {
    const result = selectWorkflowDefinitions(WORKFLOW_DEFINITIONS, {
      category: '智能服务',
      owner: '赵宁',
      status: 'published',
    });
    expect(result.map((item) => item.name)).toEqual(['工单分类与升级']);
  });

  it('关键字命中名称、分类、负责人与描述，不区分大小写', () => {
    expect(
      selectWorkflowDefinitions(WORKFLOW_DEFINITIONS, { keyword: '发票' }).map(
        (i) => i.name,
      ),
    ).toEqual(['发票验真与归档']);
    expect(
      selectWorkflowDefinitions(WORKFLOW_DEFINITIONS, { keyword: 'LEGAL' }),
    ).toEqual([]);
    expect(
      selectWorkflowDefinitions(WORKFLOW_DEFINITIONS, { keyword: '张敏' }),
    ).toHaveLength(3);
  });

  it('名称升序与运行次数排序生效，且不修改原数组', () => {
    const byName = selectWorkflowDefinitions(WORKFLOW_DEFINITIONS, {
      sort: 'name',
    });
    expect(
      byName[0]!.name.localeCompare(byName[1]!.name, 'zh-CN'),
    ).toBeLessThanOrEqual(0);
    const byRuns = selectWorkflowDefinitions(WORKFLOW_DEFINITIONS, {
      sort: 'runs',
    });
    expect(byRuns[0]!.runCount).toBeGreaterThanOrEqual(byRuns[1]!.runCount);
    expect(WORKFLOW_DEFINITIONS[0]!.name).toBe('智能客服自动化');
  });
});

describe('流程与实例统计', () => {
  it('定义统计三态数量之和等于总数', () => {
    const summary = summarizeWorkflowDefinitions(WORKFLOW_DEFINITIONS);
    expect(summary.total).toBe(12);
    expect(summary.published + summary.draft + summary.disabled).toBe(
      summary.total,
    );
  });

  it('实例成功率按一位小数计算', () => {
    const summary = summarizeWorkflowInstances(WORKFLOW_INSTANCES);
    expect(summary.total).toBe(8);
    expect(summary.successRate).toBe(37.5);
    expect(summary.unhandledAlerts).toBeGreaterThan(0);
  });

  it('空数据集不产生 NaN', () => {
    expect(summarizeWorkflowInstances([]).successRate).toBe(0);
  });
});

describe('aI 资源与流程定义工厂', () => {
  it('关键字与状态筛选命中资源', () => {
    expect(
      selectResources(AI_AGENTS, { status: 'draft' }).map((i) => i.name),
    ).toEqual(['合同审阅 Agent']);
    expect(
      selectResources(AI_AGENTS, { keyword: '客服' }).map((i) => i.name),
    ).toEqual(['客服回复 Agent']);
  });

  it('新建定义缺字段时走安全默认值', () => {
    const created = createDefinition({}, 'WF-NEW');
    expect(created.name).toBe('未命名流程');
    expect(created.status).toBe('draft');
    expect(created.nodeCount).toBe(0);
  });

  it('可变存储与只读基准数据互相隔离', () => {
    expect(WORKFLOW_STORE.items).not.toBe(WORKFLOW_DEFINITIONS);
    expect(WORKFLOW_STORE.items).toHaveLength(WORKFLOW_DEFINITIONS.length);
  });
});

describe('系统监控数据集', () => {
  it('健康评分分档正确', () => {
    expect(healthOf(95).label).toBe('运行正常');
    expect(healthOf(75).label).toBe('需要关注');
    expect(healthOf(40).label).toBe('存在风险');
  });

  it('监控快照四档资源与阈值语义齐备', () => {
    expect(MONITOR_SNAPSHOT.resources.map((item) => item.tone)).toEqual([
      'success',
      'warning',
      'error',
      'info',
    ]);
    expect(MONITOR_SNAPSHOT.processes.length).toBeGreaterThan(0);
  });

  it('日志生成是确定性的，两次调用结果一致', () => {
    expect(generateClientLogs(10)).toEqual(CLIENT_LOG_DB.slice(0, 10));
    expect(generateCaptchaLogs(10)).toEqual(CAPTCHA_LOG_DB.slice(0, 10));
    expect(CLIENT_LOG_DB).toHaveLength(88);
    expect(CAPTCHA_LOG_DB).toHaveLength(88);
  });
});

describe('系统配置与详情分组', () => {
  it('七个面板，字段 key 在面板内唯一且都有默认值', () => {
    expect(CONFIG_PANELS).toHaveLength(7);
    for (const panel of CONFIG_PANELS) {
      const keys = panel.fields.map((field) => field.key);
      expect(new Set(keys).size).toBe(keys.length);
      for (const key of keys) {
        expect(CONFIG_DEFAULTS[panel.key]).toHaveProperty(key);
      }
    }
  });

  it('十个详情模块都有分组与图标，字段标签字典非空', () => {
    expect(Object.keys(RECORD_MODULES).length).toBeGreaterThanOrEqual(10);
    for (const meta of Object.values(RECORD_MODULES)) {
      expect(meta.icon).toMatch(/^carbon:/);
      expect(meta.sections.length).toBeGreaterThan(0);
    }
    expect(FIELD_LABELS.username).toBe('登录账号');
  });

  it('值格式化不会出现 undefined / NaN / [object Object]', () => {
    expect(formatRecordValue(undefined)).toBe('-');
    expect(formatRecordValue(['a', 'b'])).toBe('a、b');
    expect(formatRecordValue(true)).toBe('是');
  });
});
