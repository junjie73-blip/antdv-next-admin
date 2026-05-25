# Antdv Next Vue Admin

现代化后台管理系统模板，基于 Vue 3 + TypeScript + Antdv Next + Tailwind CSS 构建

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Vue 3.5 + TypeScript 5.9 |
| UI 组件库 | Antdv Next（Ant Design Vue 下一代版本） |
| 样式方案 | Tailwind CSS v4 |
| 状态管理 | Pinia 3 + pinia-plugin-persistedstate |
| 路由 | Vue Router 4 + unplugin-vue-router（文件系统路由） |
| HTTP 客户端 | Alova 3（支持 Mock、缓存、请求共享） |
| Mock 方案 | @alova/mock（内置于 Alova 适配器） |
| 构建工具 | Vite 7 |
| 包管理器 | Bun |

## 核心特性

### HTTP 请求
- **Alova**：请求共享、响应缓存、自动重试
- **@alova/mock**：Mock 数据无缝集成，通过 `import.meta.glob` 自动加载 `mock/` 目录
- **请求适配器**：根据环境变量或请求 meta 自动切换 Mock 适配器与真实适配器
- **Token 注入**：自动从 `userStore` 读取 token 注入请求头
- **统一错误处理**：全局 `message.error` 提示

### 主题系统
- 亮色 / 暗色模式切换（含平滑过渡动画）
- 多种主题风格：默认、紧凑、插画、类 Bootstrap、拟物化、玻璃、极客
- 自定义主题色、圆角
- 色弱模式、灰度模式
- 水印功能

### 布局系统
- 纯 Flex 布局，无固定定位计算
- 多种布局模式：垂直（侧边栏 + 顶栏）、水平（顶栏菜单）、混合
- 响应式侧边栏折叠
- Tab 页签管理（支持拖拽排序、右键菜单）
- 面包屑导航
- 全屏切换
- 组件尺寸切换（小/中/大）

### 权限管理
- 路由级权限控制（`meta.auth`）
- 按钮级权限指令（`v-permission`）

### 开发体验
- 组件自动导入（Antdv Next 组件无需手动 import）
- API 自动导入（Vue、Vue Router、Pinia、VueUse）
- 文件系统路由（unplugin-vue-router）
- Vue DevTools 集成
- TSX / JSX 支持

### 构建优化
- PWA 支持（Workbox）
- 代码压缩（Gzip）
- 构建分析可视化（rollup-plugin-visualizer）
- 图片压缩（vite-plugin-imagemin）
- 生产环境移除 console（Terser）

## 项目结构

```
antdv-next-admin/
├── .agents/                  # Agent 技能配置
├── build/                    # Vite 构建配置与插件
├── e2e/                      # E2E 测试（Playwright）
├── mock/                     # Mock 数据（@alova/mock 自动加载）
│   ├── auth/                 #   认证 Mock
│   ├── login/                #   登录 Mock
│   ├── menu/                 #   菜单 Mock
│   ├── table/                #   表格 Mock
│   └── user/                 #   用户 Mock
├── src/
│   ├── api/                  # API 接口定义
│   │   ├── request.ts        #   请求封装（get/post/put/del）
│   │   └── menu.ts           #   菜单 API
│   ├── assets/               # 静态资源（图片、图标）
│   ├── components/           # 公共组件
│   │   ├── business/         #   业务组件
│   │   │   ├── Table/        #     表格（分页、编辑、拖拽排序、虚拟滚动）
│   │   │   ├── Form/         #     表单（Schema 驱动、动态校验）
│   │   │   ├── Modal/        #     弹窗（拖拽、全屏、高度自适应）
│   │   │   ├── Drawer/       #     抽屉（全屏、高度自适应）
│   │   │   ├── Description/  #     描述列表
│   │   │   ├── CountTo/      #     数字动画
│   │   │   ├── Upload/       #     文件上传
│   │   │   ├── MarkdownEditor/  #  Markdown 编辑器
│   │   │   └── MicroAppContainer.vue  # 微前端容器
│   │   └── common/           #   通用组件
│   │       ├── Icon/         #     图标选择器
│   │       ├── Loading/      #     全局加载
│   │       └── Scrollbar/    #     滚动条
│   ├── composables/          # 组合式函数
│   │   └── web/              #   Web 相关
│   │       ├── permission/   #     权限管理
│   │       ├── websocket/    #     WebSocket（心跳、重连）
│   │       └── useTheme.ts   #     主题切换
│   ├── config/               # 项目配置（颜色、常量、微前端）
│   ├── directives/           # 自定义指令（权限指令）
│   ├── enums/                # 枚举定义
│   ├── layouts/              # 布局系统
│   │   ├── components/       #   布局子组件
│   │   │   ├── LayoutHeader.vue   # 顶栏（通知、主题、全屏、用户菜单）
│   │   │   ├── LayoutSidebar.vue  # 侧边栏（菜单导航）
│   │   │   ├── LayoutTabs.vue     # 页签栏（拖拽排序）
│   │   │   ├── LayoutFooter.vue   # 页脚
│   │   │   ├── LayoutIcon.tsx     # 菜单图标
│   │   │   └── SettingDrawer.vue  # 主题设置抽屉
│   │   ├── composables/     #   布局组合式函数
│   │   └── DefaultLayout.vue #   默认布局
│   ├── router/               # 路由配置（守卫、菜单、路由表）
│   ├── stores/               # Pinia 状态管理
│   │   └── modules/          #   app / auth / route / user
│   ├── styles/               # 全局样式
│   ├── views/                # 页面视图
│   │   ├── dashboard/        #   仪表盘
│   │   ├── login/            #   登录
│   │   ├── register/         #   注册
│   │   ├── account/          #   个人中心 / 账户设置
│   │   ├── system/           #   系统管理（用户/角色/微应用/设置）
│   │   ├── error/            #   错误页（403/404/503）
│   │   ├── components/       #   组件示例（表格/表单/详情/上传等）
│   │   ├── demo/             #   演示页
│   │   └── micro-app/        #   微前端子应用
│   ├── utils/                # 工具函数
│   │   ├── request/          #   Alova 请求客户端
│   │   ├── cache/            #   缓存（localStorageCacheStorage、加密存储）
│   │   ├── cn/               #   类名合并（clsx + tailwind-merge）
│   │   ├── crypto/           #   加密工具（AES、Hash、JWT）
│   │   ├── event/            #   事件总线（mitt）
│   │   ├── token/            #   Token 管理
│   │   ├── helpers/          #   工具函数（菜单处理）
│   │   └── welcome/          #   欢迎通知
│   ├── workers/              # Web Worker（上传 Worker）
│   ├── App.vue               # 根组件
│   └── main.ts               # 入口文件
├── types/                    # 全局类型声明
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## 业务组件

### Table
- Schema 驱动列配置，支持自定义渲染
- 服务端分页、排序、筛选
- 行内编辑、批量编辑
- 行选择（单选 / 多选）
- 拖拽排序
- 虚拟滚动
- 列宽拖拽调整、列显隐设置
- 操作列（支持 Dropdown 折叠）

### Form
- JSON Schema 驱动表单
- 动态表单校验
- 组件映射（Input、Select、DatePicker 等 15+ 种）
- 联动显隐、动态插槽

### Modal
- 拖拽移动
- 全屏切换
- 高度自适应
- 声明式调用（`useModal`）

### Drawer
- 全屏切换
- 高度自适应
- 声明式调用（`useDrawer`）

## 开发指南

### 环境要求

- Node.js ^20.19.0 || >=22.12.0
- Bun（推荐）

### 安装依赖

```sh
bun install
```

### 启动开发服务器

```sh
bun dev
```

服务启动后访问 http://localhost:9080

### 类型检查

```sh
bun run type-check
```

### 构建生产版本

```sh
bun run build
```

### 预览生产构建

```sh
bun run preview
```

## 测试

### 单元测试

```sh
bun test:unit
```

### E2E 测试

```sh
# 首次运行需安装浏览器
npx playwright install

# 构建项目（CI 环境必须先构建）
bun run build

# 运行所有 E2E 测试
bun test:e2e

# 仅运行 Chromium
bun test:e2e --project=chromium

# 运行指定文件
bun test:e2e tests/example.spec.ts

# 调试模式
bun test:e2e --debug
```

## 代码规范

- **ESLint** — TypeScript / Vue 代码检查
- **Prettier** — 代码格式化
- **Stylelint** — CSS 样式检查
- **Commitlint** — Git 提交信息规范
- **Lefthook** — Git Hooks 管理

### 修复代码问题

```sh
bun run lint:fix
```

### Git 提交

使用 cz-git 交互式提交工具，遵循 Angular 提交规范：

```sh
git commit
```

## 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `VITE_APP_TITLE` | 项目标题 | Antdv Next Vue Admin |
| `VITE_PORT` | 开发服务器端口 | 9080 |
| `VITE_APP_BASE_API` | API 基础路径 | - |
| `VITE_MOCK` | 启用 Mock 数据 | true |
| `VITE_DEVTOOLS` | 启用 Vue DevTools | - |
| `VITE_PWA` | 启用 PWA | - |
| `VITE_VISUALIZER` | 启用构建分析 | - |
| `VITE_COMPRESS` | 压缩格式 (gzip/brotli) | - |
| `VITE_ARCHIVER` | 启用打包归档 | - |

## 推荐 IDE 配置

- [VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar)（推荐，禁用 Vetur）
- [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd) 浏览器扩展

## License

MIT