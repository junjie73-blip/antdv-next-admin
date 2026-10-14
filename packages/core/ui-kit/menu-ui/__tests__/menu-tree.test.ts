import type { MenuConfig } from '@antdv/types';

import { describe, expect, it } from 'vitest';

import {
  containsKey,
  isBranchSelected,
  toMenuNodes,
} from '../src/menu-tree';

/**
 * 三级树：目录 → 子目录 → 叶子。
 * mock 菜单里只有「组件示例 → 表单 → 基础表单」这条用到三级，
 * 缩进、截断、手风琴都要靠它验证，所以这里也照那个形状造。
 */
const tree: MenuConfig[] = [
  {
    children: [
      {
        children: [
          { name: 'BasicForm', path: '/demo/form/basic', title: '基础表单' },
          {
            disabled: true,
            name: 'StepForm',
            path: '/demo/form/step',
            title: '分步表单',
          },
        ],
        name: 'DemoForm',
        path: '',
        title: '表单',
      },
      {
        isExternal: true,
        name: 'AntdvDoc',
        path: 'https://antdv-next.com',
        title: '组件文档',
      },
    ],
    icon: 'carbon:apps',
    name: 'Demo',
    path: '',
    title: '组件示例',
  },
  { name: 'Dashboard', path: '/dashboard', title: '分析面板' },
  { hidden: true, name: 'Secret', path: '/secret', title: '隐藏页' },
];

describe('toMenuNodes —— 数据归一', () => {
  it('剔掉 hidden，其余按原顺序输出，depth 从 1 开始', () => {
    const nodes = toMenuNodes(tree);
    expect(nodes.map((node) => node.key)).toEqual(['Demo', 'Dashboard']);
    expect(nodes[0]!.children.map((node) => node.title)).toEqual([
      '表单',
      '组件文档',
    ]);
    expect(nodes[0]!.children[0]!.depth).toBe(2);
    expect(nodes[0]!.children[0]!.children[0]!.depth).toBe(3);
  });

  it('目录节点的 path 是空串：key 回退到 name，不能变成空 key', () => {
    // 后端目录只有 name，旧实现用 path 当 key 时全是 ''，点一个亮一串
    const nodes = toMenuNodes(tree);
    expect(nodes[0]!.key).toBe('Demo');
    expect(nodes[0]!.children[0]!.key).toBe('DemoForm');
  });

  it('maxDepth 截断后子树不再下探，被截断的目录算叶子（点击即导航）', () => {
    const nodes = toMenuNodes(tree, { maxDepth: 1 });
    expect(nodes[0]!.children).toHaveLength(0);
    expect(nodes[0]!.leaf).toBe(true);
    expect(nodes[1]!.leaf).toBe(true);
  });

  it('withChildren: false 时整棵树只剩一级', () => {
    const nodes = toMenuNodes(tree, { withChildren: false });
    expect(nodes.every((node) => node.children.length === 0)).toBe(true);
  });

  it('外链保留 isExternal 语义并带地址，普通项 external 为空', () => {
    const external = toMenuNodes(tree)[0]!.children[1]!;
    expect(external.external).toBe('https://antdv-next.com');
    expect(external.title).toBe('组件文档');
  });

  it('disabled 归一成布尔（缺省不是 undefined，模板里要能直接判）', () => {
    const nodes = toMenuNodes(tree);
    expect(nodes[0]!.disabled).toBe(false);
    expect(nodes[1]!.disabled).toBe(false);
    expect(nodes[0]!.children[0]!.children[1]!.disabled).toBe(true);
  });
});

describe('选中判定', () => {
  const nodes = toMenuNodes(tree);

  it('containsKey 只认渲染出来的子树（被截断的层级不算命中）', () => {
    expect(containsKey(nodes, 'BasicForm')).toBe(true);
    expect(containsKey(nodes, 'Secret')).toBe(false);
    expect(containsKey(toMenuNodes(tree, { maxDepth: 1 }), 'BasicForm')).toBe(
      false,
    );
    expect(containsKey(nodes, undefined)).toBe(false);
  });

  it('isBranchSelected：叶子命中时整条祖先链都算命中', () => {
    const branch = nodes[0]!;
    expect(isBranchSelected(branch, 'BasicForm')).toBe(true);
    expect(isBranchSelected(branch.children[0]!, 'BasicForm')).toBe(true);
    expect(isBranchSelected(branch, 'Dashboard')).toBe(false);
    // 自身就是选中项时也成立（横向栏选中的可能正是一级项）
    expect(isBranchSelected(nodes[1]!, 'Dashboard')).toBe(true);
  });
});
