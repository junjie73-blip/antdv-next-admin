import type { MenuConfig } from '#/menu'

export const frontendMenus: MenuConfig[] = [
  {
    path: '/dashboard',
    name: 'Dashboard',
    title: '仪表盘',
    icon: 'carbon:dashboard',
    component: '@/views/dashboard/index.vue',
    keepAlive: true,
  },
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
        icon: 'carbon:group',
        component: '@/views/system/role/index.vue',
        keepAlive: true,
      },
    ],
  },
]
