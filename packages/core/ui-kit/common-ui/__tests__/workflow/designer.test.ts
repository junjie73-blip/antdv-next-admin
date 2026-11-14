import type { WorkflowDefinition } from '../../src/workflow/core/types';

import { describe, expect, it } from 'vitest';

import {
  addNode,
  autoLayout,
  bindBranch,
  branchView,
  cloneDefinition,
  connect,
  createEmptyDefinition,
  DESIGNER_NODE_KINDS,
  isKnownKind,
  moveNode,
  nodeKindMeta,
  outgoingEdges,
  patchNodeData,
  removeEdge,
  removeNode,
  renameNode,
  setAssignees,
  setDefaultBranchEdge,
  WorkflowDesignerError,
} from '../../src/workflow/core/designer';

/**
 * 设计器的语义层（`core/designer.ts`）是纯函数，所以这里一条 jsdom 都不需要。
 *
 * 这一层是设计器唯一"错了会悄悄丢数据"的地方：删节点没清引用、连线没判重复、
 * 自动布局不确定，表现都不是报错而是"流程跑得莫名其妙"。所以每条判据都写成
 * 可以直接讲给业务听的中文（"删掉审批节点后，分支和默认边跟着消失"），
 * 红了就知道是哪条产品约束被破。
 */

function def(overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition {
  return {
    edges: [{ id: 'e1', source: 'start', target: 'a' }],
    id: 'flow-test',
    name: '测试流程',
    nodes: [
      {
        data: {},
        id: 'start',
        label: '发起',
        position: { x: 0, y: 0 },
        type: 'start',
      },
      {
        data: {
          assignees: [{ params: { userIds: ['u1'] }, strategy: 'user' }],
        },
        id: 'a',
        label: '审批',
        position: { x: 200, y: 0 },
        type: 'approval',
      },
    ],
    version: 1,
    ...overrides,
  };
}

function expectDesignerError(action: () => unknown, code: string): void {
  let caught: unknown;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(WorkflowDesignerError);
  expect((caught as WorkflowDesignerError).code).toBe(code);
}

describe('类型表', () => {
  it('内置六类都在表里，且 start 唯一、end 不能作为起点', () => {
    const kinds = DESIGNER_NODE_KINDS.map((item) => item.kind);
    expect(kinds).toEqual([
      'start',
      'approval',
      'cc',
      'condition',
      'timer',
      'end',
    ]);
    expect(nodeKindMeta('start')).toMatchObject({
      singleton: true,
      targetable: false,
    });
    expect(nodeKindMeta('end')).toMatchObject({
      sourceable: false,
      targetable: true,
    });
    expect(isKnownKind('start')).toBe(true);
    expect(isKnownKind('erpSync')).toBe(false);
  });

  it('自定义类型拿到中性元数据而不是 undefined —— 画布不能因为不认识就崩', () => {
    const meta = nodeKindMeta('erpSync');
    expect(meta.hint).toContain('自定义');
    expect(meta.sourceable).toBe(true);
    expect(meta.targetable).toBe(true);
  });
});

describe('新建与新增节点', () => {
  it('空定义自带 start → end 一条边，中间允许是空的（草稿态）', () => {
    const created = createEmptyDefinition();
    expect(created.nodes.map((node) => node.type)).toEqual(['start', 'end']);
    expect(created.edges).toHaveLength(1);
    expect(created.id).toBe('flow-new');
  });

  it('按类型给初始 data：条件节点自带空分支，审批节点自带或签', () => {
    const { definition } = addNode(createEmptyDefinition(), {
      kind: 'condition',
    });
    const node = definition.nodes.find((item) => item.type === 'condition');
    expect(node?.data).toEqual({ branches: [], defaultEdgeId: undefined });

    const approval = addNode(createEmptyDefinition(), {
      kind: 'approval',
    }).definition;
    expect(
      approval.nodes.find((item) => item.type === 'approval')?.data,
    ).toMatchObject({
      multi: 'any',
      rejectTo: 'previous',
    });
  });

  it('同类型连加三个，id 是 approval_1/2/3 且不撞已有 id', () => {
    let current = createEmptyDefinition();
    const ids: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const result = addNode(current, { kind: 'approval' });
      ids.push(result.nodeId);
      current = result.definition;
    }
    expect(ids).toEqual(['approval_1', 'approval_2', 'approval_3']);
  });

  it('发起节点只允许一个', () => {
    expectDesignerError(
      () => addNode(createEmptyDefinition(), { kind: 'start' }),
      'node-protected',
    );
  });

  it('入参不被改写：所有编辑函数返回新对象', () => {
    const source = def({
      edges: [
        { id: 'e1', source: 'start', target: 'a' },
        { id: 'e2', source: 'a', target: 'end' },
      ],
      nodes: [...def().nodes, { data: {}, id: 'end', type: 'end' }],
    });
    const snapshot = cloneDefinition(source);
    addNode(source, { kind: 'cc' });
    renameNode(source, 'a', '改名');
    moveNode(source, 'a', { x: 999, y: 999 });
    connect(source, { id: 'e3', source: 'start', target: 'end' });
    removeNode(source, 'a');
    expect(source).toEqual(snapshot);
  });

  it('新节点落在最右列下方，堆满四行才整列右移', () => {
    let current = createEmptyDefinition();
    const ys: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      const result = addNode(current, { kind: 'approval' });
      current = result.definition;
      const node = current.nodes.find((item) => item.id === result.nodeId)!;
      ys.push(node.position!.y);
    }
    // start/end 占了 x=340 那一列的头两行，所以新节点从第三行接起，第四行之后整列右移
    expect(ys).toEqual([240, 360, 480, 120, 240, 360]);
  });
});

describe('连线', () => {
  it('正常连线：自动编号，交出来的边与定义里那条是两个对象', () => {
    const source = def({
      nodes: [...def().nodes, { data: {}, id: 'end', type: 'end' }],
    });
    const { definition, edge } = connect(source, {
      source: 'a',
      target: 'end',
    });
    expect(edge.id).toBe('edge_1');
    expect(definition.edges).toHaveLength(2);
    expect(definition.edges[1]).not.toBe(edge);
    edge.label = '改我也不会影响定义';
    expect(definition.edges[1]?.label).toBeUndefined();
  });

  it('拒自环、拒重复边', () => {
    const source = def();
    expectDesignerError(
      () => connect(source, { source: 'a', target: 'a' }),
      'self-loop',
    );
    expectDesignerError(
      () => connect(source, { source: 'start', target: 'a' }),
      'duplicate-edge',
    );
  });

  it('start 不能被连进来，end 不能往外连', () => {
    const source = def();
    expectDesignerError(
      () => connect(source, { source: 'a', target: 'start' }),
      'wrong-kind',
    );
    const withEnd = def({
      nodes: [...source.nodes, { data: {}, id: 'end', type: 'end' }],
    });
    expectDesignerError(
      () => connect(withEnd, { source: 'end', target: 'a' }),
      'wrong-kind',
    );
  });

  it('回连是合法的：加签/驳回回溯本来就画成往回的边', () => {
    const source = def({
      edges: [
        { id: 'e1', source: 'start', target: 'a' },
        { id: 'e2', source: 'a', target: 'b' },
      ],
      nodes: [
        { data: {}, id: 'start', type: 'start' },
        { data: {}, id: 'a', type: 'approval' },
        { data: {}, id: 'b', type: 'approval' },
      ],
    });
    const back = connect(source, { source: 'b', target: 'a' });
    expect(back.definition.edges).toHaveLength(3);
    // 引擎侧对此的口径见 validateWorkflowDefinition：环降为 warning，不拦上线
    expect(back.definition.edges[2]).toEqual({
      id: 'edge_1',
      source: 'b',
      target: 'a',
    });
  });

  it('未知端点当场报错，不静默生成悬空边', () => {
    expectDesignerError(
      () => connect(def(), { source: 'ghost', target: 'a' }),
      'unknown-node',
    );
    expectDesignerError(
      () => connect(def(), { source: 'a', target: 'ghost' }),
      'unknown-node',
    );
  });

  it('removeEdge 会把分支引用一起清掉', () => {
    const branchy = def({
      edges: [
        { id: 'e1', source: 'start', target: 'cond' },
        { id: 'e2', source: 'cond', target: 'a' },
      ],
      nodes: [
        { data: {}, id: 'start', type: 'start' },
        {
          data: {
            branches: [{ edgeId: 'e2', expression: 'days >= 3' }],
            defaultEdgeId: 'e2',
          },
          id: 'cond',
          type: 'condition',
        },
        { data: {}, id: 'a', type: 'approval' },
      ],
    });
    const next = removeEdge(branchy, 'e2');
    expect(next.edges.find((edge) => edge.id === 'e2')).toBeUndefined();
    const cond = next.nodes.find((node) => node.id === 'cond');
    expect(cond?.data?.branches).toEqual([]);
    expect(cond?.data?.defaultEdgeId).toBeUndefined();
  });
});

describe('删节点要顺手清引用', () => {
  const shaped = (): WorkflowDefinition =>
    def({
      edges: [
        { id: 'e1', source: 'start', target: 'cond' },
        { id: 'e2', source: 'cond', target: 'a' },
        { id: 'e3', source: 'cond', target: 'cc' },
      ],
      nodes: [
        { data: {}, id: 'start', type: 'start' },
        {
          data: {
            branches: [{ edgeId: 'e2', expression: 'x > 1' }],
            defaultEdgeId: 'e3',
          },
          id: 'cond',
          type: 'condition',
        },
        { data: { rejectTo: 'a' }, id: 'cc', type: 'cc' },
        { data: {}, id: 'a', type: 'approval' },
      ],
    });

  it('出入边随节点消失，并告知删了哪几条', () => {
    const { definition, removedEdgeIds } = removeNode(shaped(), 'a');
    expect(removedEdgeIds).toEqual(['e2']);
    expect(definition.nodes.map((node) => node.id)).toEqual([
      'start',
      'cond',
      'cc',
    ]);
    expect(definition.edges.map((edge) => edge.id)).toEqual(['e1', 'e3']);
  });

  it('别人的 rejectTo、条件分支、默认边都不留悬空引用', () => {
    const { definition } = removeNode(shaped(), 'a');
    expect(
      definition.nodes.find((node) => node.id === 'cc')?.data?.rejectTo,
    ).toBeUndefined();
    const cond = definition.nodes.find((node) => node.id === 'cond');
    expect(cond?.data?.branches).toEqual([]);
    expect(cond?.data?.defaultEdgeId).toBe('e3');
  });

  it('默认边随节点一起消失时才清掉', () => {
    const { definition } = removeNode(shaped(), 'cc');
    expect(
      definition.nodes.find((node) => node.id === 'cond')?.data?.defaultEdgeId,
    ).toBeUndefined();
  });

  it('发起节点删不掉；未知节点 id 报错而不是 no-op', () => {
    expectDesignerError(() => removeNode(shaped(), 'start'), 'node-protected');
    expectDesignerError(() => removeNode(shaped(), 'ghost'), 'unknown-node');
  });
});

describe('条件分支面板', () => {
  const withCond = (): WorkflowDefinition =>
    def({
      edges: [
        { id: 'e1', source: 'start', target: 'cond' },
        { id: 'e2', source: 'cond', target: 'a' },
        { id: 'e3', source: 'cond', target: 'other' },
      ],
      nodes: [
        { data: {}, id: 'start', type: 'start' },
        {
          data: {
            branches: [{ edgeId: 'e2', expression: 'days >= 3' }],
            defaultEdgeId: 'e1',
          },
          id: 'cond',
          type: 'condition',
        },
        { data: {}, id: 'a', type: 'approval' },
        { data: {}, id: 'other', type: 'cc' },
      ],
    });

  it('已绑定的按分支顺序给 target，未绑定只剩 e3', () => {
    const view = branchView(withCond(), 'cond');
    expect(view.bound).toEqual([
      { edgeId: 'e2', expression: 'days >= 3', target: 'a' },
    ]);
    expect(view.unbound.map((edge) => edge.id)).toEqual(['e3']);
    expect(view.defaultEdgeId).toBe('e1');
  });

  it('绑定新分支写进同一条出线而不是堆两条', () => {
    const once = bindBranch(withCond(), 'cond', {
      edgeId: 'e2',
      expression: 'days > 10',
    });
    const cond = once.nodes.find((node) => node.id === 'cond');
    expect(cond?.data?.branches).toEqual([
      { edgeId: 'e2', expression: 'days > 10' },
    ]);
    const twice = bindBranch(once, 'cond', {
      edgeId: 'e3',
      expression: 'true',
    });
    expect(
      twice.nodes.find((node) => node.id === 'cond')?.data?.branches,
    ).toHaveLength(2);
  });

  it('把别的节点的边绑进来会被拒 —— 分支只能是本节点的出线', () => {
    const other = def({
      edges: [{ id: 'e9', source: 'a', target: 'start' }],
      nodes: [
        { data: {}, id: 'start', type: 'start' },
        { data: { branches: [] }, id: 'cond', type: 'condition' },
        { data: {}, id: 'a', type: 'approval' },
      ],
    });
    expectDesignerError(
      () => bindBranch(other, 'cond', { edgeId: 'e9', expression: 'x' }),
      'unknown-edge',
    );
    expectDesignerError(
      () => bindBranch(withCond(), 'a', { edgeId: 'e2', expression: 'x' }),
      'wrong-kind',
    );
  });

  it('默认边可以置空；不存在的边不行', () => {
    const cleared = setDefaultBranchEdge(withCond(), 'cond', null);
    expect(
      cleared.nodes.find((node) => node.id === 'cond')?.data?.defaultEdgeId,
    ).toBeUndefined();
    expectDesignerError(
      () => setDefaultBranchEdge(withCond(), 'cond', 'nope'),
      'unknown-edge',
    );
  });

  it('outgoingEdges 只看本节点', () => {
    expect(outgoingEdges(withCond(), 'cond').map((edge) => edge.id)).toEqual([
      'e2',
      'e3',
    ]);
    expect(outgoingEdges(withCond(), 'a')).toEqual([]);
  });
});

describe('改 data 与办理人', () => {
  it('patchNodeData 只浅合并交上来的字段，其余保持原样', () => {
    const source = def();
    const next = patchNodeData(source, 'a', { timeoutMs: 5000 });
    const node = next.nodes.find((item) => item.id === 'a');
    expect(node?.data).toEqual({
      assignees: [{ params: { userIds: ['u1'] }, strategy: 'user' }],
      timeoutMs: 5000,
    });
  });

  it('setAssignees 是整体替换：面板传什么就是什么', () => {
    const next = setAssignees(def(), 'a', [{ strategy: 'initiator' }]);
    expect(next.nodes.find((item) => item.id === 'a')?.data?.assignees).toEqual(
      [{ strategy: 'initiator' }],
    );
  });

  it('改不存在的节点报错', () => {
    expectDesignerError(
      () => patchNodeData(def(), 'ghost', {}),
      'unknown-node',
    );
    expectDesignerError(() => renameNode(def(), 'ghost', 'x'), 'unknown-node');
    expectDesignerError(
      () => moveNode(def(), 'ghost', { x: 1, y: 1 }),
      'unknown-node',
    );
  });
});

describe('autoLayout', () => {
  const branchy = (): WorkflowDefinition =>
    def({
      edges: [
        { id: 'e1', source: 'start', target: 'cond' },
        { id: 'e2', source: 'cond', target: 'a' },
        { id: 'e3', source: 'cond', target: 'b' },
        { id: 'e4', source: 'a', target: 'end' },
        { id: 'e5', source: 'b', target: 'end' },
      ],
      nodes: [
        { data: {}, id: 'start', type: 'start' },
        { data: {}, id: 'cond', type: 'condition' },
        { data: {}, id: 'a', type: 'approval' },
        { data: {}, id: 'b', type: 'cc' },
        { data: {}, id: 'end', type: 'end' },
      ],
    });

  it('按最长路径分层：分支同层竖排，汇聚节点落在最后一列', () => {
    const laid = autoLayout(branchy());
    const at = (id: string) =>
      laid.nodes.find((node) => node.id === id)!.position!;
    expect(at('start').x).toBe(60);
    expect(at('cond').x).toBe(60 + 260);
    expect(at('a').x).toBe(at('b').x);
    expect(at('a').y).toBeLessThan(at('b').y);
    expect(at('end').x).toBe(60 + 260 * 3);
  });

  it('同样一张图跑两次坐标完全一致 —— 保存前才 diff 得出改了什么', () => {
    const first = autoLayout(branchy());
    const second = autoLayout(branchy());
    expect(second.nodes.map((node) => node.position)).toEqual(
      first.nodes.map((node) => node.position),
    );
    // 第二次是在"已经排过一遍的结果"上再排，同样不动
    expect(autoLayout(first).nodes.map((node) => node.position)).toEqual(
      first.nodes.map((node) => node.position),
    );
  });

  it('间距与起点可配，不影响层级', () => {
    const laid = autoLayout(branchy(), {
      columnGap: 100,
      origin: { x: 0, y: 0 },
      rowGap: 50,
    });
    expect(laid.nodes.find((node) => node.id === 'cond')!.position).toEqual({
      x: 100,
      y: 0,
    });
    expect(laid.nodes.find((node) => node.id === 'b')!.position!.y).toBe(50);
  });

  it('有环（驳回回溯画成边）时节点不会消失，补在最后一级', () => {
    const cyclic = branchy();
    cyclic.edges.push({ id: 'e6', source: 'end', target: 'a' });
    const laid = autoLayout(cyclic);
    expect(laid.nodes).toHaveLength(cyclic.nodes.length);
    for (const node of laid.nodes) {
      expect(node.position).toBeTruthy();
      expect(Number.isFinite(node.position!.x)).toBe(true);
      expect(Number.isFinite(node.position!.y)).toBe(true);
    }
  });

  it('没有坐标的孤立节点也会被摆放，不会留在 NaN 上', () => {
    const withOrphan = def({
      edges: [],
      nodes: [
        { data: {}, id: 'start', type: 'start' },
        { data: {}, id: 'lonely', type: 'approval' },
      ],
    });
    const laid = autoLayout(withOrphan);
    expect(laid.nodes.map((node) => node.position!.x)).toEqual([60, 60]);
    expect(laid.nodes.map((node) => node.position!.y)).toEqual([60, 180]);
  });

  /**
   * 画布是定高定宽的容器，一条八步的链排成八列有 2080 逻辑像素宽 ——
   * 缩到 minZoom 也只放得下一半，表现是"自动布局排完，右边那几个点也点不着"。
   * 所以默认每四列折一段，段内仍是"层级 = 列"。
   */
  it('长链折成四列一段：横向不超过一屏，段与段往下走且坐标互不重合', () => {
    const ids = ['n0', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7'];
    const chain = def({
      edges: ids
        .slice(1)
        .map((id, index) => ({
          id: `e${index}`,
          source: ids[index]!,
          target: id,
        })),
      nodes: ids.map((id, index) => ({
        data: {},
        id,
        type:
          index === 0
            ? ('start' as const)
            : index === 7
              ? ('end' as const)
              : ('approval' as const),
      })),
    });
    const laid = autoLayout(chain);
    const at = (id: string) =>
      laid.nodes.find((node) => node.id === id)!.position!;
    expect(at('n0')).toEqual({ x: 60, y: 60 });
    expect(at('n3')).toEqual({ x: 60 + 260 * 3, y: 60 });
    // 第五列回到最左边、往下换段（本段每列只有一个节点，所以段距就是一个 rowGap）
    expect(at('n4')).toEqual({ x: 60, y: 180 });
    expect(at('n7')).toEqual({ x: 60 + 260 * 3, y: 180 });
    // 占位盒是 260×120，两两坐标差只要有一段够长就不重合
    const points = laid.nodes.map((node) => node.position!);
    expect(new Set(points.map((point) => `${point.x},${point.y}`)).size).toBe(
      8,
    );
    // maxColumns 关掉换行时回到"层级就是列"
    const flat = autoLayout(chain, { maxColumns: 8 });
    expect(flat.nodes.map((node) => node.position!.x)).toEqual(
      ids.map((_, index) => 60 + index * 260),
    );
  });

  it('换段之后新节点的落点按几何避让：同一列有几段也不会压上去', () => {
    const laid = autoLayout(
      def({
        edges: [
          { id: 'e1', source: 'n0', target: 'n1' },
          { id: 'e2', source: 'n1', target: 'n2' },
          { id: 'e3', source: 'n2', target: 'n3' },
          { id: 'e4', source: 'n3', target: 'n4' },
        ],
        nodes: ['n0', 'n1', 'n2', 'n3', 'n4'].map((id, index) => ({
          data: {},
          id,
          type:
            index === 0
              ? ('start' as const)
              : index === 4
                ? ('end' as const)
                : ('approval' as const),
        })),
      }),
    );
    // 布局结果：n0..n3 在 y=60 那一行，n4 换段回到 x=60、y=180
    const added = addNode(laid, { kind: 'cc' }).definition.nodes.at(
      -1,
    )!.position!;
    const boxes = laid.nodes.map((node) => node.position!);
    expect(
      boxes.some(
        (box) =>
          Math.abs(box.x - added.x) < 260 && Math.abs(box.y - added.y) < 120,
      ),
    ).toBe(false);
  });
});
