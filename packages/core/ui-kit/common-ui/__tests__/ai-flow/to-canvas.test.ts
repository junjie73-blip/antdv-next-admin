import type {
  AiFlowDefinition,
  AiNodeStatus,
} from '../../src/ai-flow/core/types';

import { describe, expect, it } from 'vitest';

import {
  AI_CANVAS_NODE_TYPE,
  AI_EDGE_STROKE,
  AI_NODE_PALETTE,
  AI_NODE_PALETTE_FALLBACK,
  AI_NODE_STATUS_RING,
  nodePaletteOf,
  nodeStatusRingOf,
  toCanvasEdges,
  toCanvasNodes,
} from '../../src/ai-flow/components/AiFlowCanvas/to-canvas';

/**
 * 画布映射（`components/AiFlowCanvas/to-canvas.ts`）。
 *
 * 为什么单测只打这个文件：`AiFlowCanvas.vue` 里碰 VueFlow 生命周期与 DOM 的部分在 jsdom 里测不动，
 * 而「状态涂成什么颜色、缺坐标时落在哪」恰恰是最会被 review 挑、又最容易悄悄变形的规则。
 * 这个文件没有任何运行语义 —— 所以用例里也不该出现运行器：画布只把已经算好的结论涂成颜色。
 */

function def(
  nodes: AiFlowDefinition['nodes'],
  edges: AiFlowDefinition['edges'],
): AiFlowDefinition {
  return { edges, id: 'flow-canvas', name: '画布测试', nodes, version: 1 };
}

function statusOf(...entries: Array<[string, AiNodeStatus]>) {
  const nodes: Record<
    string,
    { attempts: number; id: string; kind: string; status: AiNodeStatus }
  > = {};
  for (const [id, status] of entries) {
    nodes[id] = { attempts: 1, id, kind: 'llm', status };
  }
  return { nodes };
}

const paletteKeys = [
  'condition',
  'end',
  'human',
  'llm',
  'prompt',
  'start',
  'tool',
  'transform',
] as const;

describe('状态与类型到类名的映射', () => {
  it('八种内置类型各有配色，未知类型走中性兜底而不是 undefined —— 自定义业务节点不该在配色上抢戏', () => {
    expect(Object.keys(AI_NODE_PALETTE).sort()).toEqual(
      [...paletteKeys].sort(),
    );
    expect(nodePaletteOf('agent')).toBe(AI_NODE_PALETTE_FALLBACK);
    expect(nodePaletteOf('llm')).toBe(AI_NODE_PALETTE.llm);
  });

  it('七种节点状态都有外环类名：漏一种，画布上就会出现一个「不知道跑到哪了」的灰块', () => {
    const statuses = Object.keys(AI_NODE_STATUS_RING).sort();
    expect(statuses).toEqual([
      'awaiting',
      'canceled',
      'failed',
      'pending',
      'running',
      'skipped',
      'succeeded',
    ]);
    expect(nodeStatusRingOf('running')).toContain('ring-primary');
    // 挂起与失败必须用不同颜色：运行面板要能一眼区分「正在等模型」和「正在等人」
    expect(nodeStatusRingOf('awaiting')).toContain('ring-warning');
    expect(nodeStatusRingOf('failed')).toContain('ring-destructive');
    expect(nodeStatusRingOf('canceled')).toContain('opacity');
  });

  it('类型配色与状态外环是两套独立类名，可以叠加而不是互相覆盖', () => {
    expect(`${nodePaletteOf('llm')} ${nodeStatusRingOf('succeeded')}`).toBe(
      'border-primary bg-primary/10 text-primary ring-1 ring-success',
    );
  });

  it('只留主题 token 类名：出现十六进制或内联色就等于绕开主题系统，换肤时画布不跟', () => {
    const colorish = /#[0-9a-f]{3,8}|\b(?:rgb|rgba|hsl|hsla)\(|--ant-/u;
    // 先确认这条守卫本身能命中真东西，否则它只是一条永远绿的空断言
    expect('#1a2b3c'.match(colorish)).not.toBeNull();
    expect('hsl(210 50% 50%)'.match(colorish)).not.toBeNull();
    expect('var(--ant-color-primary)'.match(colorish)).not.toBeNull();
    const offenders = Object.entries(AI_NODE_PALETTE)
      .filter(([, value]) => colorish.test(value))
      .map(([kind]) => kind);
    expect(offenders).toEqual([]);
    expect(colorish.test(AI_NODE_PALETTE_FALLBACK)).toBe(false);
    expect(colorish.test(AI_CANVAS_NODE_TYPE)).toBe(false);
  });
});

describe('toCanvasNodes：坐标兜底与状态着色', () => {
  const flow = () =>
    def(
      [
        {
          data: { outputKey: '第一段' },
          id: 'n1',
          label: '第一步',
          position: { x: 12, y: 34 },
          type: 'llm',
        },
        { data: {}, id: 'n2', type: 'tool' },
        { data: {}, id: 'n3', type: 'end' },
      ],
      [{ id: 'e1', source: 'n1', target: 'n2' }],
    );

  it('有运行态时按节点状态涂色、按产物键回显 valueKey', () => {
    const nodes = toCanvasNodes(
      flow(),
      statusOf(['n1', 'running'], ['n2', 'succeeded']) as never,
    );
    expect(nodes.map((node) => node.data.status)).toEqual([
      'running',
      'succeeded',
      'pending',
    ]);
    expect(nodes[0]?.data.valueKey).toBe('第一段');
  });

  it('没有运行态时全部 pending：画布初次打开不该把没跑过的节点涂成绿', () => {
    expect(toCanvasNodes(flow()).map((node) => node.data.status)).toEqual([
      'pending',
      'pending',
      'pending',
    ]);
  });

  it('没配坐标的节点按声明顺序横向铺开，且结果可复现（同一张图两次调用完全一致）', () => {
    const first = toCanvasNodes(flow());
    expect(first.map((node) => node.position)).toEqual([
      { x: 12, y: 34 },
      { x: 300, y: 80 },
      { x: 560, y: 80 },
    ]);
    expect(toCanvasNodes(flow()).map((node) => node.position)).toEqual(
      first.map((node) => node.position),
    );
  });

  it('所有节点共用一个 VueFlow 类型名，插槽只有一个模板；label 缺省回落节点 id', () => {
    const nodes = toCanvasNodes(flow());
    expect(nodes.every((node) => node.type === AI_CANVAS_NODE_TYPE)).toBe(true);
    expect(nodes.map((node) => node.data.label)).toEqual([
      '第一步',
      'n2',
      'n3',
    ]);
  });

  it('说明文字只来自节点真正配了什么，各 kind 各自口径', () => {
    const described = toCanvasNodes(
      def(
        [
          {
            data: {
              branches: [{ edgeId: 'e9', expression: 'true' }],
              defaultEdgeId: 'e8',
            },
            id: 'c',
            type: 'condition',
          },
          {
            data: { model: 'gpt-test', stream: true, tools: ['lookup'] },
            id: 'l',
            type: 'llm',
          },
          { data: {}, id: 'l2', type: 'llm' },
          {
            data: { fewShot: [{ input: '甲', output: '乙' }] },
            id: 'p',
            type: 'prompt',
          },
          { data: {}, id: 't', type: 'tool' },
          { data: { tool: 'lookup' }, id: 't2', type: 'tool' },
          { data: { expression: 'a + b' }, id: 'x', type: 'transform' },
          { data: { resumeLabel: '请人工确认' }, id: 'h', type: 'human' },
          { data: {}, id: 'h2', type: 'human' },
          { data: {}, id: 's', type: 'start' },
          { data: {}, id: 'e', type: 'end' },
        ],
        [],
      ),
    ).map((node) => node.data.description);
    expect(described).toEqual([
      '1 个分支 · 有默认边',
      'gpt-test · 流式 · 工具 ×1',
      '默认模型',
      '1 个示例',
      '未指定工具',
      'lookup',
      'a + b',
      '请人工确认',
      '等待人工确认',
      '',
      '',
    ]);
  });

  it('data 缺省为空对象也不能抛：服务端存回来的图常有节点没有 data', () => {
    const nodes = toCanvasNodes(
      def(
        [
          { id: 'bare', type: 'llm' },
          { id: 'e', type: 'end' },
        ],
        [{ id: 'e1', source: 'bare', target: 'e' }],
      ),
    );
    expect(nodes[0]?.data.description).toBe('默认模型');
    expect(nodes[0]?.data.kind).toBe('llm');
  });
});

describe('toCanvasEdges：只有真正走过的边才涂主色', () => {
  const flow = () =>
    def(
      [
        { data: {}, id: 'n1', type: 'llm' },
        { data: {}, id: 'n2', type: 'llm' },
        { data: {}, id: 'n3', type: 'end' },
      ],
      [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' },
      ],
    );

  it('走过 = 源成功 **且** 目标真被调度过；目标是 running 说明边已经过了', () => {
    const walked = toCanvasEdges(
      flow(),
      statusOf(
        ['n1', 'succeeded'],
        ['n2', 'running'],
        ['n3', 'pending'],
      ) as never,
    );
    expect(walked.map((item) => item.class)).toEqual([
      'stroke-primary',
      'stroke-border',
    ]);
    expect(walked.map((item) => item.style.stroke)).toEqual([
      AI_EDGE_STROKE.traversed,
      AI_EDGE_STROKE.idle,
    ]);
  });

  it('未命中的分支不算走过：源节点成功不代表它的每条出边都被走', () => {
    // route 成功 + 二选一：命中的一头拿到真状态，没命中的一头是 skipped
    const branch = def(
      [
        { data: {}, id: 'route', type: 'condition' },
        { data: {}, id: 'hot', type: 'llm' },
        { data: {}, id: 'cold', type: 'llm' },
      ],
      [
        { id: 'eHot', source: 'route', target: 'hot' },
        { id: 'eCold', source: 'route', target: 'cold' },
      ],
    );
    const classes = toCanvasEdges(
      branch,
      statusOf(
        ['route', 'succeeded'],
        ['hot', 'succeeded'],
        ['cold', 'skipped'],
      ) as never,
    ).map((edge) => [edge.id, edge.class]);
    expect(classes).toEqual([
      ['eHot', 'stroke-primary'],
      ['eCold', 'stroke-border'],
    ]);

    // 源自己被跳过（它就没跑）时，它的出边同样不该亮
    const fromSkipped = toCanvasEdges(
      flow(),
      statusOf(['n1', 'skipped'], ['n2', 'pending']) as never,
    );
    expect(fromSkipped[0]?.class).toBe('stroke-border');
  });

  it('没有运行态时全部走中性色：类名与内联 stroke 同时给，只给类名会被 vue-flow 自带样式盖掉', () => {
    const edges = toCanvasEdges(flow());
    expect(edges.every((edge) => edge.class === 'stroke-border')).toBe(true);
    // 内联 style 落在 `<path>` 上，值只允许是 token（`hsl(var(--x))`），不许出现具体颜色
    expect(
      edges.every((edge) => edge.style.stroke === AI_EDGE_STROKE.idle),
    ).toBe(true);
    const serialized = JSON.stringify(edges);
    expect(serialized).not.toContain('#');
    expect(serialized).not.toContain('rgb');
  });

  it('边只带端点、id 与标签，不夹带节点 data', () => {
    const withLabel = def(
      [
        { data: { model: 'm' }, id: 'n1', type: 'llm' },
        { data: {}, id: 'n2', type: 'end' },
      ],
      [{ id: 'e1', label: '命中', source: 'n1', target: 'n2' }],
    );
    expect(toCanvasEdges(withLabel)).toEqual([
      {
        class: 'stroke-border',
        id: 'e1',
        label: '命中',
        source: 'n1',
        style: { stroke: AI_EDGE_STROKE.idle },
        target: 'n2',
      },
    ]);
  });

  it('未命中分支的边与走过分支的边在内联 stroke 上也分开：画布靠这一条涂色', () => {
    const branch = def(
      [
        { data: {}, id: 'route', type: 'condition' },
        { data: {}, id: 'hot', type: 'llm' },
        { data: {}, id: 'cold', type: 'llm' },
      ],
      [
        { id: 'eHot', source: 'route', target: 'hot' },
        { id: 'eCold', source: 'route', target: 'cold' },
      ],
    );
    const painted = toCanvasEdges(
      branch,
      statusOf(
        ['route', 'succeeded'],
        ['hot', 'succeeded'],
        ['cold', 'skipped'],
      ) as never,
    ).map((edge) => [edge.id, edge.style.stroke]);
    expect(painted).toEqual([
      ['eHot', AI_EDGE_STROKE.traversed],
      ['eCold', AI_EDGE_STROKE.idle],
    ]);
  });

  it('运行态里没有记录的节点（例如刚被删掉）不会被当成走过', () => {
    const edges = toCanvasEdges(
      flow(),
      statusOf(['ghost', 'succeeded']) as never,
    );
    expect(edges.map((edge) => edge.class)).toEqual([
      'stroke-border',
      'stroke-border',
    ]);
  });
});
