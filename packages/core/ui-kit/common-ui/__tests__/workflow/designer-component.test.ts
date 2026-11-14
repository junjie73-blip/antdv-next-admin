import type { WorkflowDefinition } from '../../src/workflow/core/types';

import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';

import { describe, expect, it } from 'vitest';

import {
  addNode,
  createEmptyDefinition,
} from '../../src/workflow/core/designer';
import {
  WorkflowDefinitionDesigner,
  WorkflowNodeInspector,
} from '../../src/workflow/index';

/**
 * 组件层只验两件事：**事件翻译**（vue-flow 的一个动作 → 一次纯函数调用 → 一次 emit）
 * 和 **可选渲染**（只读模式、面板开关、校验条）。
 *
 * `VueFlow` / `Background` / `Controls` 一律换成替身：真画布在 jsdom 里要 DOMMatrix、
 * ResizeObserver、pointer events，验出来的结论其实是在验 vue-flow 自己的测试。
 * 替身保留组件名与事件签名，所以"@vue-flow 抛 connect 时我们有没有拒绝"这类判据仍然成立。
 * `ScrollArea` 用透传替身，因为 reka-ui 的滚动容器在 jsdom 里不渲染 slot 内容。
 */

const VueFlowStub = defineComponent({
  name: 'VueFlow',
  props: {
    edges: { default: () => [], type: Array },
    elementsSelectable: { default: true, type: Boolean },
    fitViewOnInit: { default: false, type: Boolean },
    minZoom: { default: undefined, type: Number },
    nodes: { default: () => [], type: Array },
    nodesConnectable: { default: true, type: Boolean },
    nodesDraggable: { default: true, type: Boolean },
  },
  emits: [
    'connect',
    'edge-click',
    'node-click',
    'node-drag-stop',
    'pane-click',
    'update:edges',
    'update:nodes',
  ],
  setup: () => () => h('div', { class: 'vueflow-stub' }),
});

const ScrollAreaStub = defineComponent({
  name: 'ScrollArea',
  props: { class: { default: '', type: String } },
  setup:
    (_, { slots }) =>
    () =>
      h('div', slots.default?.()),
});

const STUBS = {
  Background: true,
  Controls: true,
  ScrollArea: ScrollAreaStub,
  VueFlow: VueFlowStub,
};

/**
 * 三条边都还没连全的草稿：start → end 一条，外加一个孤立的审批节点。
 * 之所以不直接用 `createEmptyDefinition()` 测连线 —— 那份图里 start 不可入、
 * end 不可出，**不存在任何一条合法的新边**，连"合法落边"都没法验。
 */
function fixture(): WorkflowDefinition {
  const base = createEmptyDefinition({
    id: 'flow-designer',
    name: '设计器用例',
  });
  return addNode(base, { kind: 'approval', position: { x: 200, y: 120 } })
    .definition;
}

function mountDesigner(props: Record<string, unknown> = {}) {
  return mount(WorkflowDefinitionDesigner, {
    global: { stubs: STUBS },
    props: { definition: fixture(), ...props },
  });
}

function paletteItem(wrapper: ReturnType<typeof mountDesigner>, label: string) {
  return wrapper
    .findAll('[data-testid="designer-palette-item"]')
    .find((item) => item.text() === label);
}

function lastEmittedDefinition(
  wrapper: ReturnType<typeof mountDesigner>,
): WorkflowDefinition {
  const emitted = wrapper.emitted('update:definition');
  if (!emitted?.length) throw new Error('没有 emit 出新定义');
  return emitted.at(-1)![0] as WorkflowDefinition;
}

describe('workflowDefinitionDesigner', () => {
  it('默认渲染出工具条、六个调色板项与属性面板', () => {
    const wrapper = mountDesigner();
    expect(wrapper.find('[data-slot="designer-toolbar"]').exists()).toBe(true);
    expect(
      wrapper.findAll('[data-testid="designer-palette-item"]'),
    ).toHaveLength(6);
    expect(wrapper.find('[data-slot="workflow-node-inspector"]').exists()).toBe(
      true,
    );
    expect(wrapper.text()).toContain('设计器用例');
  });

  it('点调色板就是在定义上加节点，并把新节点设为选中', () => {
    const wrapper = mountDesigner();
    paletteItem(wrapper, '抄送')!.trigger('click');
    expect(wrapper.emitted('update:definition')).toHaveLength(1);
    const next = lastEmittedDefinition(wrapper);
    expect(next.nodes).toHaveLength(4);
    expect(next.nodes.at(-1)).toMatchObject({ id: 'cc_1', type: 'cc' });
    // 传进来的定义没被就地改写
    expect(wrapper.props('definition').nodes).toHaveLength(3);
    expect((wrapper.vm as any).selectedNodeId).toBe('cc_1');
  });

  it('再点「发起」不会加出第二个入口，而是回抛一句中文', () => {
    const wrapper = mountDesigner();
    paletteItem(wrapper, '发起')!.trigger('click');
    expect(wrapper.emitted('update:definition')).toBeUndefined();
    expect(wrapper.emitted('warn')?.[0]?.[0]).toContain('只能有一个');
  });

  /**
   * 受控组件的口径：`connect()` 是拿 **props 里那份定义** 判重复的。
   * 所以这里的"重复边"用的是 fixture 自带的 `start → end`（`edge_1`），
   * 而不是"上一步刚 emit 出去的那条" —— 后者要等宿主把定义喂回来才成为既成事实，
   * 测试里不接 `update:definition` 就不该假装它已经存在。
   */
  it('vue-flow 抛 connect：合法就落边，重复边与自环被拒且不 emit', () => {
    const wrapper = mountDesigner();
    const canvas = wrapper.findComponent(VueFlowStub);
    const source = wrapper.props('definition');

    canvas.vm.$emit('connect', { source: 'node_start', target: 'approval_1' });
    expect(lastEmittedDefinition(wrapper).edges).toHaveLength(2);

    canvas.vm.$emit('connect', { source: 'node_start', target: 'node_end' });
    expect(wrapper.emitted('update:definition')).toHaveLength(1);
    expect(wrapper.emitted('warn')?.[0]?.[0]).toContain('已经有连线');

    canvas.vm.$emit('connect', { source: 'node_start', target: 'node_start' });
    expect(wrapper.emitted('warn')?.[1]?.[0]).toContain('不能把节点连到它自己');
    expect(source.edges).toHaveLength(1);
  });

  it('连进发起节点被拒：入口不能有入边', () => {
    const wrapper = mountDesigner();
    wrapper
      .findComponent(VueFlowStub)
      .vm.$emit('connect', { source: 'approval_1', target: 'node_start' });
    expect(wrapper.emitted('update:definition')).toBeUndefined();
    expect(wrapper.emitted('warn')?.[0]?.[0]).toContain('不能作为连线终点');
  });

  it('从结束节点往外连被拒：出口不再出发', () => {
    const wrapper = mountDesigner();
    wrapper
      .findComponent(VueFlowStub)
      .vm.$emit('connect', { source: 'node_end', target: 'approval_1' });
    expect(wrapper.emitted('warn')?.[0]?.[0]).toContain('不能作为连线起点');
  });

  it('拖动结束把全部坐标一次写回，而不是每个节点 emit 一次', () => {
    const wrapper = mountDesigner();
    const canvas = wrapper.findComponent(VueFlowStub);
    // vue-flow 拖动时是就地改它那份 node 对象，这里照做：拿到的就是 nodes.value 同一个数组
    const list = canvas.props('nodes') as any[];
    list.forEach((node, index) => {
      node.position = { x: 100 + index * 50, y: 20 };
    });
    canvas.vm.$emit('node-drag-stop');
    expect(wrapper.emitted('update:definition')).toHaveLength(1);
    expect(
      lastEmittedDefinition(wrapper).nodes.map((node) => node.position),
    ).toEqual([
      { x: 100, y: 20 },
      { x: 150, y: 20 },
      { x: 200, y: 20 },
    ]);
  });

  it('坐标没变时不 emit：免得每次点选都往宿主历史里塞一条空记录', () => {
    const wrapper = mountDesigner();
    wrapper.findComponent(VueFlowStub).vm.$emit('node-drag-stop');
    expect(wrapper.emitted('update:definition')).toBeUndefined();
  });

  it('选中节点 / 选中连线 / 点空白都回抛给宿主，并互斥掉另一个选中', async () => {
    const wrapper = mountDesigner();
    const canvas = wrapper.findComponent(VueFlowStub);
    canvas.vm.$emit('node-click', { node: { id: 'node_start' } });
    expect(wrapper.emitted('selectNode')).toEqual([['node_start']]);
    canvas.vm.$emit('edge-click', { edge: { id: 'edge_1' } });
    expect(wrapper.emitted('selectEdge')).toEqual([['edge_1']]);
    expect((wrapper.vm as any).selectedNodeId).toBeUndefined();
    canvas.vm.$emit('pane-click');
    expect((wrapper.vm as any).selectedEdgeId).toBeUndefined();
    await nextTick();
    // 选中态清空后面板回到引导文案
    expect(
      wrapper.find('[data-slot="workflow-node-inspector"]').text(),
    ).toContain('点一个节点');
  });

  it('删除按钮跟着选中态走：删入口被拒，删连线会把边摘掉', async () => {
    const wrapper = mountDesigner();
    expect(
      wrapper
        .find('[data-testid="designer-remove-node"]')
        .attributes('disabled'),
    ).toBeDefined();
    expect(
      wrapper
        .find('[data-testid="designer-remove-edge"]')
        .attributes('disabled'),
    ).toBeDefined();

    (wrapper.vm as any).selectedNodeId = 'node_start';
    await nextTick();
    wrapper.find('[data-testid="designer-remove-node"]').trigger('click');
    expect(wrapper.emitted('update:definition')).toBeUndefined();
    expect(wrapper.emitted('warn')?.[0]?.[0]).toContain('不能删除');

    (wrapper.vm as any).selectedNodeId = undefined;
    (wrapper.vm as any).selectedEdgeId = 'edge_1';
    await nextTick();
    wrapper.find('[data-testid="designer-remove-edge"]').trigger('click');
    expect(lastEmittedDefinition(wrapper).edges).toHaveLength(0);
    expect((wrapper.vm as any).selectedEdgeId).toBeUndefined();
  });

  it('自动布局按钮就是把 autoLayout 的结果交出去', () => {
    const wrapper = mountDesigner();
    wrapper.find('[data-testid="designer-auto-layout"]').trigger('click');
    // start 在第 0 层，孤立的 approval 也在第 0 层，end 在第 1 层
    expect(
      lastEmittedDefinition(wrapper).nodes.map((node) => node.position?.x),
    ).toEqual([60, 320, 60]);
  });

  /**
   * 「设计器第一次打开就是一坨」是这一层唯一真正的可用性问题：
   * 后端存的定义可以不包含坐标，映射层保证看得见，这一次 emit 保证坐标落到模型里。
   * 只落一次 —— `autoLayout()` 给每个节点都放了坐标，条件从此不再成立。
   */
  it('定义里没有坐标时挂载就铺开并交回宿主，只读模式不动宿主的数据', () => {
    const bare: WorkflowDefinition = {
      edges: [{ id: 'e1', source: 's', target: 'a' }],
      id: 'bare',
      name: '没有坐标',
      nodes: [
        { data: {}, id: 's', type: 'start' },
        { data: {}, id: 'a', type: 'approval' },
      ],
      version: 1,
    };

    const wrapper = mountDesigner({ definition: bare });
    expect(wrapper.emitted('update:definition')).toHaveLength(1);
    expect(
      lastEmittedDefinition(wrapper).nodes.every((node) => node.position),
    ).toBe(true);

    const readonly = mountDesigner({ definition: bare, editable: false });
    expect(readonly.emitted('update:definition')).toBeUndefined();
  });

  it('校验条按等级渲染：孤立节点只是提醒，缺处理器才是错误', () => {
    const wrapper = mountDesigner();
    // fixture 里审批节点没连边 → 提醒（不是错误），徽章仍是"定义可用"
    expect(wrapper.find('[data-slot="designer-issues"]').exists()).toBe(true);
    expect(wrapper.find('[data-slot="designer-issues"]').text()).toContain(
      '提醒',
    );
    expect(wrapper.find('[data-testid="designer-issue-badge"]').text()).toBe(
      '定义可用',
    );

    const empty = createEmptyDefinition();
    const clean = mountDesigner({ definition: empty });
    expect(clean.find('[data-testid="designer-issue-badge"]').text()).toBe(
      '定义可用',
    );
    expect(clean.find('[data-slot="designer-issues"]').exists()).toBe(false);

    const dirty = mountDesigner({
      definition: {
        ...empty,
        edges: [
          ...empty.edges,
          { id: 'edge_2', source: 'node_start', target: 'erp' },
        ],
        nodes: [
          ...empty.nodes,
          { data: {}, id: 'erp', label: '同步 ERP', type: 'erpSync' },
        ],
      },
    });
    expect(dirty.find('[data-testid="designer-issue-badge"]').text()).toBe(
      '1 个错误',
    );
    expect(dirty.find('[data-slot="designer-issues"]').text()).toContain(
      '没有注册处理器',
    );
  });

  it('只读模式没有调色板，且画布锁死拖动与连线', () => {
    const wrapper = mountDesigner({ editable: false });
    expect(wrapper.find('[data-slot="designer-palette"]').exists()).toBe(false);
    const canvas = wrapper.findComponent(VueFlowStub);
    expect(canvas.props('nodesDraggable')).toBe(false);
    expect(canvas.props('nodesConnectable')).toBe(false);
    expect(canvas.props('elementsSelectable')).toBe(false);
  });

  it('showInspector / showToolbar 关掉后对应区块不渲染', () => {
    const wrapper = mountDesigner({ showInspector: false, showToolbar: false });
    expect(wrapper.find('[data-slot="workflow-node-inspector"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-slot="designer-toolbar"]').exists()).toBe(false);
  });

  it('面板改名一路冒泡到宿主，且不改动传进来的定义', async () => {
    const source = fixture();
    const wrapper = mountDesigner({ definition: source });
    (wrapper.vm as any).selectedNodeId = 'node_start';
    await nextTick();

    const inspector = wrapper.findComponent(WorkflowNodeInspector);
    expect(inspector.props('nodeId')).toBe('node_start');
    const labelInput = inspector.find('#wf-node-label');
    (labelInput.element as HTMLInputElement).value = '我要出差';
    labelInput.trigger('input');
    await nextTick();

    expect(
      lastEmittedDefinition(wrapper).nodes.find(
        (node) => node.id === 'node_start',
      )?.label,
    ).toBe('我要出差');
    expect(source.nodes[0]?.label).toBe('发起');
  });
});
