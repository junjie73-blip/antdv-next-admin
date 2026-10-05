import { defineFakeRoute } from 'vite-plugin-fake-server/client'

import { withRuntime } from './_runtime'

export default defineFakeRoute(
  withRuntime([
    {
      method: 'GET',
      url: '/menus',
      response() {
        return {
          code: 200,
          data: {
            list: [
              {
                name: 'Dashboard',
                menuName: '仪表盘',
                icon: 'carbon:dashboard',
                children: [
                  {
                    name: 'Analysis',
                    menuName: '分析面板',
                    icon: 'carbon:data-vis-4',
                    keepAlive: true,
                  },
                  {
                    name: 'ScreenMonitor',
                    menuName: '实时监控大屏',
                    icon: 'carbon:chart-line-data',
                    layout: 'blank',
                    isExternal: true,
                  },
                ],
              },
              {
                menuName: '系统管理',
                icon: 'carbon:settings',
                name: 'SystemManage',
                children: [
                  {
                    path: 'user',
                    name: 'SystemUser',
                    menuName: '用户管理',
                    icon: 'carbon:user',
                    keepAlive: true,
                  },
                  {
                    path: 'role',
                    name: 'SystemRole',
                    menuName: '角色管理',
                    icon: 'carbon:user-role',
                    keepAlive: true,
                  },
                  {
                    path: 'menu',
                    name: 'SystemMenu',
                    menuName: '菜单管理',
                    icon: 'carbon:menu',
                    keepAlive: true,
                  },
                  {
                    path: 'notice',
                    name: 'SystemNotice',
                    menuName: '通知管理',
                    icon: 'carbon:notification',
                    keepAlive: true,
                  },
                  {
                    path: 'dept',
                    name: 'SystemDept',
                    menuName: '部门管理',
                    icon: 'carbon:tree',
                    keepAlive: true,
                  },
                ],
              },
              {
                menuName: '系统工具',
                name: 'Tool',
                icon: 'carbon:tools',
                children: [
                  {
                    path: 'dict',
                    name: 'ToolDict',
                    menuName: '数据字典',
                    icon: 'carbon:book',
                    keepAlive: true,
                  },
                ],
              },
              {
                name: 'Monitor',
                menuName: '系统监控',
                icon: 'carbon:screen',
                children: [
                  {
                    path: 'log',
                    name: 'MonitorLog',
                    menuName: '系统日志',
                    icon: 'carbon:document',
                    keepAlive: true,
                  },
                ],
              },
            ],
          },
          message: '获取菜单成功',
        }
      },
    },
  ]),
)
