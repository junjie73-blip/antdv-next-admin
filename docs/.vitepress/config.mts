import { defineConfig } from 'vitepress';

/**
 * 站点文档（VitePress）配置。中英双语，`/zh/` 与 `/en/` 各一套内容，根路径是语言选择页。
 *
 * 这个包不参与应用构建：`@antdv/web` 不依赖它，`turbo build` 只把它当成一个独立的
 * build 任务。部署走 GitHub Actions + GitHub Pages（`.github/workflows/docs.yml`），
 * 和管理后台本身（Vercel）分开，两边发布节奏互不影响 —— 取舍写在 `deploy.md`。
 *
 * `locales` 的键必须是裸语言码（`zh` / `en`），不能写成路径 `'/zh/'`：VitePress 内部拿
 * 键去拼 `/${key}/` 做正则匹配当前路由（见 `getLocaleForPath`），写成路径就变成
 * `//zh//`，永远匹配不上，locale 级的 `themeConfig`（导航、侧栏、搜索文案）会整体失效 ——
 * 表现是页面正文正常、侧栏和顶栏菜单是空的。键用裸码后 `link` 缺省推导出的仍是 `/zh/`，
 * URL 不变。
 *
 * 语言切换用默认主题自带的菜单（`VPNavBarTranslations` / `VPNavScreenTranslations`），
 * 它按当前页面路径跳到另一语言的同一篇，所以两边**文件名必须一致**；`langMenuLabel`
 * 只负责把这个菜单的标签本地化。注意顶栏那份只在视口 ≥1280px 出现，更窄的窗口靠汉堡
 * 菜单里那份 —— 这是上游的响应式取舍，不必为此另写组件。
 *
 * `base` 由环境变量决定：GitHub Pages 的项目站挂在 `/<仓库名>/` 下，路径不对会出现
 * "HTML 在、样式全 404"；本地 dev / preview 挂在根路径，所以默认 `/`。
 */
export default defineConfig({
  lang: 'zh-CN',
  title: 'Antdv Admin',
  description: 'Vue 3 + antdv-next 后台管理模板：架构、开发、测试与部署说明',
  lastUpdated: true,
  cleanUrls: true,
  base: process.env.VITEPRESS_BASE ?? '/',

  locales: {
    zh: {
      label: '简体中文',
      lang: 'zh-CN',
      titleTemplate: ':title | Antdv Admin 文档',
      description: 'Vue 3 + antdv-next 后台管理模板：架构、开发、测试与部署说明',
      themeConfig: {
        nav: [
          { text: '开始', link: '/zh/' },
          { text: '架构', link: '/zh/architecture' },
          { text: '开发', link: '/zh/development' },
          { text: '测试', link: '/zh/testing' },
          { text: '部署', link: '/zh/deploy' },
        ],
        sidebar: {
          '/zh/': [
            {
              text: '指南',
              items: [
                { text: '简介', link: '/zh/' },
                { text: '快速开始', link: '/zh/getting-started' },
                { text: 'Monorepo 架构', link: '/zh/architecture' },
              ],
            },
            {
              text: '功能',
              items: [
                { text: '布局、菜单与标签页', link: '/zh/layout' },
                { text: '主题与偏好设置', link: '/zh/theming' },
                { text: '权限与指令', link: '/zh/permissions' },
                { text: 'Mock 服务', link: '/zh/mock' },
              ],
            },
            {
              text: '工程化',
              items: [
                { text: '开发规范与环境变量', link: '/zh/development' },
                { text: '测试策略', link: '/zh/testing' },
                { text: 'CI 与部署', link: '/zh/deploy' },
              ],
            },
          ],
        },
        langMenuLabel: '切换语言',
        outline: { level: [2, 3], label: '本页目录' },
        docFooter: { prev: '上一篇', next: '下一篇' },
        lastUpdatedText: '最后更新',
        darkModeSwitchLabel: '外观',
        sidebarMenuLabel: '目录',
        returnToTopLabel: '回到顶部',
      },
    },
    en: {
      label: 'English',
      lang: 'en-US',
      titleTemplate: ':title | Antdv Admin Docs',
      description:
        'A Vue 3 + antdv-next admin template: architecture, development, testing and deployment',
      themeConfig: {
        nav: [
          { text: 'Start', link: '/en/' },
          { text: 'Architecture', link: '/en/architecture' },
          { text: 'Development', link: '/en/development' },
          { text: 'Testing', link: '/en/testing' },
          { text: 'Deploy', link: '/en/deploy' },
        ],
        sidebar: {
          '/en/': [
            {
              text: 'Guide',
              items: [
                { text: 'Introduction', link: '/en/' },
                { text: 'Getting Started', link: '/en/getting-started' },
                { text: 'Monorepo Architecture', link: '/en/architecture' },
              ],
            },
            {
              text: 'Features',
              items: [
                { text: 'Layout, Menu & Tabs', link: '/en/layout' },
                { text: 'Theming & Preferences', link: '/en/theming' },
                { text: 'Permissions & Directives', link: '/en/permissions' },
                { text: 'Mock Service', link: '/en/mock' },
              ],
            },
            {
              text: 'Engineering',
              items: [
                { text: 'Conventions & Env Vars', link: '/en/development' },
                { text: 'Testing Strategy', link: '/en/testing' },
                { text: 'CI & Deployment', link: '/en/deploy' },
              ],
            },
          ],
        },
        langMenuLabel: 'Change language',
        outline: { level: [2, 3], label: 'On this page' },
        docFooter: { prev: 'Previous page', next: 'Next page' },
        lastUpdatedText: 'Last updated',
        darkModeSwitchLabel: 'Appearance',
        sidebarMenuLabel: 'Menu',
        returnToTopLabel: 'Return to top',
      },
    },
  },

  themeConfig: {
    socialLinks: [{ icon: 'github', link: 'https://github.com/junjee73-blip/antdv-next-admin' }],
    search: {
      provider: 'local',
      options: {
        /* 英文用 VitePress 自带文案，只给中文这套补翻译 */
        locales: {
          zh: {
            translations: {
              button: { buttonText: '站内搜索', buttonAriaLabel: '搜索文档' },
              modal: {
                displayDetails: '显示详细列表',
                resetButtonTitle: '重置查询',
                backButtonTitle: '关闭搜索',
                noResultsText: '没有找到相关的结果',
                footer: {
                  selectText: '选择',
                  selectKeyAriaLabel: '回车',
                  navigateText: '切换',
                  navigateUpKeyAriaLabel: '上箭头',
                  navigateDownKeyAriaLabel: '下箭头',
                  closeText: '关闭',
                  closeKeyAriaLabel: 'Esc',
                },
              },
            },
          },
        },
      },
    },
  },

  vite: {
    server: {
      /* 和管理后台 dev（6080）、Nitro mock（5320）错开，三个服务可以同时开着 */
      port: 5200,
    },
  },
});
