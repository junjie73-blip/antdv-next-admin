import type { MenuConfig } from '@antdv/types';

import { flattenMenus, matchEntries } from '../composables/useMenuSearch';

/**
 * 菜单搜索（Ctrl+K）的匹配逻辑测试。
 *
 * 这个功能以前是**假的**：顶栏搜索按钮和快捷键把一个从未渲染过的 ref 置真，
 * 按下去什么也不会发生。修复之后核心风险落在两处 ——
 * 一是"能不能搜到"（拍平与分词），二是"排在前面的是不是用户想去的那个"（打分）。
 * 所以测试全部围绕这两点写，DOM 与跳转交给 e2e 覆盖。
 */

const MENUS: MenuConfig[] = [
  {
    icon: 'carbon:dashboard',
    name: 'Dashboard',
    path: '/dashboard',
    title: '仪表盘',
  },
  {
    name: 'System',
    path: '/system',
    title: '系统管理',
    children: [
      { name: 'SystemUser', path: '/system/user', title: '用户管理' },
      { name: 'SystemRole', path: '/system/role', title: '角色管理' },
      {
        hidden: true,
        name: 'SystemDept',
        path: '/system/dept',
        title: '部门管理',
      },
    ],
  },
  {
    // 纯分组节点：没有 path，不该进入候选
    name: 'Group',
    path: '',
    title: '分组占位',
    children: [
      {
        isExternal: true,
        name: 'Docs',
        path: 'https://antdv.com/components/table-cn',
        title: '组件文档',
      },
    ],
  },
  {
    hidden: true,
    name: 'Profile',
    path: '/profile',
    title: '个人中心',
  },
];

describe('flattenMenus', () => {
  it('只保留可跳转的叶子，并带上父级层级', () => {
    const entries = flattenMenus(MENUS);
    const paths = entries.map((entry) => entry.path);

    expect(paths).toEqual([
      '/dashboard',
      '/system/user',
      '/system/role',
      '/system/dept',
      'https://antdv.com/components/table-cn',
      '/profile',
    ]);
    // 分组占位（无 path）被丢弃，父级节点本身也不该出现在结果里
    expect(paths).not.toContain('/system');
    expect(paths).not.toContain('');
  });

  it('breadcrumb 是"去掉末级"的层级路径', () => {
    const entries = flattenMenus(MENUS);
    const user = entries.find((entry) => entry.path === '/system/user');
    const dashboard = entries.find((entry) => entry.path === '/dashboard');

    expect(user?.breadcrumb).toBe('系统管理');
    // 顶层页面没有父级，breadcrumb 为空串（组件里会退化成显示 path）
    expect(dashboard?.breadcrumb).toBe('');
  });

  it('把 hidden 与外链标记保留下来，供 UI 区分处理', () => {
    const entries = flattenMenus(MENUS);
    expect(entries.find((entry) => entry.path === '/system/dept')?.hidden).toBe(
      true,
    );
    expect(entries.find((entry) => entry.path === '/profile')?.external).toBe(
      false,
    );
    expect(
      entries.find((entry) => entry.external)?.path,
    ).toMatch(/^https:\/\//);
  });

  it('空菜单返回空数组，不抛异常', () => {
    expect(flattenMenus([])).toEqual([]);
  });
});

describe('matchEntries', () => {
  const entries = flattenMenus(MENUS);

  it('空关键词时导航可见的排在隐藏页前面', () => {
    const titles = matchEntries(entries, '').map((entry) => entry.title);
    expect(titles[0]).toBe('仪表盘');
    expect(titles).toContain('用户管理');
    // 两个 hidden 项垫到最后，顺序彼此无关紧要
    expect(titles.slice(-2).sort()).toEqual(['个人中心', '部门管理']);
  });

  it('中文标题能命中', () => {
    expect(matchEntries(entries, '用户').map((entry) => entry.path)).toEqual([
      '/system/user',
    ]);
  });

  it('英文路径同样能命中（中英混排后台的基本诉求）', () => {
    expect(matchEntries(entries, 'role').map((entry) => entry.path)).toEqual([
      '/system/role',
    ]);
  });

  it('层级也参与匹配，所以「系统 部门」能找到导航里不显示的页面', () => {
    expect(matchEntries(entries, '系统 部门').map((entry) => entry.path)).toEqual(
      ['/system/dept'],
    );
  });

  it('多段关键词是与的关系，任一段不命中就整体排除', () => {
    expect(matchEntries(entries, '用户 角色')).toEqual([]);
  });

  it('标题前缀命中排在标题包含之前', () => {
    const hits = matchEntries(entries, '管理');
    // 「用户管理 / 角色管理 / 部门管理」都是"包含"，得分相同，
    // 此时可见性决定次序：hidden 的部门管理排到最后
    expect(hits.map((entry) => entry.path)).toEqual([
      '/system/user',
      '/system/role',
      '/system/dept',
    ]);

    const prefix = matchEntries(
      [
        { ...entries[1]!, title: '用户中心', path: '/uc' },
        { ...entries[1]!, title: '访问用户管理', path: '/visit' },
      ],
      '用户',
    );
    expect(prefix.map((entry) => entry.path)).toEqual(['/uc', '/visit']);
  });

  it('忽略大小写与首尾空格', () => {
    expect(matchEntries(entries, '  Dashboard ').map((entry) => entry.path)).toEqual(
      ['/dashboard'],
    );
  });

  it('limit 截断候选数量', () => {
    expect(matchEntries(entries, '管理', 1)).toHaveLength(1);
  });

  it('无匹配时返回空数组（组件据此展示空态）', () => {
    expect(matchEntries(entries, '不存在的东西')).toEqual([]);
  });
});
