# 目录结构

```
antdv-next-admin/
├── .agents/                      # Agent 技能配置
├── .github/                      # CI/CD 工作流
├── build/                        # Vite 构建配置与插件
│   ├── config/                   #   构建配置
│   ├── plugin/                   #   自定义插件
│   └── utils/                    #   构建工具函数
├── docs/                         # VitePress 文档站点
│   └── .vitepress/               #   文档配置
├── e2e/                          # E2E 测试（Playwright）
├── mock/                         # Mock 数据
│   ├── auth/                     #   认证 Mock
│   ├── login/                    #   登录 Mock
│   ├── menu/                     #   菜单 Mock
│   ├── table/                    #   表格 Mock
│   └── user/                     #   用户 Mock
├── public/                       # 静态资源
├── src/
│   ├── api/                      # API 接口定义
│   │   ├── request.ts            #   请求封装
│   │   └── menu.ts               #   菜单 API
│   ├── assets/                   # 静态资源（图片等）
│   ├── components/               # 公共组件
│   │   ├── business/             #   业务组件
│   │   │   ├── Table/            #     表格组件 ⭐
│   │   │   ├── Form/             #     表单组件 ⭐
│   │   │   ├── Modal/            #     弹窗组件 ⭐
│   │   │   ├── Drawer/           #     抽屉组件 ⭐
│   │   │   ├── Description/      #     描述列表
│   │   │   ├── CountTo/          #     数字动画
│   │   │   ├── Upload/           #     上传组件
│   │   │   ├── MarkdownEditor/   #     Markdown 编辑器
│   │   │   └── MicroAppContainer.vue  # 微前端容器 ⭐
│   │   ├── LockScreen/           #   锁屏组件 ⭐
│   │   └── common/               #   通用组件
│   │       ├── Icon/             #     图标选择器
│   │       ├── Loading/          #     全局加载
│   │       └── Scrollbar/        #     滚动条
│   ├── composables/              # 组合式函数
│   │   └── web/                  #   Web 相关
│   │       ├── permission/       #     权限管理
│   │       ├── websocket/        #     WebSocket
│   │       ├── sse/              #     SSE 事件流
│   │       ├── useLocale.ts      #     语言切换 ⭐
│   │       ├── useTheme.ts       #     主题切换
│   │       └── useWatermark.ts   #     水印功能
│   ├── config/                   # 项目配置
│   │   ├── color.ts              #   颜色常量
│   │   ├── constants.ts          #   全局常量
│   │   ├── micro-app.ts          #   微前端配置 ⭐
│   │   └── project.ts            #   项目元信息
│   ├── directives/               # 自定义指令
│   │   └── permission/           #   权限指令 (v-permission)
│   ├── locales/                  # 国际化 ⭐
│   │   ├── index.ts              #   i18n 配置
│   │   └── lang/                 #   语言包
│   │       ├── zh-CN.ts         #     中文简体
│   │       └── en-US.ts         #     English
│   ├── layouts/                  # 布局系统
│   │   ├── components/           #   布局子组件
│   │   │   ├── LayoutHeader.vue  #     顶栏
│   │   │   ├── LayoutSidebar.vue #     侧边栏
│   │   │   ├── LayoutTabs.vue    #     页签栏
│   │   │   ├── LayoutFooter.vue  #     页脚
│   │   │   └── SettingDrawer.vue #     主题设置
│   │   └── DefaultLayout.vue     #   默认布局
│   ├── router/                   # 路由配置
│   │   ├── guards.ts             #   路由守卫
│   │   ├── menus.ts              #   菜单定义
│   │   └── routes.ts             #   常量路由
│   ├── stores/                   # Pinia 状态管理
│   │   └── modules/              #   Store 模块
│   │       ├── app.ts            #     应用状态
│   │       ├── auth.ts           #     认证状态
│   │       ├── route.ts          #     路由状态
│   │       └── user.ts           #     用户状态
│   ├── styles/                   # 全局样式
│   ├── views/                    # 页面视图
│   │   ├── dashboard/            #   仪表盘
│   │   ├── login/                #   登录/注册
│   │   ├── account/              #   个人中心
│   │   ├── system/               #   系统管理
│   │   │   ├── user/             #     用户管理
│   │   │   ├── role/             #     角色管理
│   │   │   ├── dict/             #     字典管理
│   │   │   ├── menu/             #     菜单管理
│   │   │   ├── log/              #     操作日志 ⭐
│   │   │   ├── online/           #     在线用户 ⭐
│   │   │   ├── notice/           #     消息通知 ⭐
│   │   │   ├── micro-app/        #     微前端管理 ⭐
│   │   │   └── settings/         #     系统设置
│   │   ├── error/                #   错误页
│   │   └── components/           #   组件示例
│   ├── utils/                    # 工具函数
│   │   ├── excel.ts              #   Excel 导出 ⭐
│   │   ├── print.ts              #   打印工具 ⭐
│   │   ├── cache/                #   缓存存储
│   │   ├── cn/                   #   类名合并
│   │   ├── crypto/               #   加密工具
│   │   ├── request/              #   HTTP 客户端
│   │   └── token/                #   Token 管理
│   ├── App.vue                   # 根组件
│   └── main.ts                   # 入口文件
├── types/                        # 全局类型声明
├── .env                          # 环境变量
├── .env.development              # 开发环境变量
├── .env.production               # 生产环境变量
├── index.html                    # HTML 入口
├── package.json                  # 项目配置
├── vite.config.ts                # Vite 配置
├── tsconfig.json                 # TypeScript 配置
├── vitest.config.ts              # Vitest 测试配置
├── playwright.config.ts          # Playwright E2E 配置
├── LICENSE                       # MIT 协议
├── CHANGELOG.md                  # 更新日志
└── README.md                     # 项目说明
```

> ⭐ 标记为本次新增或增强的模块
