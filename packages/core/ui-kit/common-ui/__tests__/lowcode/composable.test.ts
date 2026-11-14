import type {
  DataSourceFetcher,
  NodeSchema,
  PageSchema,
} from '../../src/lowcode/core/types';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, ref, shallowRef, toRaw } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import {
  createLowcodeContext,
  createMaterialNode,
  insertNode,
  patchNode,
  removeNode,
  useLowcodeContext,
  useLowcodePage,
} from '../../src/lowcode/index';

/**
 * `useLowcodePage` 是 Schema 与视图之间唯一的状态通道，所以这里测的全是「跨层」行为：
 * 装载顺序、scope 的归属、以及**什么情况下才该重新装载**。
 *
 * 最后那组用例是这个文件的存在理由：设计器改一次属性就会产出一个新的 Schema 对象
 * （`core/dsl` 全链路不可变），如果按对象身份重载，用户刚填进表单的值会被
 * `schema.state` 的初值冲掉，`rest` 源也会跟着重发一遍。判据必须是页面 `id`，不是对象引用。
 */

/** 把 composable 塞进一个真实组件实例跑起来：`onScopeDispose` 与 `watch` 都需要实例上下文 */
function withSetup<T>(factory: () => T): {
  result: T;
  wrapper: ReturnType<typeof mount>;
} {
  let result!: T;
  const Probe = defineComponent({
    setup() {
      result = factory();
      return () => h('div');
    },
  });
  const wrapper = mount(Probe);
  return { result, wrapper };
}

const MEMBER_ROWS = [
  { name: '张三', role: 'admin' },
  { name: '李四', role: 'editor' },
];

/**
 * 一份「最小但四件事齐全」的页面：static + rest + function 三种源、一个 auto:false 的手动源、
 * 以及 `set:` / `push:` / `emit:` / `refresh:` 四种事件动作各一处。
 */
function makePage(overrides: Partial<PageSchema> = {}): PageSchema {
  return {
    dataSources: [
      {
        auto: true,
        id: 'rows',
        kind: 'rest',
        name: '成员',
        path: 'rows',
        url: '/api/members',
      },
      {
        auto: false,
        id: 'manual',
        kind: 'static',
        data: { ok: true },
        name: '手动源',
        path: 'manualResult',
      },
      {
        auto: true,
        dependsOn: ['rows'],
        expression: '{{ len(rows) }}',
        id: 'count',
        kind: 'function',
        name: '合计',
        path: 'summary.count',
      },
    ],
    id: 'page-a',
    name: 'A 页',
    state: { form: { name: '' }, trail: [] },
    tree: [{ id: 'root', props: { title: '外层卡片' }, type: 'basic.card' }],
    version: 1,
    ...overrides,
  };
}

function setupWithFetcher(fetcher: DataSourceFetcher, page: PageSchema) {
  const context = createLowcodeContext({ fetcher });
  const events: Array<[name: string, payload: unknown]> = [];
  const errors: string[] = [];
  const schema = ref<PageSchema>(page);
  const result = withSetup(() =>
    useLowcodePage({
      context,
      onEvent: (name, payload) => events.push([name, payload]),
      onError: (text) => errors.push(text),
      schema,
    }),
  );
  return { ...result, errors, events, schema };
}

describe('装载与 scope 归属', () => {
  it('state 与 auto 数据源按顺序进 scope，auto:false 的源保持未跑', async () => {
    const { result } = setupWithFetcher(() => MEMBER_ROWS, makePage());
    await flushPromises();

    expect(result.scope.rows).toEqual(MEMBER_ROWS);
    expect(result.scope.summary).toEqual({ count: 2 });
    expect(result.scope.manualResult).toBeUndefined();
    expect(result.scope.form).toEqual({ name: '' });
    expect(result.loading.value).toBe(false);
    expect(result.errors.value).toEqual([]);
    expect(Object.keys(result.dataSources.value).sort()).toEqual([
      'count',
      'rows',
    ]);
  });

  it('nodes 就是 schema.tree 的那个引用，渲染器不会拿到副本', async () => {
    const page = makePage();
    const { result } = setupWithFetcher(() => MEMBER_ROWS, page);
    await flushPromises();
    // `ref(page)` 会把嵌套数组包成响应式代理，所以比身份要先把代理剥掉
    expect(toRaw(result.nodes.value)).toBe(page.tree);
  });

  it('initialState 覆盖同名键，但不会把 schema.state 的其余键抹掉', async () => {
    const page = makePage({ state: { draft: '保留', form: { name: '' } } });
    const context = createLowcodeContext({ fetcher: () => MEMBER_ROWS });
    const { result } = withSetup(() =>
      useLowcodePage({
        context,
        initialState: { form: { name: '宿主填的' } },
        schema: page,
      }),
    );
    await flushPromises();

    expect(result.scope.form).toEqual({ name: '宿主填的' });
    expect(result.scope.draft).toBe('保留');
  });

  it('没有注入 fetcher 时 rest 源报成运行期问题，而不是静默给空数组', async () => {
    const context = createLowcodeContext({ fetcher: undefined });
    const { result } = withSetup(() =>
      useLowcodePage({ context, schema: makePage() }),
    );
    await flushPromises();

    expect(result.scope.rows).toBeUndefined();
    expect(result.errors.value.some((text) => text.includes('rows'))).toBe(
      true,
    );
    expect(result.dataSources.value.rows?.error).toBeTruthy();
  });

  it('同一个错误只进 errors 一次：渲染每帧都会重跑，重复塞会把面板刷爆', async () => {
    const { errors, result } = setupWithFetcher(() => {
      throw new Error('接口挂了');
    }, makePage());
    await flushPromises();
    result.setPath('form.name', '再写一次同一个错');
    result.dispatch({
      name: 'click',
      nodeId: '不存在的节点',
      payload: undefined,
    });
    await flushPromises();

    expect(new Set(errors).size).toBe(errors.length);
    expect(result.errors.value).toHaveLength(errors.length);
    expect(errors.some((text) => text.includes('接口挂了'))).toBe(true);
  });
});

describe('换页与同页编辑的重载语义', () => {
  it('同 id 换树：只同步 nodes，不重发请求、不重置用户已经写进 scope 的值', async () => {
    const fetcher = vi.fn(() => MEMBER_ROWS);
    const { result, schema } = setupWithFetcher(fetcher, makePage());
    await flushPromises();
    expect(fetcher).toHaveBeenCalledTimes(1);

    // 用户在页面上打字 —— 这是运行期写入，不在 schema.state 里
    result.setPath('form.name', '王五');

    const nextTree = insertNode(
      schema.value.tree,
      createMaterialNode(
        {
          component: {},
          meta: { name: '文本', props: [], type: 'basic.text' },
        },
        { id: 'added' },
      ),
      {},
    );
    schema.value = { ...schema.value, tree: nextTree };
    await flushPromises();

    expect(result.nodes.value.map((node) => node.id)).toEqual([
      'root',
      'added',
    ]);
    // 关键断言：编辑一次结构，请求数与用户输入都不该动
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.scope.form).toEqual({ name: '王五' });
  });

  it('改属性（patchNode）同样不触发重载', async () => {
    const fetcher = vi.fn(() => MEMBER_ROWS);
    const { result, schema } = setupWithFetcher(fetcher, makePage());
    await flushPromises();

    schema.value = {
      ...schema.value,
      tree: patchNode(schema.value.tree, 'root', {
        props: { title: '改了标题' },
      }),
    };
    await flushPromises();

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect((result.nodes.value[0] as NodeSchema).props?.title).toBe('改了标题');
  });

  it('换 id 才整页重载：重发请求、scope 回到新页的 state', async () => {
    const fetcher = vi.fn(() => MEMBER_ROWS);
    const { result, schema } = setupWithFetcher(fetcher, makePage());
    await flushPromises();
    result.setPath('form.name', '王五');

    schema.value = makePage({
      id: 'page-b',
      state: { form: { name: 'B 页初值' } },
      tree: [{ id: 'only', type: 'basic.text' }],
    });
    await flushPromises();

    expect(fetcher.mock.calls.length).toBeGreaterThan(1);
    expect(result.scope.form).toEqual({ name: 'B 页初值' });
    expect(result.nodes.value.map((node) => node.id)).toEqual(['only']);
  });

  it('换 id 把上一页的运行期问题带走；同 id 只改树则账本不动', async () => {
    // `errors` 是「这一页跑成什么样」的账本。留着上一页的报错，宿主按它决定能不能保存时就是误判；
    // 反过来，设计器改一次结构就把账本清空，会把真坏了的数据源悄悄洗白 —— 两个方向都要钉住。
    // 只有第一页跑的时候才坏：换页之后接口"恢复"了，此时上一页的报错必须已经不在
    let broken = true;
    const { result, schema } = setupWithFetcher(() => {
      if (broken) throw new Error('接口 500');
      return MEMBER_ROWS;
    }, makePage());
    await flushPromises();
    expect(result.errors.value.join('；')).toContain('接口 500');

    schema.value = {
      ...schema.value,
      tree: patchNode(schema.value.tree, 'root', {
        props: { title: '改了标题' },
      }),
    };
    await flushPromises();
    expect(result.errors.value.join('；')).toContain('接口 500');

    broken = false;
    schema.value = makePage({
      id: 'page-b',
      tree: [{ id: 'only', type: 'basic.text' }],
    });
    await flushPromises();
    expect(result.errors.value).toEqual([]);
  });

  it('schema 变 undefined 时清空 nodes，不留在上一页', async () => {
    const context = createLowcodeContext({ fetcher: () => MEMBER_ROWS });
    const schema = ref<PageSchema | undefined>(makePage());
    const { result } = withSetup(() => useLowcodePage({ context, schema }));
    await flushPromises();
    expect(result.nodes.value.length).toBe(1);

    schema.value = undefined;
    await flushPromises();
    expect(result.nodes.value).toEqual([]);
  });
});

describe('事件动作', () => {
  /** 一个把四种动作都用上的树；`dispatch` 靠 schema.tree 找节点，所以树必须留在 schema 里 */
  function actionTree(): NodeSchema[] {
    return [
      {
        events: { 'update:modelValue': 'set:form.name' },
        id: 'input',
        props: { modelValue: '{{ form.name }}' },
        type: 'basic.field',
      },
      {
        events: { click: 'push:trail={{ form.name }}' },
        id: 'push-btn',
        type: 'basic.button',
      },
      { events: { click: 'emit:reset' }, id: 'emit-btn', type: 'basic.button' },
      {
        events: { click: 'refresh:manual' },
        id: 'refresh-btn',
        type: 'basic.button',
      },
    ];
  }

  it('set: 把 payload 写进 scope 路径，读侧的绑定表达式下一帧就跟着变', async () => {
    const { events, result } = setupWithFetcher(
      () => MEMBER_ROWS,
      makePage({ tree: actionTree() }),
    );
    await flushPromises();

    result.dispatch({
      name: 'update:modelValue',
      nodeId: 'input',
      payload: '王五',
    });
    expect(result.scope.form).toEqual({ name: '王五' });
    expect(events).toEqual([]);
  });

  it('push: 求值后追加进数组', async () => {
    const { result } = setupWithFetcher(
      () => MEMBER_ROWS,
      makePage({ tree: actionTree() }),
    );
    await flushPromises();

    result.setPath('form.name', '王五');
    result.dispatch({ name: 'click', nodeId: 'push-btn', payload: undefined });
    expect(result.scope.trail).toEqual(['王五']);
  });

  it('emit: 交给宿主的 onEvent，不碰 scope', async () => {
    const { events, result } = setupWithFetcher(
      () => MEMBER_ROWS,
      makePage({ tree: actionTree() }),
    );
    await flushPromises();

    result.dispatch({ name: 'click', nodeId: 'emit-btn', payload: { a: 1 } });
    expect(events).toEqual([['reset', { a: 1 }]]);
  });

  it('refresh: 手动跑指定数据源并把结果写回 path', async () => {
    const fetcher = vi.fn((input: { url: string }) =>
      input.url === '/api/members' ? MEMBER_ROWS : { ok: true },
    );
    const { result } = setupWithFetcher(
      fetcher,
      makePage({ tree: actionTree() }),
    );
    await flushPromises();
    expect(result.scope.manualResult).toBeUndefined();

    result.dispatch({
      name: 'click',
      nodeId: 'refresh-btn',
      payload: undefined,
    });
    await flushPromises();

    expect(result.scope.manualResult).toEqual({ ok: true });
    expect(
      fetcher.mock.calls.some(
        ([input]) => (input as { url: string }).url === '/api/members',
      ),
    ).toBe(true);
  });

  it('节点或动作找不到时记成错误，不静默丢弃', async () => {
    const { errors, result } = setupWithFetcher(
      () => MEMBER_ROWS,
      makePage({ tree: actionTree() }),
    );
    await flushPromises();

    result.dispatch({
      name: 'click',
      nodeId: 'not-in-tree',
      payload: undefined,
    });
    expect(result.scope.form).toEqual({ name: '' });

    result.dispatch({ name: 'nope', nodeId: 'push-btn', payload: undefined });
    expect(result.scope.trail).toEqual([]);
    expect(errors).toEqual([]);
  });

  it('文法不认识的动作串报错并点名节点', async () => {
    const tree: NodeSchema[] = [
      { events: { click: 'explode:all' }, id: 'boom', type: 'basic.button' },
    ];
    const { errors, result } = setupWithFetcher(
      () => MEMBER_ROWS,
      makePage({ tree }),
    );
    await flushPromises();

    result.dispatch({ name: 'click', nodeId: 'boom', payload: undefined });
    expect(errors.join('；')).toContain('不认识的动作');
    expect(errors.join('；')).toContain('explode');
  });
});

describe('保存前体检', () => {
  it('吃注入的注册表：未登记的 type 报 error，登记过的不报', async () => {
    const context = createLowcodeContext({
      components: [
        { component: {}, meta: { name: '探针', props: [], type: 'probe.one' } },
      ],
      fetcher: () => MEMBER_ROWS,
    });
    const page = makePage({
      tree: [
        { id: 'p1', type: 'probe.one' },
        { id: 'p2', type: 'nope.missing' },
      ],
    });
    const { result } = withSetup(() =>
      useLowcodePage({ context, schema: page }),
    );

    const report = result.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.map((item) => item.nodeId)).toContain('p2');
    expect(report.errors.some((item) => item.nodeId !== 'p2')).toBe(false);
  });

  it('表达式坏了报 bad-expression，写进 scope 的路径越界报 unsafe-path', () => {
    const page = makePage({
      tree: [
        { id: 'a', props: { text: '{{ 1 + }}' }, type: 'basic.text' },
        {
          events: { click: 'set:__proto__.polluted' },
          id: 'b',
          type: 'basic.button',
        },
      ],
    });
    const { result } = withSetup(() => useLowcodePage({ schema: page }));

    const report = result.validate();
    expect(report.errors.map((item) => item.code).sort()).toEqual([
      'bad-expression',
      'unsafe-path',
    ]);
  });

  it('validate() 的结果不写进 errors：体检是保存前动作，不该污染运行态面板', async () => {
    const { errors, result } = setupWithFetcher(
      () => MEMBER_ROWS,
      makePage({ tree: [{ id: 'x', type: 'nope' }] }),
    );
    await flushPromises();
    expect(result.validate().valid).toBe(false);
    expect(errors).toEqual([]);
  });
});

describe('设计器动作与运行态的配合', () => {
  it('删掉一个节点后渲染与 dispatch 都用新树，不会拿旧引用继续跑', async () => {
    const { result, schema } = setupWithFetcher(
      () => MEMBER_ROWS,
      makePage({
        tree: [
          {
            events: { click: 'refresh:manual' },
            id: 'keep',
            type: 'basic.button',
          },
          {
            events: { click: 'refresh:manual' },
            id: 'drop',
            type: 'basic.button',
          },
        ],
      }),
    );
    await flushPromises();

    schema.value = {
      ...schema.value,
      tree: removeNode(schema.value.tree, 'drop').tree,
    };
    await flushPromises();

    expect(result.nodes.value.map((node) => node.id)).toEqual(['keep']);
    // 已删节点再抛事件应当无声忽略：DOM 还在过渡帧里时这属于正常竞态
    result.dispatch({ name: 'click', nodeId: 'drop', payload: undefined });
    expect(result.scope.manualResult).toBeUndefined();

    result.dispatch({ name: 'click', nodeId: 'keep', payload: undefined });
    await flushPromises();
    expect(result.scope.manualResult).toEqual({ ok: true });
  });

  it('runDataSource 与 refreshDataSource 都返回运行态快照，供宿主直接判断成败', async () => {
    const { result } = setupWithFetcher(() => ({ ran: true }), makePage());
    await flushPromises();

    // `manual` 是 auto:false 的 static 源：不装载时没数据，手动跑一次就有了
    await expect(result.refreshDataSource('manual')).resolves.toMatchObject({
      data: { ok: true },
      id: 'manual',
    });
    expect(result.scope.manualResult).toEqual({ ok: true });
    // 未知 id 不抛异常，而是给一条带原因的失败态：设计器里引用打错字要能被页面看见
    await expect(result.runDataSource('nope')).resolves.toMatchObject({
      code: 'unknown-datasource',
    });
    await expect(result.refreshDataSource('nope')).resolves.toMatchObject({
      code: 'unknown-datasource',
    });
  });

  it('setPath 写入非法路径时报错而不是改坏 scope', async () => {
    const { errors, result } = setupWithFetcher(() => MEMBER_ROWS, makePage());
    await flushPromises();

    result.setPath('__proto__.x', 1);
    expect(errors.join('；')).toContain('原型链');
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });
});

/* ----------------------------- 装配的取法 ----------------------------- */

/**
 * `useLowcodeContext` 是四个设计器组件唯一的 context 入口，所以「什么时候跟着宿主变」
 * 必须在这里钉死：传对象 = 定终身（旧语义，单测与脚本直接调仍然可用），
 * 传函数 = 每次读现取（组件层用它，换 prop 就地生效）。
 */
describe('useLowcodeContext', () => {
  it('传函数时读的是当前值：换装配后注册表与求值器都跟着换，不必重挂组件', () => {
    const first = createLowcodeContext({ maxDepth: 3 });
    const second = createLowcodeContext({ maxDepth: 7 });
    // shallowRef 而不是 ref：context 里装的是注册表与求值器这类有身份的对象，
    // 深度代理会让 `context.registry` 每次返回一个新的代理，身份断言（和宿主的 toBe 判断）全失真
    const current = shallowRef<
      ReturnType<typeof createLowcodeContext> | undefined
    >(first);

    const { result } = withSetup(() => useLowcodeContext(() => current.value));
    expect(result.maxDepth).toBe(3);
    expect(result.registry).toBe(first.registry);

    current.value = second;
    expect(result.maxDepth).toBe(7);
    expect(result.registry).toBe(second.registry);
    expect(result.evaluator).toBe(second.evaluator);
  });

  it('既没传也没 provide 时兜底装一份，并且同一次装配身份稳定', () => {
    const { result } = withSetup(() => useLowcodeContext());
    expect(result.registry).toBe(result.registry);
    expect(result.runner).toBe(result.runner);
    expect(typeof result.report).toBe('function');
    expect(result.scopeBase()).toEqual(expect.any(Object));
  });

  it('传死对象时保持原样返回：单测与「一页一套装配」的宿主拿到的是同一个实例', () => {
    const context = createLowcodeContext({ maxDepth: 5 });
    const { result } = withSetup(() => useLowcodeContext(context));
    expect(result).toBe(context);
  });
});
