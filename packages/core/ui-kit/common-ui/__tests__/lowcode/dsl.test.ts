import type { NodeSchema, PageSchema } from '../../src/lowcode/core/types';

import { describe, expect, it } from 'vitest';

import {
  builtinMaterials,
  cloneSchema,
  collectIds,
  containsId,
  createComponentRegistry,
  demoPageSchema,
  duplicateNode,
  findNode,
  fromFlatList,
  insertNode,
  locateNode,
  LowCodeDslError,
  maxDepthOf,
  moveNode,
  patchNode,
  removeNode,
  renewSubtreeIds,
  shiftNode,
  siblingsOf,
  toFlatList,
  validatePageSchema,
  walkSchema,
} from '../../src/lowcode/index';

/**
 * `dsl` 的测试口径：**每一步都要么返回新树、要么明确抛错**，绝不留「改了一半」的中间态 ——
 * 设计器的撤销栈完全依赖这一点，所以这里既断言结果形状，也断言旧引用没被动过。
 */

function tree(): NodeSchema[] {
  return [
    {
      children: [
        { id: 'a1', props: { text: '一' }, type: 'basic.text' },
        {
          id: 'a2',
          slots: {
            footer: [
              { id: 'a2f', props: { label: '底部' }, type: 'basic.button' },
            ],
          },
          type: 'basic.card',
        },
      ],
      id: 'a',
      props: { title: '卡片' },
      type: 'basic.card',
    },
    { id: 'b', type: 'basic.text' },
  ];
}

function page(
  treeNodes: NodeSchema[] = tree(),
  overrides: Partial<PageSchema> = {},
): PageSchema {
  return {
    dataSources: [],
    id: 'page-1',
    name: '测试页',
    state: {},
    tree: treeNodes,
    version: 1,
    ...overrides,
  };
}

const registry = createComponentRegistry(builtinMaterials);

describe('walkSchema / 定位', () => {
  it('前序遍历把 children 排在具名插槽之前，并带上完整的定位上下文', () => {
    const seen: Array<{
      depth: number;
      id: string;
      parentId: string | undefined;
      slot: string | undefined;
    }> = [];
    walkSchema(tree(), (node, ctx) => {
      seen.push({
        depth: ctx.depth,
        id: node.id,
        parentId: ctx.parentId,
        slot: ctx.slot,
      });
    });
    expect(seen.map((item) => item.id)).toEqual(['a', 'a1', 'a2', 'a2f', 'b']);
    expect(seen[3]).toEqual({
      depth: 2,
      id: 'a2f',
      parentId: 'a2',
      slot: 'footer',
    });
    expect(seen[4]).toEqual({
      depth: 0,
      id: 'b',
      parentId: undefined,
      slot: undefined,
    });
  });

  it('回调返回 false 只跳过该子树，不中断整体遍历', () => {
    const ids: string[] = [];
    walkSchema(tree(), (node) => {
      ids.push(node.id);
      return node.id === 'a' ? false : undefined;
    });
    expect(ids).toEqual(['a', 'b']);
  });

  it('findNode 只认 id，locateNode 还给出下标与 id 链', () => {
    const nodes = tree();
    expect(findNode(nodes, 'nope')?.id).toBeUndefined();
    expect(findNode(nodes, 'a2f')?.type).toBe('basic.button');
    const hit = locateNode(nodes, 'a2f');
    expect(hit?.index).toBe(0);
    expect(hit?.trail).toEqual(['a', 'a2', 'a2f']);
    expect(siblingsOf(nodes, 'a2f').map((item) => item.id)).toEqual(['a2f']);
    expect(siblingsOf(nodes, 'a1').map((item) => item.id)).toEqual([
      'a1',
      'a2',
    ]);
    expect(siblingsOf(nodes, 'b').map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('collectIds / maxDepthOf / containsId 覆盖插槽子树', () => {
    const nodes = tree();
    expect(collectIds(nodes)).toEqual(['a', 'a1', 'a2', 'a2f', 'b']);
    expect(maxDepthOf(nodes)).toBe(2);
    expect(containsId(nodes[0]!, 'a2f')).toBe(true);
    expect(containsId(nodes[1]!, 'a2f')).toBe(false);
  });
});

describe('clone', () => {
  it('克隆后的树与原文深相等，但改动不会漏回原树', () => {
    const source = page();
    const copy = cloneSchema(source);
    expect(copy).toEqual(source);
    (copy.tree[0]!.props as Record<string, unknown>).title = '改了';
    insertNode(copy.tree, { id: 'c', type: 'basic.text' });
    expect(source.tree[0]!.props?.title).toBe('卡片');
    expect(collectIds(source.tree)).toEqual(['a', 'a1', 'a2', 'a2f', 'b']);
  });
});

describe('insertNode', () => {
  it('缺省落在根级末尾，并且不改动传入的旧树', () => {
    const nodes = tree();
    const next = insertNode(nodes, {
      id: 'c',
      props: { text: '新节点' },
      type: 'basic.text',
    });
    expect(next.map((item) => item.id)).toEqual(['a', 'b', 'c']);
    expect(nodes).toHaveLength(2);
    expect(next).not.toBe(nodes);
  });

  it('inside / before / after 三种落点都按参照定位', () => {
    const nodes = tree();
    const inside = insertNode(
      nodes,
      { id: 'a3', type: 'basic.text' },
      { parentId: 'a', position: 'inside' },
    );
    expect(inside[0]!.children!.map((item) => item.id)).toEqual([
      'a1',
      'a2',
      'a3',
    ]);
    expect(locateNode(inside, 'a3')?.parentId).toBe('a');

    const before = insertNode(
      nodes,
      { id: 'x', type: 'basic.text' },
      { position: 'before', refId: 'a1', parentId: 'a' },
    );
    expect(before[0]!.children!.map((item) => item.id)).toEqual([
      'x',
      'a1',
      'a2',
    ]);

    const after = insertNode(
      nodes,
      { id: 'y', type: 'basic.text' },
      { position: 'after', refId: 'a2' },
    );
    expect(after[0]!.children!.map((item) => item.id)).toEqual([
      'a1',
      'a2',
      'y',
    ]);
  });

  it('只给 refId 且缺省 inside 时，把参照当父节点看待', () => {
    const next = insertNode(
      tree(),
      { id: 'g', type: 'basic.text' },
      { refId: 'a2' },
    );
    expect(next[0]!.children!.map((item) => item.id)).toEqual(['a1', 'a2']);
    const a2 = findNode(next, 'a2')!;
    expect(a2.children?.map((item) => item.id)).toEqual(['g']);
    expect(locateNode(next, 'g')?.parentId).toBe('a2');
  });

  it('落进具名插槽时写回 slots，而不是混进 children', () => {
    const next = insertNode(
      tree(),
      { id: 'g', type: 'basic.text' },
      { parentId: 'a2', slot: 'footer' },
    );
    const a2 = findNode(next, 'a2')!;
    expect(a2.children).toBeUndefined();
    expect(a2.slots?.footer?.map((item) => item.id)).toEqual(['a2f', 'g']);
  });

  it('id 撞车时自动给新子树换号，保证树内 id 唯一', () => {
    const nodes = tree();
    const next = insertNode(nodes, {
      children: [{ id: 'a1', type: 'basic.text' }],
      id: 'a',
      type: 'basic.card',
    });
    const ids = collectIds(next);
    // 原树 5 个 + 插入体 2 个；插入体一律换号，原件不动
    expect(ids).toHaveLength(7);
    expect(new Set(ids).size).toBe(7);
    expect(collectIds(nodes)).toEqual(['a', 'a1', 'a2', 'a2f', 'b']);
    const inserted = next[next.length - 1]!;
    expect(inserted.id).not.toBe('a');
    expect(inserted.children![0]!.id).not.toBe('a1');
  });

  it('父节点不存在 / 参照不存在都抛可诊断的错误而不是静默吞掉', () => {
    const nodes = tree();
    expect(() =>
      insertNode(nodes, { id: 'z', type: 'basic.text' }, { parentId: 'ghost' }),
    ).toThrowError(LowCodeDslError);
    try {
      insertNode(
        nodes,
        { id: 'z', type: 'basic.text' },
        { parentId: 'a', position: 'after', refId: 'ghost' },
      );
      expect.unreachable('应当抛错');
    } catch (error) {
      expect(LowCodeDslError.is(error)).toBe(true);
      expect((error as LowCodeDslError).code).toBe('not-found');
    }
  });
});

describe('removeNode / patchNode', () => {
  it('删除返回被摘掉的子树，撤销栈可以直接放回', () => {
    const nodes = tree();
    const { removed, tree: next } = removeNode(nodes, 'a2');
    expect(removed?.slots?.footer?.[0]?.id).toBe('a2f');
    expect(collectIds(next)).toEqual(['a', 'a1', 'b']);
    expect(nodes).toHaveLength(2);
  });

  it('删不存在的 id 时返回同一个数组引用', () => {
    const nodes = tree();
    expect(removeNode(nodes, 'ghost')).toEqual({
      removed: undefined,
      tree: nodes,
    });
  });

  it('patchNode 合并 props、保住 id，并把空 children 收掉', () => {
    const next = patchNode(tree(), 'a', {
      children: [],
      props: { description: '新描述' },
    });
    const a = findNode(next, 'a')!;
    expect(a.props).toEqual({ description: '新描述', title: '卡片' });
    expect(a.children).toBeUndefined();
    expect(a.id).toBe('a');
  });
});

describe('moveNode / shiftNode', () => {
  it('跨父移动把整棵子树一起搬走，原父节点不再持有它', () => {
    const next = moveNode(tree(), 'a1', { parentId: 'a2', position: 'inside' });
    expect(findNode(next, 'a1')).toBeDefined();
    expect(next[0]!.children!.map((item) => item.id)).toEqual(['a2']);
    const a2 = findNode(next, 'a2')!;
    expect(a2.children?.map((item) => item.id)).toEqual(['a1']);
    expect(a2.slots?.footer).toHaveLength(1);
  });

  it('同层重排：根级 b 挪到 a 前面', () => {
    const next = moveNode(tree(), 'b', { position: 'before', refId: 'a' });
    expect(next.map((item) => item.id)).toEqual(['b', 'a']);
  });

  it('拒绝把自己塞进自己的后代，也拒绝以自己为参照', () => {
    const nodes = tree();
    expect(() => moveNode(nodes, 'a', { parentId: 'a2' })).toThrowError(/子树/);
    try {
      moveNode(nodes, 'a', { parentId: 'a' });
      expect.unreachable('应当抛错');
    } catch (error) {
      expect((error as LowCodeDslError).code).toBe('cycle');
    }
    expect(() =>
      moveNode(nodes, 'b', { position: 'after', refId: 'b' }),
    ).toThrowError(/参照节点/);
  });

  it('shiftNode 到头就返回原引用，不越界', () => {
    const nodes = tree();
    const up = shiftNode(nodes, 'a', 'up');
    expect(up).toBe(nodes);
    const moved = shiftNode(nodes, 'b', 'up');
    expect(moved.map((item) => item.id)).toEqual(['b', 'a']);
    const inner = shiftNode(nodes, 'a2', 'down');
    expect(inner[0]!.children!.map((item) => item.id)).toEqual(['a1', 'a2']);
  });
});

describe('duplicateNode / renewSubtreeIds', () => {
  it('复制件紧跟原件，并且整棵子树的 id 全部换新的', () => {
    const nodes = tree();
    let seq = 0;
    const idFactory = (prefix: string) => `${prefix}-copy-${seq++}`;
    const { idMap, tree: next } = duplicateNode(nodes, 'a2', { idFactory });
    const a = next[0]!;
    expect(a.children?.map((item) => item.type)).toEqual([
      'basic.text',
      'basic.card',
      'basic.card',
    ]);
    const copy = a.children![2]!;
    expect(copy.id).toBe('node-copy-0');
    expect(idMap.a2).toBe('node-copy-0');
    expect(collectIds([copy])).toEqual(['node-copy-0', 'node-copy-1']);
    expect(a.children![1]!.id).toBe('a2');
  });

  it('renewSubtreeIds 对插槽子树同样换号', () => {
    const renewed = renewSubtreeIds(tree()[0]!, ['a', 'a1', 'a2', 'a2f', 'b']);
    const ids = collectIds([renewed.node]);
    expect(ids).toHaveLength(4);
    expect(ids.some((id) => ['a', 'a1', 'a2', 'a2f'].includes(id))).toBe(false);
    expect(Object.keys(renewed.idMap).sort()).toEqual(['a', 'a1', 'a2', 'a2f']);
  });
});

describe('toFlatList / fromFlatList', () => {
  it('拍平的行按 depth/parentId/slot/index 定位，并带 labelOf 的展示名', () => {
    const rows = toFlatList(tree(), {
      labelOf: (node) =>
        `${node.type}:${String(node.props?.title ?? node.props?.text ?? '')}`,
    });
    expect(rows.map((row) => row.node.id)).toEqual([
      'a',
      'a1',
      'a2',
      'a2f',
      'b',
    ]);
    expect(rows[3]!.depth).toBe(2);
    expect(rows[3]!.slot).toBe('footer');
    expect(rows[0]!.label).toBe('basic.card:卡片');
    expect(rows[1]!.label).toBe('basic.text:一');
  });

  it('maxDepth 只是渲染阀门，裁掉的层级不再出现', () => {
    const rows = toFlatList(tree(), { maxDepth: 1 });
    expect(rows.map((row) => row.node.id)).toEqual(['a', 'a1', 'a2', 'b']);
  });

  it('拍平再重建与原树完全相等（含插槽）', () => {
    const nodes = tree();
    expect(fromFlatList(toFlatList(nodes))).toEqual(nodes);
  });
});

describe('validatePageSchema', () => {
  it('结构完整的页面直接通过，errors 为空', () => {
    const result = validatePageSchema(page(), { registry });
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('重复 id 与未登记类型都是 error，并且指明是哪个节点', () => {
    const broken = [
      { id: 'a', type: 'basic.text' },
      { id: 'a', type: 'magic.unknown' },
    ];
    const result = validatePageSchema(page(broken), { registry });
    expect(result.valid).toBe(false);
    const codes = result.errors.map((item) => item.code);
    expect(codes).toContain('duplicate-id');
    expect(codes).toContain('unknown-type');
    expect(
      result.errors.find((item) => item.code === 'unknown-type')?.message,
    ).toContain('magic.unknown');
  });

  it('空页面与缺 id/名称只给告警，不拦保存', () => {
    const result = validatePageSchema({
      id: '',
      name: '',
      tree: [],
      version: 1,
    });
    expect(result.errors).toEqual([]);
    expect(result.warnings.map((item) => item.code)).toEqual(
      expect.arrayContaining(['empty-tree', 'invalid-node']),
    );
  });

  it('坏表达式与坏事件动作各自报清位置', () => {
    const nodes: NodeSchema[] = [
      { condition: '{{ form.name >>> }}', id: 'n1', type: 'basic.text' },
      {
        events: { click: 'frobnicate:form.name' },
        id: 'n2',
        type: 'basic.button',
      },
      { events: { click: 'refresh:not-here' }, id: 'n3', type: 'basic.button' },
    ];
    const result = validatePageSchema(page(nodes), { registry });
    const codes = result.errors.map((item) => item.code);
    expect(codes).toContain('bad-expression');
    expect(
      result.errors.some((item) =>
        item.message.includes('事件「click」的动作「frobnicate:form.name」'),
      ),
    ).toBe(true);
    expect(codes).toContain('unknown-datasource');
  });

  it('写原型链的路径一律拦下', () => {
    const nodes: NodeSchema[] = [
      {
        events: { click: 'set:__proto__.polluted' },
        id: 'n1',
        type: 'basic.button',
      },
    ];
    const result = validatePageSchema(page(nodes), { registry });
    expect(result.errors.map((item) => item.code)).toContain('unsafe-path');
  });

  it('深度上限既能全局配也能被物料自己的 maxDepth 收紧', () => {
    const deep: NodeSchema = { id: 'leaf', type: 'basic.text' };
    let wrap: NodeSchema = deep;
    for (let index = 0; index < 4; index += 1)
      wrap = { children: [wrap], id: `w${index}`, type: 'basic.card' };
    const loose = validatePageSchema(page([wrap]), { maxDepth: 24, registry });
    expect(loose.valid).toBe(true);
    const tight = validatePageSchema(page([wrap]), { maxDepth: 2, registry });
    expect(tight.errors.some((item) => item.code === 'depth-limit')).toBe(true);
  });

  it('非容器带子节点、未声明插槽只告警：渲染层仍会尽力渲染默认插槽', () => {
    const nodes: NodeSchema[] = [
      {
        children: [{ id: 'k', type: 'basic.text' }],
        id: 'text',
        props: { text: '我装不下' },
        type: 'basic.text',
      },
      {
        id: 'card',
        slots: { weird: [{ id: 'q', type: 'basic.text' }] },
        type: 'basic.card',
      },
    ];
    const result = validatePageSchema(page(nodes), { registry });
    const codes = result.warnings.map((item) => item.code);
    expect(codes).toContain('invalid-node');
    expect(codes).toContain('unknown-slot');
    expect(result.valid).toBe(true);
  });

  it('数据源的重复 id / 缺 url / 缺 handler / 依赖不存在都能被点名', () => {
    const result = validatePageSchema(
      page(undefined, {
        dataSources: [
          { id: 'dup', kind: 'static' },
          { id: 'dup', kind: 'static' },
          { id: 'no-url', kind: 'rest' },
          { id: 'no-handler', kind: 'function' },
          { dependsOn: ['ghost'], id: 'bad-dep', kind: 'static' },
          { id: '', kind: 'static' },
        ],
      }),
      { registry },
    );
    const codes = result.errors.map((item) => item.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        'duplicate-datasource',
        'invalid-datasource',
        'invalid-datasource',
        'unknown-dependency',
        'invalid-datasource',
      ]),
    );
    expect(codes.filter((code) => code === 'invalid-datasource')).toHaveLength(
      3,
    );
  });

  it('示例页在出厂注册表下体检干净，说明预设与校验口径对齐', () => {
    const result = validatePageSchema(demoPageSchema, { registry });
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.valid).toBe(true);
  });
});
