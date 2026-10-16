import { describe, expect, it, vi } from 'vitest';

import {
  getDynamicRules,
  getShow,
  setComponentProps,
} from '../src/components/form-render/helper';
import {
  deepMerge,
  formatDateFields,
  handleRangeValue,
} from '../src/components/form-render/utils';
import { runRule } from '../src/rule-registry';

describe('helper/setComponentProps', () => {
  it('为 Input 自动生成 placeholder 与 allowClear', () => {
    const props = setComponentProps(
      { field: 'name', label: '用户名', component: 'Input' } as any,
      {},
      null,
    );
    expect(props.placeholder).toBe('请输入用户名');
    expect(props.allowClear).toBe(true);
  });

  it('Select 使用"请选择"模板，RangePicker 带"范围"后缀', () => {
    const select = setComponentProps(
      { field: 'a', label: '状态', component: 'Select' } as any,
      {},
      null,
    );
    expect(select.placeholder).toBe('请选择状态');
    const range = setComponentProps(
      { field: 'b', label: '日期', component: 'RangePicker' } as any,
      {},
      null,
    );
    expect(range.placeholder).toBe('请选择日期范围');
  });

  it('显式 placeholder 不被覆盖', () => {
    const props = setComponentProps(
      {
        field: 'name',
        label: '用户名',
        component: 'Input',
        componentProps: { placeholder: '自定义' },
      } as any,
      {},
      null,
    );
    expect(props.placeholder).toBe('自定义');
  });

  it('componentProps 函数形态接收 values 与 field', () => {
    const spy = vi.fn(() => ({ x: 1 }));
    const schema = {
      field: 'name',
      label: '用户名',
      component: 'Input',
      componentProps: spy,
    } as any;
    const result = setComponentProps(schema, { name: 'abc' }, null);
    expect(result).toEqual({ x: 1 });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ field: 'name', values: { name: 'abc' } }),
    );
  });

  it('Rate 不在自动 allowClear 名单', () => {
    const props = setComponentProps(
      { field: 'r', label: '评分', component: 'Rate' } as any,
      {},
      null,
    );
    expect(props.allowClear).toBeUndefined();
  });
});

describe('helper/getShow', () => {
  it('默认显示', () => {
    expect(getShow({ field: 'a' } as any, {}, null)).toEqual({
      ifShow: true,
      show: true,
    });
  });

  it('ifShow 函数依赖表单值（参与 v-if），show 参与 v-show', () => {
    const schema = {
      field: 'a',
      ifShow: ({ values }: any) => values.type === '1',
      show: ({ values }: any) => !values.hidden,
    } as any;
    expect(getShow(schema, { hidden: true, type: '1' }, null)).toEqual({
      ifShow: true,
      show: false,
    });
    expect(getShow(schema, { hidden: false, type: '2' }, null)).toEqual({
      ifShow: false,
      show: true,
    });
  });

  it('schema 为空视为不渲染', () => {
    expect(getShow(undefined, {}, null)).toEqual({
      ifShow: false,
      show: false,
    });
  });
});

describe('helper/getDynamicRules', () => {
  it('required 便捷字段自动补充必填规则', () => {
    const rules = getDynamicRules(
      { field: 'name', label: '用户名', required: true } as any,
      {},
      null,
    );
    expect(rules).toHaveLength(1);
    expect(rules![0]).toMatchObject({
      required: true,
      message: '该项为必填项',
    });
  });

  it('rulesMessageJoinLabel 让默认消息带上 label', () => {
    const rules = getDynamicRules(
      {
        field: 'name',
        label: '用户名',
        required: true,
        rulesMessageJoinLabel: true,
      } as any,
      {},
      null,
    );
    expect(rules![0]!.message).toBe('用户名不能为空');
  });

  it('dynamicRules 函数优先于 rules', () => {
    const rules = getDynamicRules(
      {
        field: 'a',
        rules: [{ required: false }],
        dynamicRules: () => [{ required: true, message: '动态必填' }],
      } as any,
      {},
      null,
    );
    expect(rules).toEqual([{ required: true, message: '动态必填' }]);
  });

  it('跳过 pattern 非法的规则并告警', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const rules = getDynamicRules(
      {
        field: 'a',
        rules: [
          { pattern: 123 as any, message: '坏' },
          { pattern: /^[a-z]+$/, message: '好' },
        ],
      } as any,
      {},
      null,
    );
    expect(rules).toHaveLength(1);
    warn.mockRestore();
  });
});

describe('helper/handleRangeValue', () => {
  it('默认按字符串格式化拆分并删除源字段', () => {
    const result = handleRangeValue({ time: ['2024-01-01', '2024-01-31'] }, [
      ['time', ['startTime', 'endTime']],
    ]);
    expect(result.startTime).toBe('2024-01-01');
    expect(result.endTime).toBe('2024-01-31');
    expect(result.time).toBeUndefined();
  });

  it('timestamp 模式输出秒级时间戳', () => {
    const result = handleRangeValue({ time: ['2024-01-01', '2024-01-02'] }, [
      ['time', ['start', 'end'], 'timestamp'],
    ]);
    expect(result.start).toBe(new Date('2024-01-01').getTime() / 1000);
    expect(result.end).toBe(new Date('2024-01-02').getTime() / 1000);
  });
});

describe('helper/formatDateFields', () => {
  it('dayjs 形态的值按 valueFormat 序列化', () => {
    const fakeDayjs = { format: (f: string) => `formatted:${f}` };
    const result = formatDateFields({ created: fakeDayjs }, [
      {
        field: 'created',
        component: 'DatePicker',
        componentProps: { valueFormat: 'YYYY-MM-DD' },
      },
    ] as any);
    expect(result.created).toBe('formatted:YYYY-MM-DD');
  });

  it('RangePicker 字段跳过转换（与旧实现一致）', () => {
    const fakeDayjs = { format: () => 'X' };
    const result = formatDateFields({ range: [fakeDayjs, fakeDayjs] }, [
      { field: 'range', component: 'RangePicker' },
    ] as any);
    expect(result.range[0]).toBe(fakeDayjs);
  });
});

describe('helper/deepMerge', () => {
  it('数组冲突保留目标而不是拼接（防 schemas 翻倍）', () => {
    const merged = deepMerge({ schemas: [1, 2, 3] }, { schemas: [4] } as any);
    expect(merged.schemas).toEqual([1, 2, 3]);
    const fromEmpty = deepMerge({} as any, { schemas: [4] });
    expect(fromEmpty.schemas).toEqual([4]);
  });

  it('源 undefined 忽略、目标优先于源的非对象冲突', () => {
    const merged = deepMerge({ a: 1, b: 2 }, {
      a: undefined,
      b: 3,
      c: 4,
    } as any);
    expect(merged).toEqual({ a: 1, b: 2, c: 4 });
  });
});

describe('rules/runRule', () => {
  it('必填：空值报错，非必填空值跳过后续规则', async () => {
    expect(await runRule({ required: true }, '', { label: '名称' })).toBe(
      '该项为必填项',
    );
    expect(
      await runRule({ required: true }, '', { joinLabel: true, label: '名称' }),
    ).toBe('名称不能为空');
    expect(
      await runRule({ type: 'email' }, '', { label: '邮箱' }),
    ).toBeUndefined();
  });

  it('whitespace 必填拒绝纯空格', async () => {
    expect(
      await runRule({ required: true, whitespace: true }, '   ', {
        label: '名称',
      }),
    ).toBeTruthy();
  });

  it('type=email / number 校验', async () => {
    expect(await runRule({ type: 'email' }, 'bad', { label: '邮箱' })).toBe(
      '邮箱类型不正确',
    );
    expect(await runRule({ type: 'number' }, 'abc', { label: '数量' })).toBe(
      '数量类型不正确',
    );
    expect(
      await runRule({ type: 'number' }, '1.5', { label: '数量' }),
    ).toBeUndefined();
  });

  it('pattern / min / max / len', async () => {
    expect(
      await runRule({ pattern: /^[a-z]+$/ }, 'ABC', { label: '代码' }),
    ).toBeTruthy();
    expect(await runRule({ min: 5 }, 'abc', { label: '密码' })).toBeTruthy();
    expect(await runRule({ max: 2 }, 'abc', { label: '密码' })).toBeTruthy();
    expect(await runRule({ len: 11 }, '123', { label: '手机号' })).toBeTruthy();
    expect(await runRule({ max: 10 }, 8, { label: '年龄' })).toBeUndefined();
  });

  it('validator 支持 reject 与 callback 两种风格', async () => {
    expect(
      await runRule(
        {
          validator: () => Promise.reject(new Error('自定义错误')),
        },
        'x',
        { label: '字段' },
      ),
    ).toBe('自定义错误');

    expect(
      await runRule(
        {
          validator: (_rule: any, _v: any, cb: any) => cb('回调错误'),
        },
        'x',
        { label: '字段' },
      ),
    ).toBe('回调错误');

    expect(
      await runRule({ validator: () => Promise.resolve() }, 'x', {
        label: '字段',
      }),
    ).toBeUndefined();
  });

  it('空值也要跑自定义 validator（antd async-validator 语义）', async () => {
    expect(
      await runRule(
        {
          validator: (_rule: any, value: any) =>
            value === 'agree'
              ? Promise.resolve()
              : Promise.reject(new Error('需要先同意《用户服务协议》')),
        },
        '',
        { label: '服务协议' },
      ),
    ).toBe('需要先同意《用户服务协议》');

    expect(
      await runRule(
        {
          validator: (_rule: any, value: any, cb: any) =>
            value ? cb() : cb('未选择'),
        },
        undefined,
        { label: '协议' },
      ),
    ).toBe('未选择');
  });

  it('transform 先行执行', async () => {
    expect(
      await runRule(
        { required: true, transform: (v: any) => String(v).trim() },
        '   ',
        { label: '字段' },
      ),
    ).toBeTruthy();
  });
});
