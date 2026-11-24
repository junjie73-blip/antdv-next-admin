import type { LowcodeContext } from '../../src/lowcode/config';
import type {
  ComponentMeta,
  MaterialEntry,
  NodeSchema,
} from '../../src/lowcode/core/types';

import { mount } from '@vue/test-utils';
import { defineComponent, h, markRaw } from 'vue';

import { describe, expect, it } from 'vitest';

import {
  createLowcodeContext,
  LOWCODE_DND_MIME,
  LowCodeInspector,
  LowCodeOutline,
  LowCodePalette,
  LowCodeRenderer,
  useLowcodeContext,
} from '../../src/lowcode/index';

/**
 * 组件层只验两件事：**渲染 + 回抛事件**。
 * 渲染器不许改 Schema、属性面板不许自己写 props、大纲不许自己存选中态 ——
 * 这四条一旦破功，宿主的撤销栈就会丢帧，所以每个"不许"都配一条断言。
 *
 * 求值、增删改的语义在 `binding.test.ts` 与 `dsl.test.ts` 里已经测透，这里不重复；
 * 装载与重载的语义在 `composable.test.ts`，也不在这里。
 */

/** 一个什么都不画、只把 props 透传成 data 属性的探针物料：断言值时不必猜控件的 DOM */
function probeMeta(overrides: Partial<ComponentMeta> = {}): ComponentMeta {
  return {
    container: true,
    name: '探针',
    props: [],
    type: 'probe.box',
    ...overrides,
  };
}

function probeEntry(meta: ComponentMeta = probeMeta()): MaterialEntry {
  // 组件用函数式写法，并且**必须有元素根**：文本根或 fragment 的组件接不住渲染器透传下来的
  // `data-node-id`（Vue 会警告并丢弃），设计器的点选钩子就没了 —— 真实物料都该是元素根
  return {
    component: {
      name: meta.type,
      props: Object.fromEntries(meta.props.map((prop) => [prop.key, {}])),
      setup: (props: any) => () =>
        h('div', { 'data-probe-text': props.text ?? '' }, props.text ?? ''),
    },
    meta,
  };
}

function ctx(entries: MaterialEntry[] = []): LowcodeContext {
  return createLowcodeContext({ components: entries });
}

/* -------------------------------- 渲染器 -------------------------------- */

describe('lowCodeRenderer', () => {
  it('把 `{{ }}` 绑定按 scope 求值成真实 props 再交给物料', () => {
    const nodes: NodeSchema[] = [
      {
        id: 'a',
        props: { text: '{{ form.name }}（{{ len(rows) }}）' },
        type: 'probe.box',
      },
    ];
    const entry = probeEntry(
      probeMeta({ props: [{ key: 'text', kind: 'string', label: '文本' }] }),
    );
    const wrapper = mount(LowCodeRenderer, {
      props: {
        context: ctx([entry]),
        nodes,
        scope: { form: { name: '张三' }, rows: [1, 2, 3] },
      },
    });

    expect(wrapper.text()).toBe('张三（3）');
  });

  it('condition 为假时整节点不渲染，为真时正常渲染', () => {
    const nodes: NodeSchema[] = [
      {
        condition: '{{ form.on }}',
        id: 'on',
        props: { text: '开' },
        type: 'probe.box',
      },
      {
        condition: '{{ !form.on }}',
        id: 'off',
        props: { text: '关' },
        type: 'probe.box',
      },
    ];
    const entry = probeEntry(
      probeMeta({ props: [{ key: 'text', kind: 'string', label: '文本' }] }),
    );
    const context = ctx([entry]);

    const on = mount(LowCodeRenderer, {
      props: { context, nodes, scope: { form: { on: true } } },
    });
    expect(on.text()).toBe('开');

    const off = mount(LowCodeRenderer, {
      props: { context, nodes, scope: { form: { on: false } } },
    });
    expect(off.text()).toBe('关');
  });

  it('未登记的 type 降级成可诊断占位并上报，而不是整页白屏', () => {
    const nodes: NodeSchema[] = [
      { id: 'bad', type: 'nope.missing' },
      { id: 'good', props: { text: '还在' }, type: 'probe.box' },
    ];
    const reported: Array<{ code: string; message: string }> = [];
    const context = createLowcodeContext({
      components: [
        probeEntry(
          probeMeta({
            props: [{ key: 'text', kind: 'string', label: '文本' }],
          }),
        ),
      ],
      report: (issue) =>
        reported.push({ code: issue.code, message: issue.message }),
    });
    const wrapper = mount(LowCodeRenderer, {
      props: { context, nodes, scope: {} },
    });

    expect(wrapper.find('[data-slot="lowcode-unknown"]').exists()).toBe(true);
    expect(
      wrapper.get('[data-slot="lowcode-unknown"]').attributes('data-type'),
    ).toBe('nope.missing');
    expect(wrapper.text()).toContain('还在');
    expect(reported.some((issue) => issue.code === 'unknown-type')).toBe(true);
  });

  it('同类的重复问题只上报一次：渲染每帧都跑，不然错误列表会被刷爆', () => {
    const nodes: NodeSchema[] = [
      { id: 'b1', type: 'nope' },
      { id: 'b2', type: 'nope' },
    ];
    const reported: string[] = [];
    const context = createLowcodeContext({
      report: (issue) => reported.push(issue.message),
    });
    mount(LowCodeRenderer, { props: { context, nodes, scope: {} } });

    expect(reported).toHaveLength(1);
  });

  it('children 走默认插槽、slots 按名字透传，容器套容器也照顺序渲染', () => {
    const nodes: NodeSchema[] = [
      {
        children: [{ id: 'c1', props: { text: 'A' }, type: 'probe.box' }],
        id: 'card',
        props: { title: '外层' },
        slots: {
          footer: [{ id: 'f1', props: { text: 'F' }, type: 'probe.box' }],
        },
        type: 'basic.card',
      },
    ];
    const wrapper = mount(LowCodeRenderer, {
      props: {
        context: ctx([
          probeEntry(
            probeMeta({
              props: [{ key: 'text', kind: 'string', label: '文本' }],
            }),
          ),
        ]),
        nodes,
        scope: {},
      },
    });

    expect(wrapper.text()).toContain('A');
    expect(wrapper.text()).toContain('F');
    expect(wrapper.text().indexOf('A')).toBeLessThan(
      wrapper.text().indexOf('F'),
    );
  });

  it('把物料事件原样抛成 `event`，不改 Schema、不自己解释动作', async () => {
    const nodes: NodeSchema[] = [
      {
        events: { one: 'noop', two: 'noop', zero: 'noop' },
        id: 'n',
        type: 'probe.echo',
      },
    ];
    const Echo = defineComponent({
      emits: { one: null, two: null, zero: null },
      setup(_props, { emit }) {
        return () =>
          h('div', [
            h('button', {
              class: 'fire-one',
              onClick: () => emit('one', '甲'),
            }),
            h('button', {
              class: 'fire-two',
              onClick: () => emit('two', 1, 2),
            }),
            h('button', { class: 'fire-zero', onClick: () => emit('zero') }),
          ]);
      },
    });
    const context = ctx([
      {
        component: markRaw(Echo),
        meta: probeMeta({ props: [], type: 'probe.echo' }),
      },
    ]);
    const wrapper = mount(LowCodeRenderer, {
      props: { context, nodes, scope: {} },
    });
    const before = JSON.stringify(nodes);

    await wrapper.get('.fire-one').trigger('click');
    await wrapper.get('.fire-two').trigger('click');
    await wrapper.get('.fire-zero').trigger('click');

    // 单参给值、多参给数组、无参给 undefined —— `set:` 与 `push:` 才接得住
    expect(wrapper.emitted('event')).toEqual([
      [{ name: 'one', nodeId: 'n', payload: '甲' }],
      [{ name: 'two', nodeId: 'n', payload: [1, 2] }],
      [{ name: 'zero', nodeId: 'n', payload: undefined }],
    ]);
    // 渲染器不许碰 Schema：抛完事件树还是原样
    expect(JSON.stringify(nodes)).toBe(before);
  });

  it('没在 `events` 里登记的事件不往外抛，抛出来的一律带节点 id', async () => {
    const nodes: NodeSchema[] = [
      { events: { one: 'noop' }, id: 'n', type: 'probe.echo' },
    ];
    const Echo = {
      emits: { other: null },
      setup(_props: unknown, { emit }: any) {
        return () =>
          h('button', {
            class: 'fire-other',
            onClick: () => emit('other', 'x'),
          });
      },
    };
    const context = ctx([
      { component: markRaw(Echo), meta: probeMeta({ type: 'probe.echo' }) },
    ]);
    const wrapper = mount(LowCodeRenderer, {
      props: { context, nodes, scope: {} },
    });

    await wrapper.get('.fire-other').trigger('click');
    expect(wrapper.emitted('event')).toBeUndefined();
  });
});

/* ------------------------------- 物料面板 ------------------------------- */

describe('lowCodePalette', () => {
  it('按登记顺序分组渲染，点一下抛 `{ entry, type }`', async () => {
    const wrapper = mount(LowCodePalette, {
      props: { context: ctx([probeEntry(probeMeta({ group: '探针组' }))]) },
    });

    const groups = wrapper.findAll('[data-slot="lowcode-palette-group"]');
    expect(groups.length).toBeGreaterThanOrEqual(1);
    expect(wrapper.text()).toContain('探针组');

    await wrapper.get('[data-material-type="probe.box"]').trigger('click');
    const picked = wrapper.emitted('pick')?.[0]?.[0] as {
      entry: MaterialEntry;
      type: string;
    };
    expect(picked.type).toBe('probe.box');
    expect(picked.entry.meta.name).toBe('探针');
  });

  it('内置搜索框按名称/type/分组过滤；关掉后就没有搜索框', async () => {
    const entries = [
      probeEntry(probeMeta({ name: '文本框', type: 'probe.text' })),
      probeEntry(probeMeta({ name: '开关', type: 'probe.switch' })),
    ];
    // 这里只看过滤逻辑，所以关掉 basic 预设，面板里就只有这两条
    const context = createLowcodeContext({
      components: entries,
      useBuiltinMaterials: false,
    });
    const wrapper = mount(LowCodePalette, { props: { context } });
    expect(wrapper.findAll('[data-material-type]')).toHaveLength(2);

    // data-slot 就挂在 `<input>` 本身，直接对它 setValue
    await wrapper.get('[data-slot="lowcode-palette-search"]').setValue('开关');
    expect(wrapper.findAll('[data-material-type]')).toHaveLength(1);
    expect(
      wrapper
        .get('[data-material-type="probe.switch"]')
        .attributes('data-material-type'),
    ).toBe('probe.switch');

    const off = mount(LowCodePalette, {
      props: { context, searchable: false },
    });
    expect(off.find('[data-slot="lowcode-palette-search"]').exists()).toBe(
      false,
    );
  });

  it('过滤到没有命中时给空态而不是空白', () => {
    const wrapper = mount(LowCodePalette, {
      props: { context: ctx([probeEntry()]), keyword: '不存在的东西' },
    });
    expect(wrapper.find('[data-slot="lowcode-palette-empty"]').exists()).toBe(
      true,
    );
  });

  it('吃内置物料时出厂就有基础/表单/布局三组，宿主一行配置即可用', () => {
    const wrapper = mount(LowCodePalette, {
      props: { context: createLowcodeContext() },
    });
    expect(wrapper.text()).toContain('基础');
    expect(wrapper.text()).toContain('表单');
    expect(wrapper.text()).toContain('布局');
    expect(
      wrapper.findAll('[data-material-type]').length,
    ).toBeGreaterThanOrEqual(9);
  });
});

/* ------------------------------- 属性面板 ------------------------------- */

describe('lowCodeInspector', () => {
  const meta = probeMeta({
    props: [
      { key: 'title', kind: 'string', label: '标题' },
      { key: 'size', kind: 'number', label: '尺寸' },
      {
        key: 'mode',
        kind: 'select',
        label: '模式',
        options: [
          { label: '紧凑', value: 'compact' },
          { label: '宽松', value: 'loose' },
        ],
      },
      { key: 'items', kind: 'json', label: '条目' },
      { key: 'enabled', kind: 'boolean', label: '启用' },
    ],
  });
  const context = ctx([probeEntry(meta)]);

  it('没选中节点时给一句空话，不渲染出半个可用表单', () => {
    const wrapper = mount(LowCodeInspector, { props: { context } });
    expect(wrapper.find('[data-slot="lowcode-inspector-empty"]').exists()).toBe(
      true,
    );
    expect(
      wrapper.findAll('[data-slot="lowcode-inspector-field"]'),
    ).toHaveLength(0);
  });

  it('字段完全由元数据驱动：几行 props 就几个字段，顺序一致', () => {
    const wrapper = mount(LowCodeInspector, {
      props: { context, node: { id: 'n1', type: 'probe.box' } },
    });
    const keys = wrapper
      .findAll('[data-slot="lowcode-inspector-field"]')
      .map((field) => field.attributes('data-field-key'));
    expect(keys).toEqual(['title', 'size', 'mode', 'items', 'enabled']);
    expect(wrapper.get('[data-slot="lowcode-inspector-node-id"]').text()).toBe(
      'n1 · probe.box',
    );
  });

  it('只回抛 `change`，绝不写 props —— 撤销栈的写入方必须是宿主', async () => {
    const node: NodeSchema = {
      id: 'n1',
      props: { title: '原标题' },
      type: 'probe.box',
    };
    const wrapper = mount(LowCodeInspector, { props: { context, node } });
    await wrapper
      .get('[data-field-key="title"]')
      .find('input')
      .setValue('新标题');

    expect(wrapper.emitted('change')?.at(-1)).toEqual([
      { key: 'title', value: '新标题' },
    ]);
    expect(node.props).toEqual({ title: '原标题' });
  });

  it('number 与 json 解析成功后交出真实类型', async () => {
    const wrapper = mount(LowCodeInspector, {
      props: { context, node: { id: 'n1', type: 'probe.box' } },
    });
    await wrapper.get('[data-field-key="size"]').find('input').setValue('42');
    expect(wrapper.emitted('change')?.at(-1)).toEqual([
      { key: 'size', value: 42 },
    ]);

    await wrapper
      .get('[data-field-key="items"]')
      .find('input')
      .setValue('[1,2]');
    expect(wrapper.emitted('change')?.at(-1)).toEqual([
      { key: 'items', value: [1, 2] },
    ]);
  });

  it('解析失败只给提示、不回抛：宿主拿到的永远是合法 Schema', async () => {
    const wrapper = mount(LowCodeInspector, {
      props: { context, node: { id: 'n1', type: 'probe.box' } },
    });
    await wrapper.get('[data-field-key="size"]').find('input').setValue('abc');

    expect(
      wrapper
        .get('[data-field-key="size"]')
        .find('[data-slot="lowcode-inspector-error"]')
        .exists(),
    ).toBe(true);
    expect(wrapper.emitted('change')).toBeUndefined();

    // 换一个字段再犯一次错：依旧只有提示，没有任何一条 change 离开面板
    await wrapper
      .get('[data-field-key="items"]')
      .find('input')
      .setValue('{坏 JSON');
    expect(
      wrapper
        .get('[data-field-key="items"]')
        .find('[data-slot="lowcode-inspector-error"]')
        .exists(),
    ).toBe(true);
    expect(wrapper.emitted('change')).toBeUndefined();

    // 修对了就恢复正常回抛
    await wrapper
      .get('[data-field-key="items"]')
      .find('input')
      .setValue('[1,2]');
    expect(wrapper.emitted('change')?.at(-1)).toEqual([
      { key: 'items', value: [1, 2] },
    ]);
  });

  it('绑定串强制走文本编辑器：把 `{{ }}` 点成枚举值是不可逆的破坏', async () => {
    const wrapper = mount(LowCodeInspector, {
      props: {
        context,
        node: {
          id: 'n1',
          props: { mode: '{{ form.mode }}' },
          type: 'probe.box',
        },
      },
    });
    const field = wrapper.get('[data-field-key="mode"]');
    expect(field.attributes('data-bound')).toBe('true');
    // select 类本该是下拉，这里必须是能保住原文的文本框
    expect(field.find('input').exists()).toBe(true);

    await field.find('input').setValue('{{ form.other }}');
    expect(wrapper.emitted('change')?.at(-1)).toEqual([
      { key: 'mode', value: '{{ form.other }}' },
    ]);
  });

  it('switch 交出布尔，条件框留空即 undefined（= 始终显示）', async () => {
    const wrapper = mount(LowCodeInspector, {
      props: { context, node: { id: 'n1', type: 'probe.box' } },
    });
    await wrapper
      .get('[data-field-key="enabled"]')
      .find('button')
      .trigger('click');
    expect(wrapper.emitted('change')?.at(-1)).toEqual([
      { key: 'enabled', value: true },
    ]);

    await wrapper
      .get('[data-slot="lowcode-inspector-condition"]')
      .find('input')
      .setValue('  {{ a > 1 }}  ');
    expect(wrapper.emitted('update:condition')?.at(-1)).toEqual([
      '{{ a > 1 }}',
    ]);

    await wrapper
      .get('[data-slot="lowcode-inspector-condition"]')
      .find('input')
      .setValue('   ');
    expect(wrapper.emitted('update:condition')?.at(-1)).toEqual([undefined]);
  });

  it('allowCondition 关掉后条件编辑器消失（纯表单宿主用）', () => {
    const wrapper = mount(LowCodeInspector, {
      props: {
        allowCondition: false,
        context,
        node: { id: 'n1', type: 'probe.box' },
      },
    });
    expect(
      wrapper.find('[data-slot="lowcode-inspector-condition"]').exists(),
    ).toBe(false);
  });
});

/* -------------------------------- 大纲 -------------------------------- */

describe('lowCodeOutline', () => {
  const tree: NodeSchema[] = [
    {
      children: [
        { id: 'b', props: { text: '子' }, type: 'probe.box' },
        { id: 'd', props: { text: '另一个子' }, type: 'probe.box' },
        { id: 'e', props: { text: '末个子' }, type: 'probe.box' },
      ],
      id: 'a',
      props: { title: '外层' },
      slots: {
        footer: [{ id: 'c', props: { text: '尾' }, type: 'probe.box' }],
      },
      type: 'probe.box',
    },
  ];

  it('按 `walkSchema` 的顺序把树拍成行，深度与父级都写在 data 上', () => {
    const wrapper = mount(LowCodeOutline, {
      props: { context: ctx([probeEntry()]), nodes: tree },
    });
    const rows = wrapper.findAll('[data-slot="lowcode-outline-row"]');
    // children 先、具名插槽后，和渲染器、体检用的是同一个遍历顺序
    expect(rows.map((row) => row.attributes('data-node-id'))).toEqual([
      'a',
      'b',
      'd',
      'e',
      'c',
    ]);
    expect(rows.map((row) => row.attributes('data-depth'))).toEqual([
      '0',
      '1',
      '1',
      '1',
      '1',
    ]);
    expect(rows[1]?.attributes('data-parent-id')).toBe('a');
    // 根级没有父节点：属性不落地，而不是写成空串冒充「有父」
    expect(rows[0]?.attributes('data-parent-id')).toBeUndefined();
  });

  it('选中态由宿主持有：面板只把当前 selectedId 标出来并回抛 select', async () => {
    const wrapper = mount(LowCodeOutline, {
      props: { context: ctx([probeEntry()]), nodes: tree, selectedId: 'b' },
    });
    expect(
      wrapper
        .get('[data-node-id="b"]')
        .get('[data-action="select"]')
        .attributes('data-selected'),
    ).toBe('true');
    expect(
      wrapper
        .get('[data-node-id="a"]')
        .get('[data-action="select"]')
        .attributes('data-selected'),
    ).toBe('false');

    await wrapper
      .get('[data-node-id="c"]')
      .get('[data-action="select"]')
      .trigger('click');
    expect(wrapper.emitted('select')?.at(-1)).toEqual(['c']);
  });

  it('四个动作各抛一条：上移/下移给方向，复制/删除给 id', async () => {
    const wrapper = mount(LowCodeOutline, {
      props: { context: ctx([probeEntry()]), nodes: tree },
    });
    const row = wrapper.get('[data-node-id="d"]');
    await row.get('[data-action="move-up"]').trigger('click');
    await row.get('[data-action="move-down"]').trigger('click');
    await row.get('[data-action="duplicate"]').trigger('click');
    await row.get('[data-action="remove"]').trigger('click');

    expect(wrapper.emitted('move')).toEqual([
      [{ direction: 'up', nodeId: 'd' }],
      [{ direction: 'down', nodeId: 'd' }],
    ]);
    expect(wrapper.emitted('duplicate')?.at(-1)).toEqual(['d']);
    expect(wrapper.emitted('remove')?.at(-1)).toEqual(['d']);
  });

  it('同层到头用 disabled 表达：首行不能上移、末行不能下移，独苗两头都动不了', () => {
    const wrapper = mount(LowCodeOutline, {
      props: { context: ctx([probeEntry()]), nodes: tree },
    });
    // 按钮始终在场（布局不跳），到头时禁用；根级的 a 也是「独苗」
    expect(
      wrapper
        .get('[data-node-id="b"]')
        .get('[data-action="move-up"]')
        .attributes('disabled'),
    ).toBeDefined();
    expect(
      wrapper
        .get('[data-node-id="b"]')
        .get('[data-action="move-down"]')
        .attributes('disabled'),
    ).toBeUndefined();
    expect(
      wrapper
        .get('[data-node-id="e"]')
        .get('[data-action="move-down"]')
        .attributes('disabled'),
    ).toBeDefined();
    expect(
      wrapper
        .get('[data-node-id="e"]')
        .get('[data-action="move-up"]')
        .attributes('disabled'),
    ).toBeUndefined();
    expect(
      wrapper
        .get('[data-node-id="a"]')
        .get('[data-action="move-down"]')
        .attributes('disabled'),
    ).toBeDefined();
    // footer 里的 c 与 children 不同层：即使深度相同也不算兄弟
    expect(
      wrapper
        .get('[data-node-id="c"]')
        .get('[data-action="move-up"]')
        .attributes('disabled'),
    ).toBeDefined();
  });

  it('键盘兜住手势：Alt + ↑ 同层移动、↓ 换选中、Delete 删除', async () => {
    const wrapper = mount(LowCodeOutline, {
      props: { context: ctx([probeEntry()]), nodes: tree },
    });
    const d = wrapper.get('[data-node-id="d"]').get('[data-action="select"]');
    await d.trigger('keydown', { altKey: true, key: 'ArrowUp' });
    expect(wrapper.emitted('move')?.at(-1)).toEqual([
      { direction: 'up', nodeId: 'd' },
    ]);

    await d.trigger('keydown', { key: 'ArrowDown' });
    expect(wrapper.emitted('select')?.at(-1)).toEqual(['e']);

    await d.trigger('keydown', { key: 'Delete' });
    expect(wrapper.emitted('remove')?.at(-1)).toEqual(['d']);
  });

  it('showActions 关掉就是只读预览；空树给空态', () => {
    const readonly = mount(LowCodeOutline, {
      props: { context: ctx([probeEntry()]), nodes: tree, showActions: false },
    });
    expect(readonly.find('[data-action="remove"]').exists()).toBe(false);
    expect(readonly.findAll('[data-slot="lowcode-outline-row"]')).toHaveLength(
      5,
    );

    const empty = mount(LowCodeOutline, {
      props: { context: ctx([probeEntry()]) },
    });
    expect(empty.find('[data-slot="lowcode-outline-empty"]').exists()).toBe(
      true,
    );
  });

  it('行名优先取元数据的中文名，没登记的类型也能显示 id 而不是空白', () => {
    const named = mount(LowCodeOutline, {
      props: {
        context: ctx([probeEntry(probeMeta({ name: '容器' }))]),
        nodes: [{ id: 'x', type: 'probe.box' }],
      },
    });
    expect(named.get('[data-node-id="x"]').text()).toContain('容器');

    const unknown = mount(LowCodeOutline, {
      props: {
        context: ctx([probeEntry()]),
        nodes: [{ id: 'y', type: 'nope.missing' }],
      },
    });
    expect(unknown.get('[data-node-id="y"]').text()).toContain('nope.missing');
  });

  /** jsdom 里的 `dataTransfer`：只实现面板真正用到的那两个方法，格式与 `utils/dnd` 对齐 */
  function carrier(payload: unknown) {
    const store: Record<string, string> = {
      [LOWCODE_DND_MIME]: JSON.stringify(payload),
    };
    return {
      getData: (format: string) => store[format] ?? '',
      setData: (format: string, data: string) => {
        store[format] = data;
      },
    };
  }

  it('把物料拖到行上时抛 materialType，挪已有节点时抛 nodeId —— 两者互斥', async () => {
    const wrapper = mount(LowCodeOutline, {
      props: { context: ctx([probeEntry()]), nodes: tree },
    });
    const row = wrapper.get('[data-node-id="b"]');
    await row.trigger('drop', {
      dataTransfer: carrier({ kind: 'material', type: 'probe.box' }),
    });
    const dropped = wrapper.emitted('drop')?.at(-1)?.[0] as Record<
      string,
      unknown
    >;
    expect(dropped.materialType).toBe('probe.box');
    expect(dropped.nodeId).toBeUndefined();
    // 落点：jsdom 没有布局高度，容器行退化成 inside，slot 用大纲的字符串口径 `children`
    expect(dropped.position).toBe('inside');
    expect(dropped.slot).toBe('children');
    expect(dropped.refId).toBe('b');

    await row.trigger('drop', {
      dataTransfer: carrier({ kind: 'node', nodeId: 'e' }),
    });
    const moved = wrapper.emitted('drop')?.at(-1)?.[0] as Record<
      string,
      unknown
    >;
    expect(moved.nodeId).toBe('e');
    expect(moved.materialType).toBeUndefined();
  });

  it('不是本包格式的拖拽（别的页面文本）直接忽略，不抛 drop', async () => {
    const wrapper = mount(LowCodeOutline, {
      props: { context: ctx([probeEntry()]), nodes: tree },
    });
    await wrapper
      .get('[data-node-id="b"]')
      .trigger('drop', { dataTransfer: carrier('probe.box') });
    expect(wrapper.emitted('drop')).toBeUndefined();
  });

  it('空态与末尾落点区都能收物料：抛的是根级 inside，没有 refId', async () => {
    const wrapper = mount(LowCodeOutline, {
      props: { context: ctx([probeEntry()]), nodes: tree },
    });
    await wrapper.get('[data-action="drop-root"]').trigger('drop', {
      dataTransfer: carrier({ kind: 'material', type: 'probe.box' }),
    });
    expect(wrapper.emitted('drop')?.at(-1)?.[0]).toEqual({
      materialType: 'probe.box',
      nodeId: undefined,
      position: 'inside',
    });
  });
});

/* ------------------------- 装配的响应式（`:context` 换一套） ------------------------- */

/**
 * 这四条钉的是同一件事：`context` 是**读出来**的，不是在 setup 那一刻抄下来的。
 *
 * 宿主换装配是真实场景（切租户换物料包、设计器切预览/编辑两套注册表），
 * 而组件树重挂一次会连带丢掉大纲的展开态与属性面板的草稿 —— 所以口径是
 * 「换 prop 就地生效，不重挂」。旧实现把 `props.context` 当普通入参抄了一次，
 * 换 prop 时物料列表、行名、上报口全留在旧装配上，表现是「面板还在但改不动」。
 */

/** 只用来区分装配的物料：把自己是谁写进 DOM，断言时不必猜渲染顺序 */
function markerEntry(marker: string, type = 'probe.box'): MaterialEntry {
  return {
    component: markRaw({
      name: type,
      setup: () => () => h('div', { 'data-marker': marker }, marker),
    }),
    meta: probeMeta({ name: marker, type }),
  };
}

describe('装配换一套时组件就地跟上', () => {
  it('渲染器换装配：物料跟着换，DOM 根节点没被重挂', async () => {
    const wrapper = mount(LowCodeRenderer, {
      props: {
        context: ctx([markerEntry('甲')]),
        nodes: [{ id: 'n', type: 'probe.box' }],
        scope: {},
      },
    });
    expect(wrapper.get('[data-marker]').text()).toBe('甲');

    const root = wrapper.element;
    await wrapper.setProps({ context: ctx([markerEntry('乙')]) });

    expect(wrapper.get('[data-marker]').text()).toBe('乙');
    expect(wrapper.element).toBe(root);
  });

  it('未注册类型的上报口跟着装配走：报错冒到新 context 的 report，而不是留在旧的', async () => {
    const reported: string[] = [];
    // 甲装配认识 probe.box，乙装配故意不认识 —— 换过去才会触发一次「未知类型」
    const wrapper = mount(LowCodeRenderer, {
      props: {
        context: ctx([markerEntry('甲')]),
        nodes: [{ id: 'n', type: 'probe.box' }],
        scope: {},
      },
    });
    await wrapper.setProps({
      context: createLowcodeContext({
        components: [],
        report: (issue) => reported.push(issue.message),
        useBuiltinMaterials: false,
      }),
    });

    expect(reported.join('；')).toContain('组件类型「probe.box」没有注册');
  });

  it('物料面板换装配：列表按新注册表重算，不靠重新挂载', async () => {
    const wrapper = mount(LowCodePalette, {
      props: { context: ctx([markerEntry('甲', 'probe.a')]) },
    });
    expect(wrapper.find('[data-material-type="probe.a"]').exists()).toBe(true);
    expect(wrapper.find('[data-material-type="probe.b"]').exists()).toBe(false);

    await wrapper.setProps({ context: ctx([markerEntry('乙', 'probe.b')]) });
    expect(wrapper.find('[data-material-type="probe.a"]').exists()).toBe(false);
    expect(wrapper.find('[data-material-type="probe.b"]').exists()).toBe(true);
  });

  it('子树里 inject 到的也是活的那一份：宿主只给渲染器传 context 就够了', async () => {
    // 探针物料自己不接 context prop，靠渲染器 provide 下去；读 maxDepth 这种标量最省事
    const Probe = {
      name: 'depth.probe',
      setup: () => {
        const injected = useLowcodeContext();
        return () => h('div', { 'data-depth': String(injected.maxDepth) });
      },
    };
    const materials = [
      {
        component: markRaw(Probe),
        meta: probeMeta({ name: '深度探针', type: 'probe.box' }),
      },
    ];
    const nodes: NodeSchema[] = [{ id: 'p', type: 'probe.box' }];
    const wrapper = mount(LowCodeRenderer, {
      props: {
        context: createLowcodeContext({ components: materials, maxDepth: 3 }),
        nodes,
        scope: {},
      },
    });
    expect(wrapper.get('[data-depth]').attributes('data-depth')).toBe('3');

    await wrapper.setProps({
      context: createLowcodeContext({ components: materials, maxDepth: 7 }),
    });
    expect(wrapper.get('[data-depth]').attributes('data-depth')).toBe('7');
  });
});
