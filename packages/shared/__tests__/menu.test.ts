import type { MenuConfig } from '@antdv/types';

import type { BuildMenuItemsOptions } from '../src/menu';

import { describe, expect, it } from 'vitest';

import {
  attachMenuPaths,
  buildMenuItems,
  collectMenuKeys,
  collectSubmenuKeys,
  findAncestorKeys,
  findMenuByKey,
  findMenuByName,
  findMenuByPath,
  findMenuChain,
  findTopLevelMenu,
  firstLeafMenu,
  flattenLeafMenus,
  isBuiltinMenuName,
  isBuiltinMenuPath,
  isExternalPath,
  isLeafMenu,
  joinMenuPath,
  menuKeyOf,
  normalizeMenuPath,
  visibleMenus,
  visibleMenuTree,
} from '../src/menu';

/**
 * 后端菜单的真实形状：目录节点只有 name + menuName，没有 path。
 * 这正是「点一个亮一串」的根源 —— key 全落在 undefined 上。
 */
function makeMenus(): MenuConfig[] {
  return [
    {
      name: 'System',
      path: '',
      title: '系统管理',
      children: [
        {
          name: 'UserList',
          path: '/system/user',
          title: '用户管理',
        },
        {
          name: 'RoleList',
          path: '/system/role',
          title: '角色管理',
          hidden: true,
        },
        {
          name: 'DictGroup',
          path: '',
          title: '字典分组',
          children: [
            { name: 'DictList', path: '/system/dict', title: '字典管理' },
          ],
        },
      ],
    },
    {
      // 没有 name，只能回退到 title
      path: '',
      title: '监控',
      children: [{ name: 'Online', path: '/monitor/online', title: '在线用户' }],
    },
    { name: 'Hidden', path: '', title: '隐藏的顶级', hidden: true },
  ];
}

describe('menuKeyOf', () => {
  it('name 优先，其次 path，最后 title', () => {
    expect(menuKeyOf({ name: 'A', path: '/a', title: '甲' })).toBe('A');
    expect(menuKeyOf({ path: '/a', title: '甲' })).toBe('/a');
    expect(menuKeyOf({ path: '', title: '甲' })).toBe('甲');
  });

  it('同级 key 不再重复：无 name 的节点用 title 兜底', () => {
    const menus = makeMenus();
    const topKeys = visibleMenus(menus).map((m) => menuKeyOf(m));
    expect(new Set(topKeys).size).toBe(topKeys.length);
    expect(topKeys).toEqual(['System', '监控']);
  });
});

describe('visibleMenus / isLeafMenu', () => {
  const menus = makeMenus();

  it('过滤 hidden 且保持顺序', () => {
    expect(menus.map((m) => m.title)).toEqual(['系统管理', '监控', '隐藏的顶级']);
    expect(visibleMenus(menus).map((m) => m.title)).toEqual(['系统管理', '监控']);
    expect(visibleMenus(undefined)).toEqual([]);
  });

  it('只有可见子节点才算目录（子项全隐藏即为叶子）', () => {
    const system = menus[0]!;
    expect(isLeafMenu(system)).toBe(false);
    const dict = findMenuByName(menus, 'DictGroup')!;
    expect(isLeafMenu(dict)).toBe(false);
    const onlyHidden: MenuConfig = {
      path: '/x',
      title: 'X',
      children: [{ path: '/x/y', title: 'Y', hidden: true }],
    };
    expect(isLeafMenu(onlyHidden)).toBe(true);
  });
});

describe('查找与祖先链', () => {
  const menus = makeMenus();

  it('findMenuChain 返回含自身的祖先链', () => {
    const chain = findMenuChain(menus, (m) => m.name === 'DictList');
    expect(chain.map((m) => menuKeyOf(m))).toEqual([
      'System',
      'DictGroup',
      'DictList',
    ]);
  });

  it('隐藏节点不参与查找（避免选中到不存在的菜单）', () => {
    expect(findMenuByName(menus, 'RoleList')).toBeUndefined();
    expect(findMenuByKey(menus, 'RoleList')).toBeUndefined();
  });

  it('按 key / name / path 查同一节点', () => {
    const byKey = findMenuByKey(menus, 'UserList');
    expect(byKey?.title).toBe('用户管理');
    expect(findMenuByPath(menus, '/system/dict')?.name).toBe('DictList');
    expect(findMenuByKey(menus, undefined)).toBeUndefined();
    expect(findMenuByPath(menus, '/nope')).toBeUndefined();
  });

  it('findAncestorKeys 不含自身，用于 openKeys', () => {
    expect(findAncestorKeys(menus, 'DictList')).toEqual(['System', 'DictGroup']);
    expect(findAncestorKeys(menus, 'System')).toEqual([]);
    expect(findAncestorKeys(menus)).toEqual([]);
  });
});

describe('findTopLevelMenu', () => {
  const menus = makeMenus();

  it('深层子节点也能回溯到一级菜单', () => {
    const top = findTopLevelMenu(menus, (m) => m.name === 'DictList');
    expect(top?.title).toBe('系统管理');
  });

  it('命中无 name 的一级菜单', () => {
    const top = findTopLevelMenu(menus, (m) => m.name === 'Online');
    expect(top?.title).toBe('监控');
  });

  it('找不到返回 undefined', () => {
    expect(findTopLevelMenu(menus, (m) => m.name === 'Ghost')).toBeUndefined();
  });
});

describe('叶子遍历', () => {
  const menus = makeMenus();

  it('firstLeafMenu 跳过目录与隐藏项', () => {
    expect(firstLeafMenu(menus[0]!)?.name).toBe('UserList');
    expect(firstLeafMenu(menus[1]!)?.name).toBe('Online');
    expect(firstLeafMenu(menus[2]!)).toBeUndefined();
    expect(firstLeafMenu(undefined)).toBeUndefined();
  });

  it('flattenLeafMenus 顺序与菜单一致且不含隐藏项', () => {
    expect(flattenLeafMenus(menus).map((m) => m.name)).toEqual([
      'UserList',
      'DictList',
      'Online',
    ]);
  });

  it('collectSubmenuKeys 只收集可展开父级', () => {
    // 监控 只有一个可见子节点，同样是可展开父级
    expect(collectSubmenuKeys(menus)).toEqual(['System', 'DictGroup', '监控']);
  });
});

/** antd 的 items 是联合类型（含 divider/group），测试里只关心这几项 */
interface Item {
  children?: Item[];
  disabled?: boolean;
  icon?: unknown;
  key?: string;
  label?: unknown;
}

function build(menus: MenuConfig[], options?: BuildMenuItemsOptions): Item[] {
  return buildMenuItems(menus, options) as unknown as Item[];
}

describe('buildMenuItems', () => {
  const menus = makeMenus();

  it('key 唯一，杜绝多选中', () => {
    const keys = build(menus).map((item) => item.key);
    expect(keys).toEqual(['System', '监控']);
    expect(new Set(keys).size).toBe(2);
  });

  it('maxDepth=1 时一级导航不带 children（子项交给侧边栏）', () => {
    const [system] = build(menus, { maxDepth: 1 });
    expect(system?.children).toBeUndefined();
  });

  it('默认递归展开，隐藏子项被过滤', () => {
    const [system] = build(menus);
    expect((system?.children ?? []).map((child) => child.key)).toEqual([
      'UserList',
      'DictGroup',
    ]);
    const dict = system?.children?.[1];
    expect((dict?.children ?? []).map((child) => child.key)).toEqual([
      'DictList',
    ]);
  });

  it('withChildren=false 彻底不带子节点', () => {
    const [system] = build(menus, { withChildren: false });
    expect(system?.children).toBeUndefined();
  });

  it('保留 disabled，并为图标生成渲染函数', () => {
    const withIcon: MenuConfig[] = [
      {
        name: 'A',
        path: '/a',
        title: '甲',
        icon: 'lucide:settings',
        disabled: true,
      },
    ];
    const [item] = build(withIcon);
    expect(item!.disabled).toBe(true);
    expect(typeof item!.icon).toBe('function');
    expect(item!.key).toBe('A');
  });

  /**
   * 侧边栏的图标槽位（`keepIconSlot`）。
   *
   * 需求原话是"菜单的样式有点问题"，根子在这一列里有的项有图标、有的没有：
   * 没图标那一项的文字左边缘就比邻居更靠左，整列看起来参差。
   * 这里钉住契约 —— 开了开关，**每一项**都拿到图标渲染器，缺图标的用空 span 占位，
   * 槽位宽度由 antd 的 `.ant-menu-item-icon`（`min-width` 来自 iconSize token）决定，
   * 所以和真图标严格等宽，不需要在样式里猜像素。
   */
  it('keepIconSlot：每一项都有图标渲染器，缺图标的渲染成空槽', () => {
    const tree: MenuConfig[] = [
      {
        name: 'Group',
        path: '',
        title: '分组',
        children: [
          { name: 'A', path: '/a', title: '甲' },
          { name: 'B', path: '/b', title: '乙', icon: 'lucide:settings' },
        ],
      },
    ];

    const [group] = build(tree, { keepIconSlot: true });
    // 目录节点自己也要占位，否则"有图标的目录"和"没图标的目录"标题不齐
    expect(typeof group!.icon).toBe('function');
    const children = group!.children ?? [];
    expect(children).toHaveLength(2);
    expect(
      children.every((child) => typeof child.icon === 'function'),
      '开了空槽后不该再有项缺 icon',
    ).toBe(true);

    // 没图标 → 裸 span（占位，不画任何东西）
    const slot = (children[0]!.icon as () => { type: unknown })();
    expect(slot.type).toBe('span');
    // 有图标 → 图标组件，不能被空槽覆盖掉
    const real = (children[1]!.icon as () => { type: unknown })();
    expect(typeof real.type).not.toBe('string');
  });

  /**
   * 反向契约：默认不开空槽。
   * 顶栏横向导航按内容宽度排布，没图标就是不该留一格空白 —— 宽度要留给文字，
   * 否则溢出时白白少显示一项（横向滚动那条链依赖"总量尽量小"）。
   */
  it('默认不占图标槽', () => {
    const [group] = build([
      {
        name: 'Group',
        path: '',
        title: '分组',
        children: [{ name: 'A', path: '/a', title: '甲' }],
      },
    ]);
    expect(group!.icon).toBeUndefined();
    expect(group!.children![0]!.icon).toBeUndefined();
  });
});

describe('attachMenuPaths', () => {
  /** 只用到 hasRoute/resolve 两个方法，构造最小 router */
  const router = {
    hasRoute: (name: string) => name !== 'Ghost',
    resolve: (to: { name: string }) => ({
      path: `/resolved/${to.name}`,
    }),
  } as never;

  it('用路由表补全缺失的 path，且不修改原对象', () => {
    const menus = makeMenus();
    const next = attachMenuPaths(menus, router);
    expect(next[0]!.path).toBe('/resolved/System');
    // 没有 name 的节点无从反查，保持原样
    expect(next[1]!.path).toBe('');
    // 已有 path 的节点保持不变
    const user = findMenuByName(next, 'UserList');
    expect(user?.path).toBe('/system/user');
    // 原数组不应被写回
    expect(menus[0]!.path).toBe('');
  });

  it('补全后 key 仍然稳定（name 优先）', () => {
    const next = attachMenuPaths(makeMenus(), router);
    expect(visibleMenus(next).map((m) => menuKeyOf(m))).toEqual([
      'System',
      '监控',
    ]);
  });

  it('name 不在路由表里时保持空 path，key 仍用 name', () => {
    const menus: MenuConfig[] = [{ path: '', title: '幽灵', name: 'Ghost' }];
    const [item] = attachMenuPaths(menus, router);
    expect(item!.path).toBe('');
    expect(menuKeyOf(item!)).toBe('Ghost');
  });
});

describe('attachMenuPaths：文件约定式路由下的路径解析', () => {
  /**
   * 模拟 unplugin-vue-router 的产物：记录 path 不带结尾斜杠，
   * 但自动生成的 name 带（`/system/user/`），和业务菜单的 name 完全不同源。
   */
  const fileRouter = {
    getRoutes: () => [
      { path: '/system' },
      { path: '/system/user/' },
      { path: '/system/role/' },
      { path: '/system/dict/' },
      { path: '/account/settings/' },
      { path: '/system/settings/' },
      { path: '/error/404' },
      { path: '/:pathMatch(.*)*' },
    ],
    hasRoute: () => false,
    resolve: (to: { name: string }) => ({ path: `/${to.name}` }),
  } as never;

  it('父级绝对 + 子级相对片段：拼成路由表里存在的完整 path', () => {
    const menus: MenuConfig[] = [
      {
        name: 'SystemManage',
        path: '/system',
        title: '系统管理',
        children: [{ name: 'SystemUser', path: 'user', title: '用户管理' }],
      },
    ];
    const [system] = attachMenuPaths(menus, fileRouter);
    expect(findMenuByName(system!.children!, 'SystemUser')?.path).toBe(
      '/system/user',
    );
  });

  it('父级没有 path：靠末级片段在路由表里唯一命中', () => {
    const menus: MenuConfig[] = [
      {
        name: 'Tool',
        path: '',
        title: '系统工具',
        children: [{ name: 'ToolDict', path: 'dict', title: '数据字典' }],
      },
    ];
    const [tool] = attachMenuPaths(menus, fileRouter);
    expect(findMenuByName(tool!.children!, 'ToolDict')?.path).toBe(
      '/system/dict',
    );
  });

  it('片段有歧义时不乱猜；父级能消歧就按父级拼', () => {
    const menus: MenuConfig[] = [
      {
        name: 'Account',
        path: '',
        title: '个人中心',
        children: [
          { name: 'AccountSettings', path: 'settings', title: '账户设置' },
        ],
      },
      {
        name: 'Tool',
        path: '/system',
        title: '系统工具',
        children: [{ name: 'ToolSettings', path: 'settings', title: '系统设置' }],
      },
    ];
    const [account, tool] = attachMenuPaths(menus, fileRouter);
    // 'settings' 同时命中 /account/settings 与 /system/settings：宁可不猜，
    // 也不要把用户领到一个"看起来对但可能是另一个"的页面
    expect(findMenuByName(account!.children!, 'AccountSettings')?.path).toBe(
      '/settings',
    );
    // 父级 /system 能消歧
    expect(findMenuByName(tool!.children!, 'ToolSettings')?.path).toBe(
      '/system/settings',
    );
  });

  it('外链原样保留，不会被补成 /https://…', () => {
    const menus: MenuConfig[] = [
      {
        isExternal: true,
        name: 'Docs',
        path: 'https://antdv-next.com/',
        title: '组件文档',
      },
    ];
    const [docs] = attachMenuPaths(menus, fileRouter);
    expect(docs!.path).toBe('https://antdv-next.com/');
  });

  it('解析结果能直接喂给按 path 的查找（结尾斜杠已归一化）', () => {
    const menus: MenuConfig[] = [
      {
        name: 'SystemManage',
        path: '/system',
        title: '系统管理',
        children: [{ name: 'SystemUser', path: 'user', title: '用户管理' }],
      },
    ];
    const next = attachMenuPaths(menus, fileRouter);
    expect(findMenuByPath(next, '/system/user/')?.name).toBe('SystemUser');
    expect(findMenuByPath(next, '/system/user')?.name).toBe('SystemUser');
  });
});

describe('normalizeMenuPath / joinMenuPath', () => {
  it('补前导斜杠、去结尾斜杠，根路径与外链例外', () => {
    expect(normalizeMenuPath('system/user')).toBe('/system/user');
    expect(normalizeMenuPath('/system/user/')).toBe('/system/user');
    expect(normalizeMenuPath('/system/user///')).toBe('/system/user');
    expect(normalizeMenuPath('/')).toBe('/');
    expect(normalizeMenuPath('')).toBe('');
    expect(normalizeMenuPath('https://a.com/x/')).toBe('https://a.com/x/');
    expect(normalizeMenuPath('//cdn.a.com/x')).toBe('//cdn.a.com/x');
  });

  it('子项以 / 开头视为绝对路径，否则挂到父级下', () => {
    expect(joinMenuPath('/system', 'user')).toBe('/system/user');
    expect(joinMenuPath('/system', '/role')).toBe('/role');
    expect(joinMenuPath('', 'dict')).toBe('/dict');
    expect(joinMenuPath('/system', '')).toBe('/system');
    expect(joinMenuPath('/system', 'https://a.com')).toBe('https://a.com');
  });
});

/**
 * `hidden` 的语义：不在导航里出现 ≠ 没权限。
 *
 * 菜单树同时是权限来源（`stores/modules/route.ts` 把树上的 name/path 摊成
 * allowedNames / allowedPaths）。如果补 path 那一步就把隐藏项剪了，
 * 这些页面会集体掉出权限表 —— 直达链接变 403、标签页只剩路径、keep-alive 失效。
 * 所以"剔隐藏"只发生在渲染导航的那几个出口，搜索侧用 `includeHidden` 显式放行。
 */
describe('includeHidden：隐藏项留在树上，只有导航出口剔掉它', () => {
  const router = {
    hasRoute: (name: string) => name !== 'Ghost',
    resolve: (to: { name: string }) => ({ path: `/resolved/${to.name}` }),
  } as never;

  it('attachMenuPaths 默认剪掉隐藏项，includeHidden 保留并照样补 path', () => {
    const pruned = attachMenuPaths(makeMenus(), router);
    expect(pruned.map((m) => m.title)).toEqual(['系统管理', '监控']);

    const full = attachMenuPaths(makeMenus(), router, { includeHidden: true });
    expect(full.map((m) => m.title)).toEqual(['系统管理', '监控', '隐藏的顶级']);
    // 隐藏节点的 path 也要补全，否则权限表里只有 name、对不上路由
    expect(full[2]?.path).toBe('/resolved/Hidden');
    expect(full[0]?.children?.map((child) => child.name)).toEqual([
      'UserList',
      'RoleList',
      'DictGroup',
    ]);
  });

  it('按 path / name / key 查：默认查不到隐藏项，放行后能查到', () => {
    const full = attachMenuPaths(makeMenus(), router, { includeHidden: true });

    expect(findMenuByPath(full, '/system/role')).toBeUndefined();
    expect(findMenuByPath(full, '/system/role/', { includeHidden: true })?.name).toBe(
      'RoleList',
    );
    expect(findMenuByName(full, 'RoleList')).toBeUndefined();
    expect(findMenuByName(full, 'RoleList', { includeHidden: true })?.title).toBe(
      '角色管理',
    );
    expect(findMenuByKey(full, 'RoleList')).toBeUndefined();
    expect(findMenuByKey(full, 'RoleList', { includeHidden: true })).toBeDefined();
  });

  it('祖先链放行时能穿过隐藏节点', () => {
    const menus: MenuConfig[] = [
      {
        name: 'Tool',
        path: '/tool',
        title: '系统工具',
        hidden: true,
        children: [{ name: 'DictList', path: '/system/dict', title: '字典管理' }],
      },
    ];
    expect(
      findMenuChain(menus, (m) => m.name === 'DictList').map((m) => m.name),
    ).toEqual([]);
    expect(
      findMenuChain(menus, (m) => m.name === 'DictList', [], {
        includeHidden: true,
      }).map((m) => m.name),
    ).toEqual(['Tool', 'DictList']);
  });

  it('树里留着隐藏项也不影响导航出口：items / 叶子遍历 / 首个叶子都照常过滤', () => {
    const full = attachMenuPaths(makeMenus(), router, { includeHidden: true });

    /**
     * `buildMenuItems` 的返回类型是 antd 的内部联合（item / submenu 两种形状），
     * 断言只关心 key 与 children，所以在这里一次性收窄成用得到的字段，
     * 避免每个用例都写一遍 `as never`。
     */
    type RenderedItem = { children?: RenderedItem[], key?: string };
    const items = buildMenuItems(full) as unknown as RenderedItem[];
    expect(items.map((item) => item.key)).toEqual(['System', '监控']);
    const system = items[0];
    expect((system?.children ?? []).map((child) => child.key)).toEqual([
      'UserList',
      'DictGroup',
    ]);

    expect(flattenLeafMenus(full).map((m) => m.name)).toEqual([
      'UserList',
      'DictList',
      'Online',
    ]);
    // 顶级只有隐藏项时，找不到可跳的首个叶子（点击不能跳到一个不存在的页面）
    expect(firstLeafMenu(full[2])).toBeUndefined();
    expect(firstLeafMenu(full[0])?.name).toBe('UserList');
  });

  /**
   * `visibleMenus` 只剔一层，所以「整棵树直出」的导航出口（垂直布局的侧边栏）
   * 不能直接拿全量树去渲染 —— 隐藏的子项会漏出来。
   */
  it('visibleMenuTree 逐层剔隐藏项，且不改动原树', () => {
    const full = attachMenuPaths(makeMenus(), router, { includeHidden: true });
    const tree = visibleMenuTree(full);

    expect(tree.map((menu) => menu.title)).toEqual(['系统管理', '监控']);
    expect(tree[0]?.children?.map((child) => child.title)).toEqual([
      '用户管理',
      '字典分组',
    ]);
    // 字典分组自身可见，它的孩子仍然在
    expect(
      tree[0]?.children?.[1]?.children?.map((child) => child.title),
    ).toEqual(['字典管理']);
    // 原始树保持全量：权限与标签页还指着它
    expect(full[0]?.children).toHaveLength(3);
  });

  it('visibleMenuTree 对空值与没有孩子的节点都安全', () => {
    expect(visibleMenuTree()).toEqual([]);
    expect(visibleMenuTree([])).toEqual([]);
    const [only] = visibleMenuTree([
      { name: 'Leaf', path: '/leaf', title: '叶子' },
      { hidden: true, name: 'Ghost', title: '隐藏' },
    ] as MenuConfig[]);
    expect(only?.title).toBe('叶子');
    expect(only?.children).toBeUndefined();
  });
});

/**
 * 「按菜单裁剪路由」的两块基石：菜单摊成的查找表，以及框架路由的豁免名单。
 *
 * 这两件事错了都不是"少一个菜单项"那么轻：
 * 查找表漏了 path，隐藏页就从"不显示"变成"进不去"；
 * 豁免名单漏了一条，布局壳 `Root` 或登录页会被一起摘掉，表现是整站白屏。
 */
describe('collectMenuKeys', () => {
  it('name 与 path 两张表都收，且包含隐藏节点', () => {
    const keys = collectMenuKeys(makeMenus());

    expect(keys.byName.has('RoleList')).toBe(true); // hidden 仍在权限来源里
    expect(keys.byName.has('DictList')).toBe(true); // 递归到孙子层
    expect(keys.byPath.has('/system/user')).toBe(true);
    expect(keys.byPath.has('/system/role')).toBe(true);
    expect(keys.byPath.has('/system/dict')).toBe(true);
  });

  it('目录节点的空 path 不进表，否则所有空串会互相命中', () => {
    const keys = collectMenuKeys([
      { name: 'Empty', path: '', title: '空目录' },
      { name: 'Ghost', path: '', title: '幽灵' },
    ]);
    expect(keys.byPath.has('')).toBe(false);
    expect([...keys.byPath]).toEqual([]);
  });

  it('外链的 path 不是本站路由，不参与裁剪判定', () => {
    const keys = collectMenuKeys([
      { isExternal: true, name: 'Docs', path: 'https://antdv-next.com/', title: '文档' },
    ]);
    expect(keys.byName.has('Docs')).toBe(true);
    expect(keys.byPath.size).toBe(0);
  });

  it('结尾斜杠与缺失前导斜杠都归一到同一个 key', () => {
    const keys = collectMenuKeys([
      { name: 'A', path: '/system/user/', title: '甲' },
      { name: 'B', path: 'system/dept', title: '乙' },
    ]);
    expect(keys.byPath.has('/system/user')).toBe(true);
    expect(keys.byPath.has('/system/dept')).toBe(true);
  });

});

describe('内置路由豁免名单', () => {
  it('按 name 认：框架生成的 Error404 而不是 error-404', () => {
    // 名单里是 `createRouter` 实际生成的 name；登录页不在其中，
    // 它靠 `meta.requiresAuth === false` 那条边界免裁剪（见 store 的 selfAllowed）
    for (const name of ['Root', 'Redirect', 'Register', 'Error404', 'CatchAll']) {
      expect(isBuiltinMenuName(name)).toBe(true);
    }
    expect(isBuiltinMenuName('error-404')).toBe(false);
    expect(isBuiltinMenuName('SystemUser')).toBe(false);
    expect(isBuiltinMenuName(undefined)).toBe(false);
    expect(isBuiltinMenuName('')).toBe(false);
  });

  it('按 path 兜一层：改名或换大小写都不会漏掉异常页与登录页', () => {
    for (const path of ['/error/403', '/error/404/', '/error/503', '/login', '/logout', '/register']) {
      expect(isBuiltinMenuPath(path)).toBe(true);
    }
    expect(isBuiltinMenuPath('/system/user')).toBe(false);
    expect(isBuiltinMenuPath('')).toBe(false);
    expect(isBuiltinMenuPath(undefined)).toBe(false);
  });
});

describe('isExternalPath', () => {
  /**
   * 外链判定只有这一份实现，`normalizeMenuPath` / `joinMenuPath` 与面包屑都问它。
   *
   * 面包屑要把菜单 path 变成可点的链接：站内得走 `router.resolve`
   * （hash 模式下才是 `#/system/user`），外链必须原样交给浏览器。
   * 判错一个方向，要么把 `https://` 拼成站内假路径，要么让外链变成一次路由跳转。
   */
  it('带协议与协议相对的写法都算外链', () => {
    for (const path of [
      'https://antdv-next.com/',
      'http://example.com',
      '//cdn.example.com/icon.svg',
      'FTP://example.com',
    ]) {
      expect(isExternalPath(path), path).toBe(true);
    }
  });

  it('站内路径与空值都不算外链', () => {
    for (const path of ['/system/user', 'system/user', '/', '', undefined]) {
      expect(isExternalPath(path), String(path)).toBe(false);
    }
  });
});
