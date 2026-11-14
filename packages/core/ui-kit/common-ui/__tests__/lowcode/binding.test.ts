import type { NodeSchema } from '../../src/lowcode/core/types';

import { createExpressionEvaluator } from '@antdv/graph';
import { describe, expect, it } from 'vitest';

import {
  applyEventAction,
  bareExpression,
  deletePath,
  evalCondition,
  getPath,
  isBindingString,
  LowCodeBindingError,
  mergeContext,
  mergePath,
  parseEventAction,
  parsePath,
  pushPath,
  referencedKeys,
  resolveProps,
  resolveValue,
  setPath,
  twoWayBindingsOf,
  unsafePathMessage,
} from '../../src/lowcode/index';

/**
 * 绑定层的测试重点只有一个：**类型**。
 * 低代码里 90% 的诡异 bug 都来自「本该是数字的值变成了字符串」，
 * 所以每个断言都写清期望的 JS 类型，而不是只比字符串。
 */

describe('路径解析', () => {
  it('a.b[0].c 拆成段，带引号的键与数字下标都支持', () => {
    expect(parsePath('a.b[0].c')).toEqual(['a', 'b', 0, 'c']);
    expect(parsePath("list['x-1'].name")).toEqual(['list', 'x-1', 'name']);
    expect(parsePath('')).toEqual([]);
    expect(parsePath(3)).toEqual([3]);
    expect(parsePath(['a', 0, 'b'])).toEqual(['a', 0, 'b']);
  });

  it('括号没闭合或空括号是配置错误，直接抛', () => {
    expect(() => parsePath('a[0')).toThrowError(LowCodeBindingError);
    expect(() => parsePath('a[]')).toThrowError(/空的/);
  });

  it('原型链段只在这里留下可读的原因，是否拦下由调用方决定', () => {
    expect(unsafePathMessage('a.__proto__.b')).toContain('禁止写入原型链属性');
    expect(unsafePathMessage('a.constructor')).toContain('constructor');
    expect(unsafePathMessage(['a', 'prototype', 'b'])).toContain('prototype');
    expect(unsafePathMessage('a.b[0]')).toBeUndefined();
  });
});

describe('getPath / setPath', () => {
  it('写入时自动补中间层：下一段是数字就建数组，否则建对象', () => {
    const scope: Record<string, unknown> = {};
    setPath(scope, 'form.tags[0].name', '标签');
    expect(scope).toEqual({ form: { tags: [{ name: '标签' }] } });
  });

  it('数组越界写先补齐长度，不留语义不清的空洞', () => {
    const scope: Record<string, unknown> = { list: ['a'] };
    setPath(scope, 'list[3]', 'd');
    expect(scope.list).toEqual(['a', undefined, undefined, 'd']);
    setPath(scope, 'list[0]', 'A');
    expect(scope.list).toEqual(['A', undefined, undefined, 'd']);
  });

  it('中间层已经是标量时报错而不是悄悄覆盖掉用户数据', () => {
    const scope: Record<string, unknown> = { a: 1 };
    expect(() => setPath(scope, 'a.b', 2)).toThrowError(/已经是number/);
    expect(scope.a).toBe(1);
  });

  it('读：缺路径给兜底值，原型链段读当作没值', () => {
    const scope = { a: { b: [{ c: 7 }] }, list: [1, 2] };
    expect(getPath(scope, 'a.b[0].c')).toBe(7);
    expect(getPath(scope, 'a.b[9].c', '兜底')).toBe('兜底');
    expect(getPath(scope, '__proto__')).toBeUndefined();
    expect(getPath(scope, 'list.length', 0)).toBe(2);
  });

  it('写原型链一律拦下：这是本包唯一的安全边界', () => {
    const scope: Record<string, unknown> = {};
    for (const path of [
      '__proto__.polluted',
      'a.constructor.x',
      'a.prototype.y',
    ]) {
      expect(() => setPath(scope, path, 1)).toThrowError(/原型链/);
    }
    expect({}.hasOwnProperty('polluted')).toBe(false);
  });

  it('空路径无法写入', () => {
    expect(() => setPath({}, '', 1)).toThrowError(/路径为空/);
  });

  it('deletePath 对数组走 splice，不留洞', () => {
    const scope: Record<string, unknown> = {
      list: [1, 2, 3],
      obj: { a: 1, b: 2 },
    };
    expect(deletePath(scope, 'list[1]')).toBe(true);
    expect(scope.list).toEqual([1, 3]);
    expect(deletePath(scope, 'obj.a')).toBe(true);
    expect(scope.obj).toEqual({ b: 2 });
    expect(deletePath(scope, 'obj.nope')).toBe(false);
    expect(deletePath(scope, 'list[9]')).toBe(false);
  });

  it('pushPath / mergePath 是表单与筛选器最常见的两种写', () => {
    const scope: Record<string, unknown> = {
      filter: { size: 'm' },
      list: ['a'],
    };
    pushPath(scope, 'list', 'b');
    pushPath(scope, 'fresh', '第一');
    mergePath(scope, 'filter', { page: 2, size: 'l' });
    expect(scope.list).toEqual(['a', 'b']);
    expect(scope.fresh).toEqual(['第一']);
    expect(scope.filter).toEqual({ page: 2, size: 'l' });
  });
});

describe('值解释', () => {
  const evaluator = createExpressionEvaluator();
  const options = { evaluator };

  it('整段是一个 {{ }} 时保留原始类型', () => {
    const scope = { count: 41, flag: true, nested: { list: [1, 2, 3] } };
    expect(resolveValue('{{ count + 1 }}', scope, options)).toBe(42);
    expect(resolveValue('{{ flag }}', scope, options)).toBe(true);
    expect(resolveValue('{{ nested.list }}', scope, options)).toEqual([
      1, 2, 3,
    ]);
    expect(resolveValue('{{ nope }}', scope, options)).toBeUndefined();
  });

  it('混合文本走插值，结果一定是字符串', () => {
    const scope = { name: '张三', count: 2 };
    expect(
      resolveValue('你好 {{ name }}，共 {{ count }} 项', scope, options),
    ).toBe('你好 张三，共 2 项');
    expect(resolveValue('{{ name }}', scope, options)).toBe('张三');
  });

  it('{{ a ?? 兜底 }} 保留类型，并且空串/空数组也算空', () => {
    const scope = { empty: '', list: [], num: 5, text: 'hi' };
    expect(resolveValue('{{ empty ?? 0 }}', scope, options)).toBe(0);
    expect(resolveValue('{{ missing ?? 3 }}', scope, options)).toBe(3);
    expect(resolveValue('{{ num ?? 3 }}', scope, options)).toBe(5);
    expect(resolveValue("{{ missing ?? '没有' }}", scope, options)).toBe(
      '没有',
    );
    expect(resolveValue('{{ text ?? 3 }}', scope, options)).toBe('hi');
  });

  it('数组与对象里的绑定串递归解释', () => {
    const scope = {
      id: 9,
      rows: [{ title: '{{ id }}' }],
      cols: ['{{ id }}', '固定'],
    };
    expect(
      resolveValue(
        { cols: ['{{ id }}', '固定'], rows: [{ title: '{{ id }}' }] },
        scope,
        options,
      ),
    ).toEqual({
      cols: [9, '固定'],
      rows: [{ title: 9 }],
    });
  });

  it('静态值原样穿过，不做多余拷贝以外的处理', () => {
    const scope = {};
    const columns = [{ key: 'name', title: '名称' }];
    expect(resolveValue(columns, scope, options)).toEqual(columns);
    expect(isBindingString('{{ a }}')).toBe(true);
    expect(isBindingString('普通文本')).toBe(false);
  });

  it('resolveProps 把整个 props 表解释一遍，键序不变', () => {
    const node: NodeSchema = {
      id: 'n',
      props: { count: '{{ n }}', label: '第 {{ n }} 个' },
      type: 'basic.text',
    };
    const props = resolveProps(node, { n: 3 }, options);
    expect(props).toEqual({ count: 3, label: '第 3 个' });
  });

  it('求值失败交给 onError，而不是把异常抛穿渲染', () => {
    const seen: string[] = [];
    expect(
      resolveValue(
        '{{ 1 + }}',
        {},
        { evaluator, onError: (message) => seen.push(message) },
      ),
    ).toBeUndefined();
    expect(seen.length).toBeGreaterThan(0);
    // 不接 onError 时保持抛出的语义：配置错误在开发期就该炸出来
    expect(() => resolveValue('{{ 1 + }}', {}, { evaluator })).toThrowError();
  });
});

describe('evalCondition', () => {
  const evaluator = createExpressionEvaluator();
  const scope = { count: 3, form: { name: '' }, tags: ['a'] };

  it('没写条件就是可见；裸表达式与 {{ }} 两种写法等价', () => {
    expect(evalCondition(undefined, scope)).toBe(true);
    expect(evalCondition('   ', scope)).toBe(true);
    expect(evalCondition('count > 1', scope, { evaluator })).toBe(true);
    expect(evalCondition('{{ count > 1 }}', scope, { evaluator })).toBe(true);
    expect(evalCondition('form.name', scope, { evaluator })).toBe(false);
    expect(evalCondition('{{ tags }}', scope, { evaluator })).toBe(true);
  });

  it('表达式坏了按不可见处理，并把原因与出处一起交出去', () => {
    // onError 的签名是 `(原因, 裸表达式)`：组合成人话是调用方的活（渲染器写成「表达式「x」求值失败：…」），
    // 这里只断言两块素材都在，避免把措辞和实现绑死。
    const seen: Array<[string, string]> = [];
    expect(
      evalCondition('{{ count >>> 1 }}', scope, {
        evaluator,
        onError: (message, source) => seen.push([message, source]),
      }),
    ).toBe(false);
    expect(seen).toHaveLength(1);
    expect(seen[0]![1]).toBe('count >>> 1');
    expect(seen[0]![0].length).toBeGreaterThan(0);
  });
});

describe('事件动作文法', () => {
  it('七种动作都能解析，包括 set:path=expr', () => {
    expect(parseEventAction('set:form.name')).toMatchObject({
      arg: 'form.name',
      kind: 'set',
    });
    expect(parseEventAction('set:total={{ amount * 2 }}')).toMatchObject({
      arg: 'total',
      expression: 'amount * 2',
      kind: 'set',
    });
    expect(parseEventAction('push:list')).toMatchObject({ kind: 'push' });
    expect(parseEventAction('merge:filter')).toMatchObject({ kind: 'merge' });
    expect(parseEventAction('remove:list[1]')).toMatchObject({
      arg: 'list[1]',
      kind: 'remove',
    });
    expect(parseEventAction('refresh:users')).toMatchObject({
      arg: 'users',
      kind: 'refresh',
    });
    expect(parseEventAction('emit:submit')).toMatchObject({
      arg: 'submit',
      kind: 'emit',
    });
    expect(parseEventAction('evaluate:log(len(form.name))')).toMatchObject({
      arg: 'log(len(form.name))',
      kind: 'evaluate',
    });
  });

  it('写错了给原因而不是抛：设计器要把这条动作显示出来', () => {
    expect(parseEventAction('').error).toContain('动作为空');
    expect(parseEventAction('form.name').error).toContain('缺少「前缀:」');
    expect(parseEventAction('teleport:x').error).toContain(
      '不认识的动作「teleport」',
    );
  });

  it('数据源表达式允许带花括号，剥壳只在求值点做', () => {
    expect(bareExpression('{{ len(list) }}')).toBe('len(list)');
    expect(bareExpression('len(list)')).toBe('len(list)');
    expect(bareExpression(undefined)).toBe('');
  });
});

describe('applyEventAction', () => {
  const evaluator = createExpressionEvaluator();

  it('set: 直接把事件入参写进路径', () => {
    const scope: Record<string, unknown> = { form: {} };
    const result = applyEventAction({
      action: parseEventAction('set:form.name'),
      payload: '张三',
      scope,
    });
    expect(scope.form).toEqual({ name: '张三' });
    expect(result).toMatchObject({ changed: true, path: 'form.name' });
  });

  it('set:path=expr 里能读到 $event / $payload 两个别名', () => {
    const scope: Record<string, unknown> = {};
    applyEventAction({
      action: parseEventAction('set:total={{ $event * 2 }}'),
      evaluator,
      payload: 21,
      scope,
    });
    expect(scope.total).toBe(42);
    applyEventAction({
      action: parseEventAction('set:echo={{ $payload }}'),
      evaluator,
      payload: '回显',
      scope,
    });
    expect(scope.echo).toBe('回显');
  });

  it('push / merge / remove 三种写各自生效', () => {
    const scope: Record<string, unknown> = {
      filter: { a: 1 },
      list: ['x'],
      gone: { b: 2 },
    };
    applyEventAction({
      action: parseEventAction('push:list'),
      payload: 'y',
      scope,
    });
    applyEventAction({
      action: parseEventAction('merge:filter'),
      payload: { c: 3 },
      scope,
    });
    applyEventAction({ action: parseEventAction('remove:gone.b'), scope });
    expect(scope.list).toEqual(['x', 'y']);
    expect(scope.filter).toEqual({ a: 1, c: 3 });
    expect(scope.gone).toEqual({});
  });

  it('refresh / emit 走接线回调；没接线时明确报错而不是静默丢弃', () => {
    const refreshed: string[] = [];
    const emitted: Array<[string, unknown]> = [];
    const scope: Record<string, unknown> = {};
    applyEventAction({
      action: parseEventAction('refresh:users'),
      onRefresh: (id) => refreshed.push(id),
      scope,
    });
    applyEventAction({
      action: parseEventAction('emit:submit'),
      onEmit: (name, payload) => emitted.push([name, payload]),
      payload: 1,
      scope,
    });
    expect(refreshed).toEqual(['users']);
    expect(emitted).toEqual([['submit', 1]]);
    expect(
      applyEventAction({ action: parseEventAction('refresh:users'), scope })
        .error,
    ).toContain('没有接线');
    expect(
      applyEventAction({ action: parseEventAction('emit:x'), scope }).error,
    ).toContain('onEmit');
  });

  it('坏动作与写原型链的动作都不执行，并给出原因', () => {
    const scope: Record<string, unknown> = { keep: 1 };
    const bad = applyEventAction({
      action: parseEventAction('teleport:x'),
      scope,
    });
    expect(bad.changed).toBe(false);
    expect(bad.error).toContain('不认识的动作');
    expect(
      applyEventAction({
        action: parseEventAction('set:__proto__.polluted'),
        payload: 1,
        scope,
      }).error,
    ).toContain('原型链');
    expect(scope).toEqual({ keep: 1 });
  });

  it('宿主变量在动作表达式里可读，但 scope 同名键优先', () => {
    const scope: Record<string, unknown> = { who: '页面' };
    applyEventAction({
      action: parseEventAction('set:greet={{ who }}'),
      ctx: { who: '宿主' },
      evaluator,
      scope,
    });
    expect(scope.greet).toBe('页面');
    // 装配规则单独断言，别把上面刚写进去的 greet 也算进来
    expect(
      mergeContext({ who: '页面' }, { tenant: 'T1', who: '宿主' }),
    ).toEqual({ tenant: 'T1', who: '页面' });
  });

  it('路径本身非法时收敛成 error', () => {
    expect(
      applyEventAction({ action: parseEventAction('set:'), scope: {} }).error,
    ).toContain('缺少目标路径');
  });
});

describe('双向绑定识别', () => {
  it('props 里的 {{ path }} 与 events 里的 set:path 指向同一路径即成对', () => {
    const node: NodeSchema = {
      events: { 'update:modelValue': 'set:form.name' },
      id: 'n',
      props: { modelValue: '{{ form.name }}', placeholder: '姓名' },
      type: 'basic.input',
    };
    expect(twoWayBindingsOf(node)).toEqual([
      { event: 'update:modelValue', path: 'form.name', prop: 'modelValue' },
    ]);
  });

  it('元数据明确声明 twoWay:false 的事件不配对，避免把「点击行」当成绑定', () => {
    const node: NodeSchema = {
      events: { click: 'set:form.name' },
      id: 'n',
      props: { modelValue: '{{ form.name }}' },
      type: 'basic.input',
    };
    expect(twoWayBindingsOf(node)).toHaveLength(1);
    const meta = { name: '输入', props: [], type: 'basic.input' };
    expect(
      twoWayBindingsOf(node, {
        ...meta,
        events: [{ name: 'click', twoWay: false }],
      }),
    ).toEqual([]);
  });

  it('部分插值的 props 不算双向：那是显示文案', () => {
    const node: NodeSchema = {
      events: { 'update:modelValue': 'set:form.name' },
      id: 'n',
      props: { modelValue: '前缀-{{ form.name }}' },
      type: 'basic.input',
    };
    expect(twoWayBindingsOf(node)).toEqual([]);
  });

  it('referencedKeys 抽出表达式里出现的标识符（排序去重），供面板提示依赖', () => {
    expect(referencedKeys('你好 {{ user.name }}，共 {{ count }} 项')).toEqual([
      'count',
      'name',
      'user',
    ]);
    expect(referencedKeys('{{ a > b ? c : d }}')).toEqual(['a', 'b', 'c', 'd']);
    expect(referencedKeys('{{ len(list) }} 与 {{ list }}')).toEqual([
      'len',
      'list',
    ]);
  });
});
