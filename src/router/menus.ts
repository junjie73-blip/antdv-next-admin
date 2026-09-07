import type { MenuConfig } from '#/menu'

export const frontendMenus: MenuConfig[] = [
  // ==================== 仪表盘 ====================
  {
    path: '/dashboard',
    name: 'Dashboard',
    title: '仪表盘',
    icon: 'carbon:dashboard',
    redirect: '/dashboard/analysis',
    children: [
      {
        path: 'analysis',
        name: 'Analysis',
        title: '分析面板',
        icon: 'carbon:data-vis-4',
        component: '@/views/dashboard/analysis/index.vue',
        keepAlive: true,
      },
      // ==================== 实时监控大屏（外链） ====================
      {
        path: '/screen/monitor',
        name: 'ScreenMonitor',
        title: '实时监控大屏',
        icon: 'carbon:chart-line-data',
        component: '@/views/screen/monitor/index.vue',
        layout: 'blank',
        isExternal: true,
      },
    ],
  },
  // ==================== 系统管理 ====================
  {
    path: '/system',
    name: 'System',
    title: '系统管理',
    icon: 'carbon:settings',
    children: [
      {
        path: 'user',
        name: 'SystemUser',
        title: '用户管理',
        icon: 'carbon:user',
        component: '@/views/system/user/index.vue',
        keepAlive: true,
      },
      {
        path: 'role',
        name: 'SystemRole',
        title: '角色管理',
        icon: 'carbon:user-role',
        component: '@/views/system/role/index.vue',
        keepAlive: true,
      },
      {
        path: 'menu',
        name: 'SystemMenu',
        title: '菜单管理',
        icon: 'carbon:menu',
        component: '@/views/system/menu/index.vue',
        keepAlive: true,
      },
      {
        path: 'notice',
        name: 'SystemNotice',
        title: '通知管理',
        icon: 'carbon:notification',
        component: '@/views/system/notice/index.vue',
        keepAlive: true,
      },
      {
        path: 'dept',
        name: 'SystemDept',
        title: '部门管理',
        icon: 'carbon:tree',
        component: '@/views/system/dept/index.vue',
        keepAlive: true,
      },
    ],
  },
  // ==================== 系统工具 ====================
  {
    path: '/tool',
    name: 'Tool',
    title: '系统工具',
    icon: 'carbon:tools',
    children: [
      {
        path: 'dict',
        name: 'ToolDict',
        title: '数据字典',
        icon: 'carbon:book',
        component: '@/views/system/dict/index.vue',
        keepAlive: true,
      },
    ],
  },
  // ==================== 系统监控 ====================
  {
    path: '/monitor',
    name: 'Monitor',
    title: '系统监控',
    icon: 'carbon:screen',
    children: [
      {
        path: 'log',
        name: 'MonitorLog',
        title: '系统日志',
        icon: 'carbon:document',
        component: '@/views/system/log/index.vue',
        keepAlive: true,
      },
    ],
  },
]
