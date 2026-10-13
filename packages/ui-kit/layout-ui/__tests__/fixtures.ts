import type { MenuConfig } from '@antdv/types';

import type { LayoutShellRegions } from '../src/types';

/**
 * 外壳测试共用的菜单树。
 *
 * 覆盖到导航会出现的每一类节点：目录、深层叶子、禁用项、外链、隐藏页 ——
 * 外壳的判定（高亮、图标兜底、外链不参与选中）都能在这里取到样本。
 */
export const menuTree: MenuConfig[] = [
  {
    children: [
      { name: 'SystemUser', path: '/system/user', title: '用户管理' },
      {
        name: 'SystemDept',
        path: '/system/dept',
        title: '部门管理',
        hidden: true,
      },
    ],
    icon: 'carbon:user-profile',
    name: 'System',
    path: '/system',
    title: '系统管理',
  },
  {
    children: [
      {
        children: [
          { name: 'DemoFormBasic', path: '/demo/form/basic', title: '基础表单' },
          {
            disabled: true,
            name: 'DemoFormStep',
            path: '/demo/form/step',
            title: '分步表单',
          },
        ],
        name: 'DemoForm',
        path: '/demo/form',
        title: '表单',
      },
      {
        isExternal: true,
        name: 'AntdvDoc',
        path: 'https://antdv-next.com',
        title: '组件文档',
      },
    ],
    name: 'Demo',
    path: '/demo',
    title: '组件示例',
  },
  { badge: { dot: true }, name: 'Analysis', path: '/analysis', title: '分析面板' },
];

/** 区域开关的默认值：一个"什么都不渲染"的壳，用例按需打开 */
export function regions(
  overrides: Partial<LayoutShellRegions> = {},
): LayoutShellRegions {
  return {
    footerVisible: false,
    headerLead: 'breadcrumb',
    headerNavVisible: false,
    headerVisible: false,
    navRailVisible: false,
    overlaySidebar: false,
    shellHidden: false,
    sidebarVisible: false,
    tabsVisible: false,
    ...overrides,
  };
}
