# Antdv Next Vue Admin

**现代化企业级后台管理系统模板**

基于 Vue 3 + TypeScript + Antdv Next + Tailwind CSS 构建

![Vue](https://img.shields.io/badge/Vue-3.5-42b883?logo=vue.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript&logoColor=white)
![Antdv Next](https://img.shields.io/badge/Antdv_Next-1.x-1890ff?logo=antdesign&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06b6d4?logo=tailwindcss&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646cff?logo=vite&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-1.x-a020f0?logo=bun&logoColor=white)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

---

## 目录

- [特性](#特性)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [项目结构](#项目结构)
- [业务模块](#业务模块)
- [开发指南](#开发指南)
- [测试](#测试)
- [代码规范](#代码规范)
- [环境变量](#环境变量)
- [推荐 IDE 配置](#推荐-ide-配置)
- [参与贡献](#参与贡献)

---

## 特性

### 权限与安全

- **路由级权限控制** — `meta.auth` 精细化路由守卫
- **按钮级权限指令** — `v-permission` 按钮显隐控制
- **Token 自动注入** — 从 `userStore` 读取并注入请求头
- **锁屏保护** — 全屏锁屏界面，密码解锁，安全离开

### 国际化 (i18n)

- **多语言支持** — 中文简体 / English 双语切换
- **语言持久化** — localStorage 记忆用户选择
- **完整翻译覆盖** — 15+ 模块，350+ 翻译键值
- **动态切换** — 无需刷新页面，实时生效

### 数据操作

- **Excel 导出** — 通用导出工具，自动列宽，时间戳命名
- **专业打印** — iframe 方式打印，斑马纹表格，页眉页脚
- **批量操作** — 批量删除、批量导出、批量强制下线
- **数据筛选** — 时间范围、关键词、状态等多维度筛选

### 业务模块

| 模块 | 功能说明 |
|------|----------|
| 用户管理 | CRUD、角色分配、状态切换、导入导出 |
| 角色管理 | 动态权限树、菜单级权限分配 |
| 字典管理 | 数据字典维护 |
| 菜单管理 | 菜单树配置 |
| 操作日志 | 10 种操作类型、时间范围搜索、详情查看 |
| 在线用户 | 实时监控、强制下线、30s 自动刷新、统计卡片 |
| 消息通知 | 公告/通知/待办分类、已读未读标记、批量操作 |
| 微前端管理 | 子应用注册、启动停止、预览、健康检查 |
| 系统设置 | 全局配置管理 |

### 主题系统

- **亮色 / 暗色模式** — 平滑过渡动画
- **7 种主题风格** — 默认、紧凑、插画、Bootstrap、拟物化、玻璃、极客
- **自定义主题色 / 圆角**
- **色弱模式 + 灰度模式**
- **水印功能**

### 布局系统

- **纯 Flex 布局** — 无固定定位计算
- **3 种布局模式** — 垂直（侧边栏+顶栏）、水平（顶栏菜单）、混合
- **响应式侧边栏折叠**
- **Tab 页签管理** — 支持拖拽排序、右键菜单
- **面包屑导航**
- **全屏切换 + 组件尺寸切换**

### 开发体验

- **组件自动导入** — Antdv Next 组件无需手动 import
- **API 自动导入** — Vue、Vue Router、Pinia、VueUse
- **文件系统路由** — unplugin-vue-router
- **TSX / JSX 支持** — render 函数中编写 TSX
- **Mock 数据内置** — @alova/mock 无缝集成

### 构建优化

- **PWA 支持** — Workbox 离线缓存
- **代码压缩** — Gzip / Brotli
- **构建分析可视化** — rollup-plugin-visualizer
- **图片压缩** — vite-plugin-imagemin
- **生产环境移除 console** — Terser

---

## 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 框架 | Vue 3 + TypeScript | 3.5 / 5.9 |
| UI 组件库 | Antdv Next | ^1.3.1 |
| 样式方案 | Tailwind CSS v4 | ^4.2.1 |
| 状态管理 | Pinia 3 + persistedstate | ^3.0.4 |
| 路由 | Vue Router 4 + 文件系统路由 | ^4.6.4 |
| HTTP 客户端 | Alova 3 + Mock | ^3.5.1 |
| 国际化 | vue-i18n | ^11.4.4 |
| Excel 处理 | xlsx (SheetJS) | ^0.18.5 |
| 构建工具 | Vite 7 | ^7.3.1 |
| 包管理器 | Bun | 1.x |

---

## 快速开始

### 环境要求

- **Node.js** ^20.19.0 || >=22.12.0
- **Bun**（推荐）或 npm/pnpm/yarn

### 安装依赖

```bash
# 使用 Bun（推荐）
bun install

# 或使用其他包管理器
npm install
pnpm install
yarn install
```

### 启动开发服务器

```bash
bun dev
```

启动后访问 http://localhost:9080

> 默认账号：`admin` / 密码：`admin123`

### 构建生产版本

```bash
bun run build
```

### 类型检查

```bash
bun run type-check
```

### 修复代码问题

```bash
bun run lint:fix
```

---

## 项目结构

```
antdv-next-admin/
├── .agents/                      # Agent 技能配置
├── .github/                      # CI/CD 工作流
├── build/                        # Vite 构建配置与插件
├── docs/                         # VitePress 文档站点
├── e2e/                          # E2E 测试（Playwright）
├── mock/                         # Mock 数据（@alova/mock 自动加载）
├── src/
│   ├── api/                      # API 接口定义
│   ├── assets/                   # 静态资源
│   ├── components/               # 公共组件
│   │   ├── business/             #   业务组件
│   │   │   ├── Table/            #     表格组件
│   │   │   ├── Form/             #     表单组件
│   │   │   ├── Modal/            #     弹窗组件
│   │   │   ├── Drawer/           #     抽屉组件
│   │   │   └── MicroAppContainer.vue  # 微前端容器
│   │   ├── LockScreen/           #   锁屏组件
│   │   └── common/               #   通用组件
│   ├── composables/              # 组合式函数
│   ├── config/                   # 项目配置
│   ├── directives/               # 自定义指令
│   ├── locales/                  # 国际化（zh-CN / en-US）
│   ├── layouts/                  # 布局系统
│   ├── router/                   # 路由配置
│   ├── stores/                   # Pinia 状态管理
│   ├── views/                    # 页面视图
│   │   ├── system/               #   系统管理
│   │   │   ├── user/             #     用户管理
│   │   │   ├── role/             #     角色管理
│   │   │   ├── dict/             #     字典管理
│   │   │   ├── menu/             #     菜单管理
│   │   │   ├── log/              #     操作日志
│   │   │   ├── online/           #     在线用户
│   │   │   ├── notice/           #     消息通知
│   │   │   ├── micro-app/        #     微前端管理
│   │   │   └── settings/         #     系统设置
│   │   └── ...                   #   其他页面
│   ├── utils/                    # 工具函数
│   │   ├── excel.ts              #   Excel 导出工具
│   │   ├── print.ts              #   打印工具
│   │   └── ...                   #   其他工具
│   ├── App.vue                   # 根组件
│   └── main.ts                   # 入口文件
├── types/                        # 全局类型声明
├── LICENSE                       # MIT 开源协议
├── CHANGELOG.md                  # 更新日志（standard-version 自动生成）
├── package.json
├── vite.config.ts
└── tsconfig.json
```

> ⭐ 标记为本次新增或增强的功能模块

---

## 业务模块详解

### Table 组件

- Schema 驱动列配置，支持自定义渲染（TSX）
- 服务端分页、排序、筛选
- 行内编辑、批量编辑
- 行选择（单选 / 多选）
- 拖拽排序、虚拟滚动
- 列宽拖拽调整、列显隐设置
- 操作列 Dropdown 折叠

### Form 组件

- JSON Schema 驱动表单
- 动态表单校验
- 组件映射（Input、Select、DatePicker 等 15+ 种）
- 联动显隐、动态插槽

### Modal / Drawer 组件

- 拖拽移动（Modal）
- 全屏切换
- 高度自适应
- 声明式调用（`useModal` / `useDrawer`）

---

## 测试

### 单元测试（Vitest）

```bash
bun test:unit
```

### E2E 测试（Playwright）

```bash
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

---

## 代码规范

| 工具 | 用途 |
|------|------|
| ESLint | TypeScript / Vue 代码检查 |
| Prettier | 代码格式化 |
| Stylelint | CSS 样式检查 |
| Commitlint | Git 提交信息规范（Angular） |
| Lefthook | Git Hooks 管理 |
| cz-git | 交互式提交工具 |

### Git 提交规范

遵循 Angular 提交规范：

```bash
git commit
# 使用 cz-git 交互式提交

# 类型说明：
# feat:     新功能
# fix:      修复问题
# docs:     文档更新
# style:    代码格式
# refactor: 重构
# perf:     性能优化
# test:     测试相关
# chore:    构建/工具
```

### 版本发布

```bash
bun run release        # 自动补丁版本 (1.0.0 → 1.0.1)
bun run release:minor  # 次版本 (1.0.0 → 1.1.0)
bun run release:major  # 主版本 (1.0.0 → 2.0.0)
bun run release:first  # 首次发布
```

> 由 standard-version 自动生成 CHANGELOG 并更新版本号

---

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
| `VITE_MICRO_APP` | 启用微前端 | - |

---

## 推荐 IDE 配置

- **[VS Code](https://code.visualstudio.com/)** + **[Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar)**（推荐，禁用 Vetur）
- **[Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)** 浏览器扩展

### 推荐扩展

- Vue - Official (Volar)
- TypeScript Vue Plugin (Volar)
- Tailwind CSS IntelliSense
- ESLint
- Prettier

---

## 参与贡献

欢迎贡献代码、报告 Bug 或提出功能建议！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 提交 Pull Request

---

## 开源协议

本项目基于 [MIT License](./LICENSE) 开源。

Made with ❤️ by Antdv Next Team
