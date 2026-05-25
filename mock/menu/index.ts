import { defineMock } from '../../index'

export default defineMock({
  '[GET]/menus'() {
    return {
      code: 200,
      data: {
        list: [
          {
            id: 1,
            parentId: null,
            path: '/dashboard',
            name: 'Dashboard',
            title: '仪表盘',
            icon: 'carbon:dashboard',
            component: '@/views/dashboard/index.vue',
            keepAlive: true,
            sort: 1,
          },
          {
            id: 2,
            parentId: null,
            path: '/system',
            name: 'System',
            title: '系统管理',
            icon: 'carbon:settings',
            sort: 2,
            children: [
              {
                id: 3,
                parentId: 2,
                path: 'user',
                name: 'SystemUser',
                title: '用户管理',
                icon: 'carbon:user',
                component: '@/views/system/user/index.vue',
                keepAlive: true,
                sort: 1,
              },
              {
                id: 4,
                parentId: 2,
                path: 'role',
                name: 'SystemRole',
                title: '角色管理',
                icon: 'carbon:group',
                component: '@/views/system/role/index.vue',
                keepAlive: true,
                sort: 2,
              },
            ],
          },
        ],
      },
      message: '获取菜单成功',
    }
  },
})