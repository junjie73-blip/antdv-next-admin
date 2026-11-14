import { describe, expect, it } from 'vitest';

import {
  displayValue,
  formatCount,
  levelTone,
  maskReceiver,
  resultTone,
  unwrapApi,
} from '../log-format';

/** 日志与详情页共用的纯函数：happy path + 边界 + 非法输入三条路径都要过 */
describe('levelTone', () => {
  it('四种级别映射到对应语义色', () => {
    expect(levelTone('error')).toBe('error');
    expect(levelTone('warn')).toBe('warning');
    expect(levelTone('info')).toBe('info');
    expect(levelTone('debug')).toBe('neutral');
  });

  it('未知级别回退到中性，不抛异常', () => {
    expect(levelTone('trace')).toBe('neutral');
    expect(levelTone('')).toBe('neutral');
  });
});

describe('resultTone', () => {
  it('兼容 passed/success/1 三套成功取值', () => {
    expect(resultTone('passed')).toBe('success');
    expect(resultTone('success')).toBe('success');
    expect(resultTone(1)).toBe('success');
  });

  it('兼容 failed/fail/0 三套失败取值', () => {
    expect(resultTone('failed')).toBe('error');
    expect(resultTone('fail')).toBe('error');
    expect(resultTone(0)).toBe('error');
  });

  it('其它取值不做语义着色', () => {
    expect(resultTone('unknown')).toBe('neutral');
    expect(resultTone(2)).toBe('neutral');
  });
});

describe('maskReceiver', () => {
  it('手机号保留前 3 后 4', () => {
    expect(maskReceiver('13812345678')).toBe('138****5678');
  });

  it('邮箱保留用户名前两位与完整域名', () => {
    expect(maskReceiver('zhangsan@example.com')).toBe('zh***@example.com');
    expect(maskReceiver('a@example.com')).toBe('a***@example.com');
  });

  it('已脱敏、空值、普通字符串原样返回', () => {
    expect(maskReceiver('138****5678')).toBe('138****5678');
    expect(maskReceiver('')).toBe('');
    expect(maskReceiver('10.0.0.1')).toBe('10.0.0.1');
  });
});

describe('formatCount', () => {
  it('正常数字按中文千分位输出', () => {
    expect(formatCount(18_642)).toBe('18,642');
    expect(formatCount(0)).toBe('0');
  });

  it('非法值统一回退成 -，界面不出现 NaN', () => {
    expect(formatCount(undefined)).toBe('-');
    expect(formatCount('abc')).toBe('-');
    expect(formatCount(null)).toBe('0');
  });
});

describe('unwrapApi：请求层信封适配', () => {
  it('统一信封取 data', () => {
    expect(
      unwrapApi<{ list: number[] }>({
        code: 200,
        data: { list: [1, 2] },
        message: 'ok',
      }),
    ).toEqual({ list: [1, 2] });
  });

  it('已解包的业务数据原样返回', () => {
    expect(unwrapApi<{ total: number }>({ total: 8 })).toEqual({ total: 8 });
  });

  it('null / undefined 安全回退', () => {
    expect(unwrapApi<null>(null)).toBeNull();
    expect(unwrapApi<undefined>(undefined)).toBeUndefined();
  });
});

describe('displayValue', () => {
  it('空值、数组、布尔、对象都收敛成可读文本', () => {
    expect(displayValue(undefined)).toBe('-');
    expect(displayValue('')).toBe('-');
    expect(displayValue(['管理员', '运维'])).toBe('管理员、运维');
    expect(displayValue([])).toBe('-');
    expect(displayValue(true)).toBe('是');
    expect(displayValue(false)).toBe('否');
    expect(displayValue({ a: 1 })).toBe('{"a":1}');
  });

  it('数字与字符串原样呈现', () => {
    expect(displayValue(0)).toBe('0');
    expect(displayValue('正常')).toBe('正常');
  });
});
