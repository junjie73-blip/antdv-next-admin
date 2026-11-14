import { describe, expect, it } from 'vitest';

import {
  createExpressionEvaluator,
  defaultEvaluator,
  evaluateExpression,
  GraphExpressionError,
  resolveTemplate,
  tokenize,
} from '../src/expression';

describe('graph/expression · 词法', () => {
  it('拆出标识符 / 数字 / 字符串 / 运算符', () => {
    expect(
      tokenize("amount > 100 && status == 'ok'").map((token) => token.value),
    ).toStrictEqual(['amount', '>', '100', '&&', 'status', '==', 'ok']);
  });

  it('支持中文标识符（表单字段名直接写中文是常态）', () => {
    expect(tokenize('金额 >= 1000').map((token) => token.value)).toStrictEqual([
      '金额',
      '>=',
      '1000',
    ]);
  });

  it('赋值与箭头函数在词法层就被拒', () => {
    expect(() => tokenize('a = 1')).toThrow(GraphExpressionError);
    expect(() => tokenize('x => 1')).toThrow(/箭头函数/u);
  });

  it('字符串不闭合在词法层就报，语法残缺要到解析层才报', () => {
    expect(() => tokenize("'abc")).toThrow(/没有闭合/u);
    expect(() => evaluateExpression('1 +')).toThrow(/意外结束/u);
  });
});

describe('graph/expression · 求值', () => {
  it('优先级与括号：先乘除后加减', () => {
    expect(evaluateExpression('1 + 2 * 3')).toBe(7);
    expect(evaluateExpression('(1 + 2) * 3')).toBe(9);
    expect(evaluateExpression('10 % 4')).toBe(2);
    expect(evaluateExpression('-5 + 3')).toBe(-2);
  });

  it('条件分支的三种典型写法', () => {
    const ctx = { amount: 5000, level: 3, status: 'pending' };
    expect(evaluateExpression('amount > 1000 && level >= 2', ctx)).toBe(true);
    expect(evaluateExpression("status == 'approved' || level > 5", ctx)).toBe(
      false,
    );
    expect(evaluateExpression("amount > 1000 ? 'high' : 'low'", ctx)).toBe(
      'high',
    );
  });

  it('右侧短路：不安全的成员访问根本不会求值', () => {
    expect(evaluateExpression('x != null && x.len > 3', { x: null })).toBe(
      false,
    );
    // 左边已经成立时右边照旧执行，别把 || 也短路成"永远不看右边"
    expect(evaluateExpression('x == null || x.len > 3', { x: null })).toBe(
      true,
    );
  });

  it('成员与下标访问走上下文对象', () => {
    const ctx = {
      list: [10, 20],
      user: { dept: { name: '研发' } },
      extra: { 'two words': 2 },
    };
    expect(evaluateExpression('user.dept.name', ctx)).toBe('研发');
    expect(evaluateExpression('list[1]', ctx)).toBe(20);
    expect(evaluateExpression("extra['two words']", ctx)).toBe(2);
    // 路径断裂返回 undefined，而不是抛错打断整条流程
    expect(evaluateExpression('user.none.name', ctx)).toBeUndefined();
  });

  it('原型链逃逸读不出来', () => {
    expect(evaluateExpression('a.__proto__', { a: {} })).toBeUndefined();
    expect(evaluateExpression('a.constructor.name', { a: {} })).toBeUndefined();
    expect(evaluateExpression("a['constructor']", { a: {} })).toBeUndefined();
  });

  it('未声明的标识符按 undefined 处理', () => {
    expect(evaluateExpression('neverSet == null')).toBe(true);
  });

  it('+ 两侧都是数字才做算术，否则拼接', () => {
    expect(evaluateExpression('1 + 2')).toBe(3);
    expect(evaluateExpression("'1' + 2")).toBe('12');
  });

  it('松比较收敛：null 等于 undefined，但空串不等于 0', () => {
    expect(evaluateExpression('a == b', { a: null, b: undefined })).toBe(true);
    expect(evaluateExpression("a == '1'", { a: 1 })).toBe(true);
    expect(evaluateExpression('a == 0', { a: '' })).toBe(false);
    expect(evaluateExpression('a === b', { a: '1', b: 1 })).toBe(false);
  });

  it('内置函数覆盖字符串 / 集合 / 数值判断', () => {
    expect(evaluateExpression("upper('abc')")).toBe('ABC');
    expect(
      evaluateExpression("contains(tags, 'vip')", { tags: ['vip', 'new'] }),
    ).toBe(true);
    expect(
      evaluateExpression("coalesce(a, b, 'fallback')", { a: '', b: null }),
    ).toBe('fallback');
    expect(evaluateExpression('isEmpty(list)', { list: [] })).toBe(true);
    expect(evaluateExpression('len(name)', { name: 'abcd' })).toBe(4);
    expect(evaluateExpression('min(3, 1, 2)')).toBe(1);
    expect(Number.isNaN(evaluateExpression("number('abc')") as number)).toBe(
      true,
    );
  });

  it('未知函数是错误而不是静默 undefined', () => {
    expect(() => evaluateExpression('nope(1)')).toThrow(/未知函数/u);
  });
});

describe('graph/expression · 求值器实例', () => {
  it('实例级注册函数，互不污染', () => {
    const mine = createExpressionEvaluator();
    mine.register('is_admin', (role) => role === 'admin');
    expect(mine.evaluate('is_admin(role)', { role: 'admin' })).toBe(true);
    // 默认单例没有这个函数 —— 一个模块注册的东西不该让另一个模块的条件语义跟着变
    expect(() =>
      evaluateExpression('is_admin(role)', { role: 'admin' }),
    ).toThrow(/未知函数/u);
  });

  it('构造时传入的函数表覆盖同名内置', () => {
    const custom = createExpressionEvaluator({ functions: { len: () => 42 } });
    expect(custom.evaluate('len(x)')).toBe(42);
  });

  it('compile 一次、反复求值', () => {
    const compiled = defaultEvaluator.compile('score >= pass');
    expect(compiled.test({ pass: 60, score: 59 })).toBe(false);
    expect(compiled.test({ pass: 60, score: 60 })).toBe(true);
    expect(compiled.source).toBe('score >= pass');
  });

  it('模板插值：命中取值、未命中为空、?? 给兜底', () => {
    expect(
      resolveTemplate('Hi {{ user.name }}!', { user: { name: '张三' } }),
    ).toBe('Hi 张三!');
    expect(resolveTemplate('[{{ missing.path }}]', {})).toBe('[]');
    expect(resolveTemplate("{{ dept ?? '未分配' }}", {})).toBe('未分配');
    expect(resolveTemplate('{{ dept ?? count }}', { count: 3 })).toBe('3');
    expect(resolveTemplate('{{ a }}-{{ b }}', { a: 1, b: 2 })).toBe('1-2');
  });

  it('对象值走 JSON，循环引用不炸', () => {
    expect(resolveTemplate('{{ node }}', { node: { id: 'a' } })).toBe(
      '{"id":"a"}',
    );
    const cyclic: Record<string, unknown> = { id: 'x' };
    cyclic.self = cyclic;
    expect(resolveTemplate('{{ node }}', { node: cyclic })).toBe('[object]');
  });

  it('表达式来自用户输入：语法错误抛带原文的 GraphExpressionError', () => {
    try {
      evaluateExpression('a >');
      expect.unreachable('应当抛出语法错误');
    } catch (error) {
      expect(error).toBeInstanceOf(GraphExpressionError);
      expect((error as Error).name).toBe('GraphExpressionError');
    }
  });
});
