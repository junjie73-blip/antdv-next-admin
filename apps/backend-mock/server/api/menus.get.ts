import type { BackendMenu } from '@antdv/types';

import { pickMenus, resolveAccount } from '../utils/accounts';
import { success } from '../utils/response';
import { defineMockRoute } from '../utils/runtime';

/**
 * 菜单树为静态数据（legacy menu.fake.ts 迁移而来）。
 *
 * 路径一律写成**与前端路由表一致的绝对路径**：本项目用文件约定式路由
 * （unplugin-vue-router），路由 name 由框架按目录生成（`/system/user/`），
 * 和业务菜单的 name（`SystemUser`）不同源。此时只有 path 能把两者对上——
 * 相对片段（`user`）会让横向导航、侧边二级菜单、标签页集体落到 404。
 *
 * 前端仍保留"相对片段 + 按末级路径段反查路由表"的兜底解析
 * （`@antdv/utils` 的 attachMenuPaths），所以这份数据不规整也不至于点不动。
 *
 * ## 关于 `hidden`
 *
 * 导航只展示四类：仪表盘、系统管理（用户/角色/菜单）、组件示例、微前端。
 * 其余节点标 `hidden: true` 而不是删掉 —— 因为这份菜单同时是**权限来源**
 * （`stores/modules/route.ts` 把树上的 name/path 摊成 allowedNames/allowedPaths），
 * 删了就等于关掉页面：部门管理、数据字典这些页面还在，直达链接、标签页标题、
 * keep-alive 都靠这条记录，只是不再出现在导航里。
 * 个人中心同样标 hidden，入口换成顶栏头像下拉 → `AccountDrawer`（抽屉内切页）。
 */
const list: BackendMenu[] = [
  {
    menuName: '仪表盘',
    name: 'Dashboard',
    icon: 'carbon:dashboard',
    path: '/dashboard',
    children: [
      {
        menuName: '分析面板',
        name: 'Analysis',
        icon: 'carbon:data-vis-4',
        path: '/dashboard/analysis',
        keepAlive: true,
      },
      {
        menuName: '实时监控大屏',
        name: 'ScreenMonitor',
        icon: 'carbon:chart-line-data',
        path: '/screen/monitor',
      },
    ],
  },
  {
    menuName: '系统管理',
    name: 'SystemManage',
    icon: 'carbon:settings',
    path: '/system',
    children: [
      {
        menuName: '用户管理',
        name: 'SystemUser',
        icon: 'carbon:user',
        path: '/system/user',
        keepAlive: true,
      },
      {
        menuName: '角色管理',
        name: 'SystemRole',
        icon: 'carbon:user-role',
        path: '/system/role',
        keepAlive: true,
      },
      {
        menuName: '菜单管理',
        name: 'SystemMenu',
        icon: 'carbon:menu',
        path: '/system/menu',
        keepAlive: true,
      },
      {
        menuName: '部门管理',
        name: 'SystemDept',
        icon: 'carbon:tree',
        path: '/system/dept',
        keepAlive: true,
        hidden: true,
      },
      {
        menuName: '岗位管理',
        name: 'SystemPost',
        icon: 'carbon:category',
        path: '/system/post',
        keepAlive: true,
        hidden: true,
      },
      {
        menuName: '通知管理',
        name: 'SystemNotice',
        icon: 'carbon:notification',
        path: '/system/notice',
        keepAlive: true,
        hidden: true,
      },
      {
        menuName: '在线用户',
        name: 'SystemOnline',
        icon: 'carbon:activity',
        path: '/system/online',
        hidden: true,
      },
      {
        menuName: '文件管理',
        name: 'SystemFile',
        icon: 'carbon:folder',
        path: '/system/file',
        hidden: true,
      },
    ],
  },
  {
    menuName: '系统工具',
    name: 'Tool',
    icon: 'carbon:tools',
    path: '',
    hidden: true,
    children: [
      {
        menuName: '数据字典',
        name: 'ToolDict',
        icon: 'carbon:book',
        path: '/system/dict',
        keepAlive: true,
      },
      {
        menuName: '系统设置',
        name: 'ToolSettings',
        icon: 'carbon:settings-adjust',
        path: '/system/settings',
      },
    ],
  },
  {
    menuName: '系统监控',
    name: 'Monitor',
    icon: 'carbon:screen',
    path: '',
    hidden: true,
    children: [
      {
        menuName: '系统日志',
        name: 'MonitorLog',
        icon: 'carbon:document',
        path: '/system/log',
        keepAlive: true,
      },
      {
        menuName: '登录日志',
        name: 'MonitorLoginLog',
        icon: 'carbon:login',
        path: '/system/login-log',
      },
    ],
  },
  {
    menuName: '组件示例',
    name: 'Demo',
    icon: 'carbon:game-console',
    path: '',
    children: [
      // 层级规则：**只有「表单」「表格」用三级**，其余一律二级叶子。
      //
      // 原来这里套了「组件画廊 → 分类 → 页面」，侧栏要点开两层才看到内容，
      // 手风琴一次只允许展开一个分类，"看看都有什么"只能一个个点。
      // 分类信息没有丢：`views/components/overview` 的卡片墙读的就是这棵树的叶子。
      //
      // 这一节只放**本项目自己写的组件**（`src/components/business|common`、`@antdv/icons`、
      // `@antdv/directives`）。原来混在里面的纯 antd 展示页（通用 / 卡片列表 / 详情页 /
      // 数据展示 / 反馈与交互 / 树形控件 / 视频播放 / VueUse / 二维码 / 密码强度）已经删掉 ——
      // 示例页是给别人直接抄的模板，抄 antd 官方文档就够了，抄本仓库的包装器才有增量价值。
      // 「分页表格」同样删掉：那是排障时临时建的测试页，不是一个组件。
      //
      // 表格组只留表格本身的事（基础 / 拖拽排序 / 树形 / 动效）；数字滚动、图片裁剪、
      // 相对时间原先挂在表格下面，现在各自升成二级 —— 它们演示的是 CountTo、裁剪器、
      // RelativeTime，跟表格没关系。Markdown 与富文本合并成「编辑器」一页（同一个包装器
      // 的两种模式），抽屉内滚动/弹窗内滚动并进「弹窗与抽屉」。
      {
        menuName: '示例总览',
        name: 'DemoComponentsOverview',
        icon: 'carbon:catalog',
        path: '/components/overview',
      },
      {
        menuName: '表格',
        name: 'DemoGalleryTable',
        icon: 'carbon:table',
        path: '',
        children: [
          {
            menuName: '基础表格',
            name: 'DemoTableBasic',
            icon: 'carbon:table-built',
            path: '/components/table/basic',
          },
          {
            menuName: '增删改查',
            name: 'DemoTableCrud',
            icon: 'carbon:task',
            path: '/components/table/crud',
          },
          {
            menuName: '拖拽排序',
            name: 'DemoTableDragSort',
            icon: 'carbon:move',
            path: '/components/table/drag-sort',
          },
          {
            menuName: '树形表格',
            name: 'DemoTableTree',
            icon: 'carbon:tree',
            path: '/components/table/tree-table',
          },
          {
            menuName: '表格动效',
            name: 'DemoTableAnimation',
            icon: 'carbon:flash',
            path: '/components/table/animation',
          },
        ],
      },
      {
        menuName: '表单',
        name: 'DemoGalleryForm',
        icon: 'carbon:checkbox-checked',
        path: '',
        children: [
          {
            menuName: '基础表单',
            name: 'DemoFormBasic',
            icon: 'carbon:align-box-bottom-left',
            path: '/components/form/basic',
          },
          {
            menuName: '分步表单',
            name: 'DemoFormSteps',
            icon: 'carbon:layers',
            path: '/components/form/steps',
          },
          {
            menuName: '表单校验',
            name: 'DemoFormValidation',
            icon: 'carbon:checkmark-outline',
            path: '/components/form/validation',
          },
          {
            menuName: '自定义组件',
            name: 'DemoFormCustom',
            icon: 'carbon:apps',
            path: '/components/form/custom-component',
          },
        ],
      },
      {
        menuName: '弹窗与抽屉',
        name: 'DemoModalDrawer',
        icon: 'carbon:side-panel-open',
        path: '/components/modal-drawer',
      },
      {
        menuName: '描述列表',
        name: 'DemoDescription',
        icon: 'carbon:category',
        path: '/components/description',
      },
      {
        menuName: '数字滚动',
        name: 'DemoTableCountTo',
        icon: 'carbon:list-numbered',
        path: '/components/count-to',
      },
      {
        menuName: '相对时间',
        name: 'DemoTableRelativeTime',
        icon: 'carbon:time',
        path: '/components/relative-time',
      },
      {
        menuName: '图片裁剪',
        name: 'DemoTableImageCrop',
        icon: 'carbon:crop',
        path: '/components/image-crop',
      },
      {
        menuName: '编辑器',
        name: 'DemoEditor',
        icon: 'carbon:edit',
        path: '/components/editor',
      },
      {
        menuName: '文件上传',
        name: 'DemoUpload',
        icon: 'carbon:upload',
        path: '/components/upload',
      },
      {
        menuName: 'Cron 表达式',
        name: 'DemoCron',
        icon: 'carbon:task-settings',
        path: '/components/cron',
      },
      {
        menuName: '图表',
        name: 'DemoChart',
        icon: 'carbon:data-vis-4',
        path: '/components/chart',
      },
      {
        menuName: '加载与骨架',
        name: 'DemoLoading',
        icon: 'carbon:pending',
        path: '/components/loading',
      },
      {
        menuName: '图标选择器',
        name: 'DemoIconPicker',
        icon: 'carbon:run-view-icon',
        path: '/components/icon-picker',
      },
      {
        menuName: '滚动区域',
        name: 'DemoScrollBasic',
        icon: 'carbon:page-scroll',
        path: '/components/scroll/basic',
      },
      {
        menuName: '自定义指令',
        name: 'DemoComponentsDirective',
        icon: 'carbon:terminal',
        path: '/components/directive',
      },
      {
        menuName: '拖拽布局',
        name: 'DemoDragLayout',
        icon: 'carbon:grid',
        path: '/components/drag-layout',
      },
      {
        menuName: '轻提示与通知',
        name: 'DemoFeedback',
        icon: 'carbon:warning-alt',
        path: '/components/feedback',
      },
      {
        menuName: '边框光带',
        name: 'DemoBorderBeam',
        icon: 'carbon:border-full',
        path: '/components/border-beam',
      },
      {
        menuName: '通用列表',
        name: 'DemoListy',
        icon: 'carbon:list-bulleted',
        path: '/components/listy',
      },
    ],
  },
  {
    menuName: '安全能力',
    name: 'Security',
    icon: 'carbon:security',
    path: '',
    hidden: true,
    children: [
      {
        menuName: '安全看板',
        name: 'SecurityDashboard',
        icon: 'carbon:document-security',
        path: '/security/dashboard',
      },
    ],
  },
  {
    menuName: '微前端',
    name: 'MicroApp',
    icon: 'carbon:cube',
    path: '',
    children: [
      {
        menuName: '子应用',
        name: 'MicroAppView',
        icon: 'carbon:application',
        path: '/micro-app/SubAppView',
      },
      {
        menuName: '微应用管理',
        name: 'MicroAppManage',
        icon: 'carbon:network-4',
        path: '/system/micro-app',
      },
    ],
  },
  {
    menuName: '个人中心',
    name: 'Account',
    icon: 'carbon:user-avatar',
    path: '',
    // 入口改到顶栏头像下拉 → AccountDrawer（抽屉内切「个人主页 / 账户设置」），
    // 导航里不再占一格；/account/* 两个页面保留记录，直达链接与标签页标题还要靠它。
    hidden: true,
    children: [
      {
        menuName: '个人主页',
        name: 'AccountCenter',
        icon: 'carbon:home',
        path: '/account/center',
      },
      {
        menuName: '账户设置',
        name: 'AccountSettings',
        icon: 'carbon:edit',
        path: '/account/settings',
      },
    ],
  },
  {
    menuName: '组件文档',
    name: 'ExternalDocs',
    icon: 'carbon:link',
    // 外链：path 就是目标地址，点击走新窗口而不是路由
    isExternal: true,
    // 顶栏「文档中心」下拉已经承担了这个入口，导航里不再重复展示
    hidden: true,
    path: 'https://antdv-next.com/',
  },
];

/**
 * 补齐"菜单管理服务"才会用到的元数据。
 *
 * 上面的静态树只写了导航必需的字段（name/path/icon/hidden/keepAlive），
 * 而 `menuType / sortOrder / status / component / permission` 是后台管理侧的：
 * 只有菜单管理页在消费它们，于是那一页的"排序 / 权限标识 / 组件路径"三列全是空的，
 * 巡检时看着像坏了。这里按项目自己的约定推导一遍，而不是手改四十多条记录：
 *
 * - `menuType`：有孩子 = 1 目录，外链 = 2 菜单（新窗口），其余 = 2 菜单；
 * - `sortOrder`：兄弟间下标 + 1（导航本来就按这个顺序渲染，对得上）；
 * - `component`：文件约定式路由的产物 —— `/system/user` 就是
 *   `views/system/user/index.vue`，所以去掉首斜杠再补 `/index`；
 *   目录与外链没有组件，留空而不是编一个假值；
 * - `permission`：`模块:页面:list` 的 RuoYi 风格，从 path 摊出来；
 * - `status`：一律 '1' 启用（停用与否是业务开关，mock 不替用户决定）。
 */
function decorate(list: BackendMenu[]): BackendMenu[] {
  return list.map((menu, index) => {
    const children = menu.children?.length
      ? decorate(menu.children)
      : undefined;
    const isDir = !!children?.length;
    const local = normalizePathLike(menu.path);
    return {
      ...menu,
      component:
        isDir || menu.isExternal || !local ? undefined : `${local}/index`,
      menuType: isDir ? 1 : 2,
      // `/system/user` → `system:user:list`（点号分段是权限标识的既有写法）
      permission:
        isDir || menu.isExternal || !local
          ? undefined
          : `${local.split('/').join(':')}:list`,
      sortOrder: index + 1,
      status: menu.status ?? '1',
      ...(children ? { children } : {}),
    };
  });
}

/** `/system/user` → `system/user`；外链与空串不参与推导 */
function normalizePathLike(path?: string): string {
  if (!path || path.startsWith('http')) return '';
  return path.replace(/^\/+/, '').replace(/\/+$/, '');
}

/**
 * 导出给测试校验「账号白名单里的 name 真的存在于树上」——
 * 拼错一个 name 的表现是"custom 账号静默少一个页面"，很难靠肉眼发现。
 */
export const menuTree = decorate(list);

/**
 * legacy menu.fake.ts：路径就是 /menus（不在 system 下）。
 *
 * 树本身是静态的，但**按 token 分账号裁剪后再返回**（裁剪规则见
 * `server/utils/accounts.ts`）。这份菜单同时是权限来源，所以"返回什么"直接
 * 决定了另一个人能进哪些页面 —— 不裁剪就等于所有账号都是超管。
 */
export default defineMockRoute({
  handler({ headers }) {
    const account = resolveAccount(headers);
    return success(
      { list: pickMenus(menuTree, account.visibleMenus) },
      '获取菜单成功',
    );
  },
  method: 'GET',
  path: '/menus',
});
