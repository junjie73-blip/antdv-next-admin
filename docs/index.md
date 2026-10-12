---
layout: home

hero:
  image:
    src: /logo-512.png
    alt: Antdv Admin
  name: Antdv Admin
  text: 企业级后台管理系统模板
  tagline: Vue 3 · antdv-next · Tailwind CSS v4 · pnpm Monorepo · 进程内 Nitro Mock · 三引擎端到端测试
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/introduction/quick-start
    - theme: alt
      text: 组件示例
      link: /components/
    - theme: alt
      text: 常见问题
      link: /guide/other/faq
    - theme: alt
      text: 在 GitHub 查看
      link: https://github.com/junjie73-blip/antdv-next-admin

features:
  - icon: 🧩
    title: 拆干净的子包
    details: 9 个运行时子包 + 4 个内部工具包。共享包一律不 import pinia / vue-router / store，需要的能力靠依赖注入拿，所以能在别的项目里单点复用。
    link: /guide/project/dir
    linkText: 看包结构
  - icon: 🧭
    title: 路由与菜单
    details: 文件约定式路由 + 布局插件 + 五段守卫；侧栏不来自路由表，而是登录后 /menus 的返回，再反过来裁剪注册表。
    link: /guide/essentials/route
    linkText: 读这一篇
  - icon: 🔌
    title: 自研请求层
    details: 基于 createFetch 而不是 axios：Bearer 注入、CSRF 双提交、指数退避重试、401 刷新并重放一次、卸载即取消。
    link: /guide/essentials/request
    linkText: 接口约定
  - icon: 🗃
    title: 状态管理
    details: 六个 setup store，持久化是手写的：缓存键前缀来自 VITE_APP_TITLE，生产值 SM4 加密，登出只有一个聚合出口。
    link: /guide/essentials/stores
    linkText: 状态与缓存
  - icon: 🎨
    title: 主题真的会跟着变
    details: 主色、圆角、字号、侧栏宽度写进 CSS 变量，菜单选中项、link 按钮、进度条一起换色，暗黑与灰色/色弱模式同一条链路。
    link: /guide/in-depth/theme
    linkText: 主题与偏好
  - icon: 🧱
    title: 7 种布局形态
    details: 顶栏、侧栏、图标栏、面包屑的组合由"区域蓝图"描述，加形态不用改布局组件；标签页与 keep-alive 同源。
    link: /guide/in-depth/layout
    linkText: 布局与标签页
  - icon: 🛡
    title: 权限三层
    details: 菜单即权限决定能进哪些路由，按钮级靠 hasPermission 与指令，越界统一落 /error/403；meta.roles 没有守卫读取。
    link: /guide/in-depth/access
    linkText: 权限与指令
  - icon: 🚀
    title: 零后端可跑
    details: dev 进程内拉起 Nitro Mock（5320），30+ 个示例页、登录、上传、定时任务全部有数据，还能在线调延迟与失败率。
    link: /guide/essentials/mock
    linkText: Mock 服务
  - icon: ✅
    title: 三引擎端到端
    details: Playwright 在 Chromium / Firefox / WebKit 上跑真实 dev server，加上 250+ 条单测和几条"源码契约"守卫，绿了再合。
    link: /guide/project/testing
    linkText: 测试策略
  - icon: 🖼
    title: 样式与图标
    details: Tailwind v4 显式层顺序，覆盖组件库不用 !important；图标是五套离线 Iconify 集合，SVG sprite 链路已接通。
    link: /guide/essentials/styles
    linkText: 样式约定
  - icon: 📦
    title: changesets 管版本
    details: 改动带 changeset，`pnpm version` 生成 CHANGELOG，`pnpm release` 发布，不再手写版本号。
    link: /guide/other/changelog
    linkText: 发版与更新日志
  - icon: 🌐
    title: 中英双语文档站
    details: VitePress 站点走 GitHub Actions 单独发布到 Pages，只构建文档，不跑 lint / type-check / e2e，两边发布节奏互不影响。
    link: /guide/essentials/deploy
    linkText: CI 与部署
---

## 这套文档想回答什么

| 你的处境 | 直接去 |
| --- | --- |
| 刚 clone，想跑起来 | [快速开始](/guide/introduction/quick-start) |
| 想知道有哪些组件可以用、怎么用 | [组件示例](/components/) |
| 想知道代码为什么这么摆 | [基础概念](/guide/essentials/concepts)、[目录说明](/guide/project/dir) |
| 要加一个页面 / 一条菜单 | [路由与菜单](/guide/essentials/route)、[布局、菜单与标签页](/guide/in-depth/layout) |
| 要调接口、加字段 | [请求层与接口约定](/guide/essentials/request)、[数据 Mock](/guide/essentials/mock) |
| 要存跨页面共享的状态 | [状态管理](/guide/essentials/stores) |
| 要写样式、找图标 | [样式与图标](/guide/essentials/styles) |
| 要换主题色、加偏好开关 | [主题与偏好设置](/guide/in-depth/theme) |
| 要控制按钮 / 路由权限 | [权限、指令与光标](/guide/in-depth/access) |
| 提交前要过什么检查 | [开发规范与环境变量](/guide/essentials/development)、[测试策略](/guide/project/testing) |
| 要上线 | [构建与部署](/guide/essentials/deploy) |
| 想知道这一版改了什么 | [更新日志](/guide/other/changelog) |
| 撞上别人踩过的坑 | [常见问题](/guide/other/faq) |

::: info 约定文档里的命令行都在仓库根目录执行，包管理器固定 `pnpm@10.12.4`（`packageManager` 字段已锁），Node 要求 `>=22`，本地用 `.node-version` 里的 24.0.0。:::
