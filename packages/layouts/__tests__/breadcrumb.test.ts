import type { MenuConfig } from '@antdv/types';

import { describe, expect, it } from 'vitest';

import {
  activeTopMenuKey,
  createBreadcrumbSource,
  shouldShowBreadcrumb,
} from '../src/breadcrumb';

const MENUS: MenuConfig[] = [
  {
    icon: 'carbon:dashboard',
    name: 'dashboard',
    path: '/dashboard',
    title: '仪表盘',
    // 页面自己在 `<route>` 里写的是「系统分析」，菜单写的是「分析面板」：
    // 两边都有名字时以菜单为准，面包屑才和侧栏说同一句话。
    children: [{ name: 'analysis', path: '/dashboard/analysis', title: '分析面板' }],
  },
  {
    name: 'system',
    path: '/system',
    title: '系统管理',
    children: [
      {
        name: 'user',
        path: '/system/user-manage',
        title: '用户管理',
        children: [
          { icon: 'user', name: 'user-list', path: '/system/user', title: '用户列表' },
        ],
      },
      // 导航里不出现，但从地址栏/标签页进得来：面包屑与一级归属都要认得它
      { hidden: true, name: 'dept', path: '/system/dept', title: '部门管理' },
    ],
  },
];

describe('面包屑来源', () => {
  /**
   * 面包屑回答的是"我在导航的哪一格"，所以层级、名称、图标必须和侧栏同源。
   * 路由 `meta.title` 退居兜底：它只有叶子声明得过，父子都会缺，
   * 于是老逻辑会把四级菜单砍成一级（见本文件顶部的注释）。
   */
  it('菜单链优先：层级与图标都取自导航本身', () => {
    const crumbs = createBreadcrumbSource({
      menus: () => MENUS,
      route: () => ({
        matched: [
          { meta: {}, path: '/' },
          { meta: { title: '系统管理' }, path: '/system' },
          { meta: { icon: 'user', title: '用户列表' }, path: '/system/user' },
        ],
        name: 'user-list',
        path: '/system/user',
      }),
    });
    expect(crumbs.value).toEqual([
      { path: '/system', title: '系统管理' },
      { path: '/system/user-manage', title: '用户管理' },
      { icon: 'user', path: '/system/user', title: '用户列表' },
    ]);
  });

  /**
   * 登录落到的首页是这条缺陷最扎眼的现场：
   * 文件约定路由只有叶子写了 `meta.title`（且写的是页面自己的名字），
   * 按旧优先级只剩一级，再被"只有一级就不显示"的偏好一滤，
   * 顶栏的面包屑整条消失（用户读作"第一次进页面面包屑没加载出来"）。
   */
  it('只有叶子声明了 meta.title 时不能砍掉父级', () => {
    const crumbs = createBreadcrumbSource({
      menus: () => MENUS,
      route: () => ({
        matched: [
          { meta: {}, path: '/dashboard' },
          { meta: { title: '系统分析' }, path: '/dashboard/analysis' },
        ],
        name: 'analysis',
        path: '/dashboard/analysis',
      }),
    });
    expect(crumbs.value).toEqual([
      { icon: 'carbon:dashboard', path: '/dashboard', title: '仪表盘' },
      { path: '/dashboard/analysis', title: '分析面板' },
    ]);
  });

  it('菜单还没加载（或未登录）时退回路由 meta.title，不是一片空白', () => {
    const crumbs = createBreadcrumbSource({
      menus: () => [],
      route: () => ({
        matched: [
          { meta: { icon: 'carbon:login', title: '登录' }, path: '/login' },
        ],
        name: 'login',
        path: '/login',
      }),
    });
    expect(crumbs.value).toEqual([
      { icon: 'carbon:login', path: '/login', title: '登录' },
    ]);
  });

  it('name 不同源就按 path 反查，尾斜杠不该让一级面包屑掉队', () => {
    const crumbs = createBreadcrumbSource({
      menus: () => MENUS,
      route: () => ({
        matched: [],
        name: '/system/user/',
        path: '/system/user/',
      }),
    });
    expect(crumbs.value.map((item) => item.title)).toEqual([
      '系统管理',
      '用户管理',
      '用户列表',
    ]);
  });

  it('菜单里没有的路由（如 404 页）给出一条空面包屑而不是报错', () => {
    const crumbs = createBreadcrumbSource({
      menus: () => MENUS,
      route: () => ({ name: 'nowhere', path: '/nowhere' }),
    });
    expect(crumbs.value).toEqual([]);
  });

  /**
   * 「隐藏」的语义是导航里不出现，不是页面不存在。
   * 直达 / 从标签页回到隐藏页时，面包屑仍然要给出「系统管理 / 部门管理」，
   * 否则用户站在页面中央却不知道自己在哪。
   */
  it('隐藏页反查祖先链：导航里查无此项，面包屑照样认得路', () => {
    const crumbs = createBreadcrumbSource({
      menus: () => MENUS,
      route: () => ({ name: 'dept', path: '/system/dept' }),
    });
    expect(crumbs.value.map((item) => item.title)).toEqual([
      '系统管理',
      '部门管理',
    ]);
  });

  it('菜单节点没有名字时不占一格，避免面包屑出现空气泡', () => {
    const crumbs = createBreadcrumbSource({
      menus: () => [
        {
          name: 'anon',
          path: '/anon',
          title: '',
        },
      ],
      route: () => ({ name: 'anon', path: '/anon' }),
    });
    expect(crumbs.value).toEqual([]);
  });

  it('meta.title 是数字之类的脏值时按无标题处理', () => {
    const crumbs = createBreadcrumbSource({
      menus: () => [],
      route: () => ({
        matched: [{ meta: { title: 42 }, path: '/x' }],
        path: '/x',
      }),
    });
    expect(crumbs.value).toEqual([]);
  });
});

describe('面包屑显示规则', () => {
  const items = [
    { path: '/a', title: 'A' },
    { path: '/a/b', title: 'B' },
  ];

  it('关掉开关或没有内容都不显示', () => {
    expect(shouldShowBreadcrumb(items)).toBe(true);
    expect(shouldShowBreadcrumb(items, { enabled: false })).toBe(false);
    expect(shouldShowBreadcrumb([], { hideWhenOnlyOne: true })).toBe(false);
  });

  it('只有一级时按 hideWhenOnlyOne 决定', () => {
    expect(shouldShowBreadcrumb([items[0]!])).toBe(true);
    expect(shouldShowBreadcrumb([items[0]!], { hideWhenOnlyOne: true })).toBe(
      false,
    );
    expect(shouldShowBreadcrumb(items, { hideWhenOnlyOne: true })).toBe(true);
  });
});

describe('当前一级菜单 key', () => {
  it('按 path 反查链首，与顶栏/图标栏共用 menuKeyOf', () => {
    expect(activeTopMenuKey(MENUS, '/system/user')).toBe('system');
    expect(activeTopMenuKey(MENUS, '/dashboard')).toBe('dashboard');
    expect(activeTopMenuKey(MENUS, '/nowhere')).toBeUndefined();
  });

  it('隐藏页也要能归到它可见的一级菜单（图标栏高亮不能因为查不到而变灰）', () => {
    expect(activeTopMenuKey(MENUS, '/system/dept')).toBe('system');
  });
});
