import { describe, expect, it } from 'vitest';

import { paginate } from '../server/utils/db/enterprise';
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
