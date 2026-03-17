# Antdv Next Vue Admin

现代化后台管理系统模板，基于 Vue 3 + TypeScript + Antdv Next + Tailwind CSS 构建 🎨

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Vue 3.5 + TypeScript 5.9 |
| UI 组件库 | Antdv Next（Ant Design Vue 下一代版本） |
| 样式方案 | Tailwind CSS v4 |
| 状态管理 | Pinia 3 + pinia-plugin-persistedstate |
| 路由 | Vue Router 4 + unplugin-vue-router（文件系统路由） |
| 构建工具 | Vite 7 |
| 包管理器 | Bun |

## 核心特性

### 实时通信
- **WebSocket**：心跳检测、自动重连、事件管理
- **SSE**：Server-Sent Events 支持

### 主题系统
- 亮色/暗色模式切换
- 自定义主题色
- 色弱模式、灰度模式
- 水印功能

### 布局系统
- 多种布局模式（垂直、水平、混合）
- 响应式设计
- Tab 页签管理（支持拖拽）

### 权限管理
- 路由权限控制
- 按钮级权限指令

### 开发体验
- 组件自动导入
- API 自动导入（Vue、Vue Router、Pinia、VueUse）
- 文件系统路由
- Vue DevTools 集成

### 构建优化
- PWA 支持
- 代码压缩（Gzip/Brotli）
- 构建分析可视化
- Terser 压缩（生产环境移除 console）

## 项目结构

```
antdv-next-admin/
├── .agents/                  # Agent 技能配置
│   └── skills/               # 技能定义
├── build/                    # 构建配置
│   ├── config/               # Vite 配置
│   ├── plugin/               # Vite 插件
│   └── utils/                # 构建工具函数
├── e2e/                      # E2E 测试
├── src/
│   ├── assets/               # 静态资源
│   ├── composables/          # 组合式函数
│   │   └── web/              # Web 相关
│   │       ├── permission/   # 权限管理
│   │       ├── sse/          # SSE 支持
│   │       ├── websocket/    # WebSocket 支持
│   │       └── useTheme.ts   # 主题切换
│   ├── config/               # 项目配置
│   ├── directives/           # 自定义指令
│   ├── enums/                # 枚举定义
│   ├── layouts/              # 布局组件
│   ├── router/               # 路由配置
│   ├── stores/               # Pinia 状态管理
│   │   └── modules/          # 状态模块
│   ├── styles/               # 全局样式
│   ├── views/                # 页面视图
│   ├── App.vue               # 根组件
│   └── main.ts               # 入口文件
├── types/                    # 类型声明
├── build/                    # 构建脚本
├── package.json
├── vite.config.ts
└── tsconfig.json
```

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

项目集成了完整的代码规范工具：

- **ESLint** - TypeScript / Vue 代码检查
- **Prettier** - 代码格式化
- **Stylint** - CSS 样式检查
- **Commitlint** - Git 提交信息规范

### 修复代码问题

```sh
bun run lint:fix
```

### Git 提交

项目使用 cz-git 交互式提交工具，支持 Angular 提交规范：

```sh
git commit
```

## 推荐 IDE 配置

- [VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar)（推荐，禁用 Vetur）
- [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd) 浏览器扩展

### 浏览器要求

- Chromium 系列浏览器（Chrome、Edge、Brave 等）
- Firefox + Vue.js devtools

## 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| VITE_NAMESPACE | 项目命名空间 | antdv-next-admin |
| VITE_APP_TITLE | 项目标题 | Antdv Next Vue Admin |
| VITE_PORT | 开发服务器端口 | 9080 |
| VITE_DEVTOOLS | 启用 Vue DevTools | - |
| VITE_MOCK | 启用 Mock 数据 | true |
| VITE_PWA | 启用 PWA | - |
| VITE_VISUALIZER | 启用构建分析 | - |
| VITE_COMPRESS | 压缩格式 (gzip/brotli) | - |
| VITE_ARCHIVER | 启用打包归档 | - |

## License

MIT
