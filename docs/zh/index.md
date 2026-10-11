---
layout: home

hero:
  name: Antdv Admin
  text: Vue 3 + antdv-next 后台模板
  tagline: pnpm Monorepo、进程内 Nitro Mock、三引擎端到端测试、Vercel + GitHub Pages 托管
  actions:
    - theme: brand
      text: 快速开始
      link: /zh/getting-started
    - theme: alt
      text: Monorepo 架构
      link: /zh/architecture
    - theme: alt
      text: CI 与部署
      link: /zh/deploy

features:
  - title: 拆干净的子包
    details: 9 个运行时子包 + 内部工具包。共享包一律不 import pinia / vue-router / store，需要的能力靠依赖注入拿，所以能在别的项目里单点复用。
  - title: 7 种布局形态
    details: 顶栏、侧栏、图标栏、面包屑的组合由"区域蓝图"描述，加形态不用改布局组件。
  - title: 主题真的会跟着变
    details: 主色、圆角、字号、侧栏宽度写进 CSS 变量，菜单选中项、link 按钮、进度条一起换色，暗黑与灰色/色弱模式同一条链路。
  - title: 零后端可跑
    details: dev 进程内拉起 Nitro Mock（5320），21 个菜单页面、登录、上传、定时任务全部有数据，不用先起后端。
  - title: 三引擎端到端
    details: Playwright 在 Chromium / Firefox / WebKit 上跑真实 dev server，加上 250+ 条单测和几条"源码契约"守卫，绿了再合。
  - title: changesets 管版本
    details: 改动带 changeset，`pnpm version` 生成 CHANGELOG，`pnpm release` 发布，不再手写版本号。
---

## 这套文档想回答什么

| 你的处境 | 直接去 |
| --- | --- |
| 刚 clone，想跑起来 | [快速开始](/zh/getting-started) |
| 想知道代码为什么这么摆 | [Monorepo 架构](/zh/architecture) |
| 要改菜单 / 标签页 / 布局 | [布局、菜单与标签页](/zh/layout) |
| 要换主题色、加偏好开关 | [主题与偏好设置](/zh/theming) |
| 要控制按钮 / 路由权限 | [权限与指令](/zh/permissions) |
| 要加一个假接口 | [Mock 服务](/zh/mock) |
| 提交前要过什么检查 | [开发规范与环境变量](/zh/development)、[测试策略](/zh/testing) |
| 要上线 | [CI 与部署](/zh/deploy) |

::: info 约定
文档里的命令行都在仓库根目录执行，包管理器固定 `pnpm@10.12.4`（`packageManager` 字段已锁），Node 要求 `>=22`，本地用 `.node-version` 里的 24.0.0。
:::
