import { defineConfig } from 'vitepress';

/**
 * 站点文档（VitePress）配置。中英双语，`/` 与 `/en/` 各一套内容；**默认中文** ——
 * 根路径 `docs/index.md` 只有一条 `redirect: /`，打开站点直接落到中文首页，
 * 英文靠语言菜单跳到 `/en/`（不再有"选择语言"中间页）。
 *
 * 信息架构参考 vben（doc.vben.pro）：正文在 `guide/` 下按 `introduction`（介绍）/
 * `essentials`（基础）/ `in-depth`（深入）/ `project`（工程）/ `other`（其他）分层，
 * 示例文档另起一章 `components/`（组件示例）并**用独立的侧栏键**（`/components/`）——
 * 混进 `guide` 的侧栏会让读指南的人全程拖着 8 条示例页。两边**目录与文件名逐一对应**，
 * 侧栏分组与阅读顺序一致 —— 一份 `sidebar` 里出现的每个 link，两边都要有同名文件。
 * 加页面时先在 `zh` 落地，再补同路径的 `en`，只补一边会让语言切换跳到 404。
 *
 * 这个包不参与应用构建：`@antdv/web` 不依赖它，`turbo build` 只把它当成一个独立的
 * build 任务。部署走 GitHub Actions + GitHub Pages（`.github/workflows/docs.yml`），
 * 和管理后台本身（Vercel）分开，两边发布节奏互不影响 —— 取舍写在 `deploy.md`。
 *
 * `locales` 的键必须是裸语言码（`zh` / `en`），不能写成路径 `'/'`：VitePress 内部拿
 * 键去拼 `/${key}/` 做正则匹配当前路由（见 `getLocaleForPath`），写成路径就变成
 * `///`，永远匹配不上，locale 级的 `themeConfig`（导航、侧栏、搜索文案）会整体失效 ——
 * 表现是页面正文正常、侧栏和顶栏菜单是空的。键用裸码后 `link` 缺省推导出的仍是 `/`，
 * URL 不变。
 *
 * 语言切换用默认主题自带的菜单（`VPNavBarTranslations` / `VPNavScreenTranslations`），
 * 它按当前页面路径跳到另一语言的同一篇，所以两边**文件名必须一致**；`langMenuLabel`
 * 只负责把这个菜单的标签本地化。注意顶栏那份只在视口 ≥1280px 出现，更窄的窗口靠汉堡
 * 菜单里那份 —— 这是上游的响应式取舍，不必为此另写组件。
 *
 * `base` 由环境变量决定：GitHub Pages 的项目站挂在 `/<仓库名>/` 下，路径不对会出现
 * "HTML 在、样式全 404"；本地 dev / preview 挂在根路径，所以默认 `/`。
 *
 * logo 与图标来自 `docs/public/`，源头是 web 子包（`apps/web/public/favicon.ico`、
 * `apps/web/public/pwa-icons/{logo,apple-touch-icon-180x180}.png`）—— VitePress 只能服务
 * `public/` 下的文件，所以是**拷贝**而非引用；换 logo 时记得两边一起改。
 * `themeConfig.logo` 和 hero 图片都会经过 `withBase`，写 `/logo.png` 即可，别硬编码 `base`；
 * 但 `head` 里的 favicon 不会，得自己拼 `base`。
 */
const base = process.env.VITEPRESS_BASE ?? '/antdv-next-admin';

export default defineConfig({
  title: 'Antdv Admin',
  description: 'Vue 3 + antdv-next 后台管理模板：架构、开发、测试与部署说明',
  lastUpdated: true,
  cleanUrls: true,
  base,

  head: [
    /*
     * 两条 icon 都要：`favicon.ico` 是 48×48 的 PNG-in-ICO，Safari 与部分
     * 国产浏览器内核解不了这种容器，只给它就会退回默认地球图标；补一条 PNG 才稳。
     */
    [
      'link',
      { rel: 'icon', type: 'image/x-icon', href: `${base}/favicon.ico` },
    ],
    [
      'link',
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '64x64',
        href: `${base}/logo.png`,
      },
    ],
    ['link', { rel: 'apple-touch-icon', href: `${base}/apple-touch-icon.png` }],
    ['meta', { name: 'theme-color', content: '#1677ff' }],
  ],

  locales: {
    root: {
      label: '简体中文',
      lang: 'zh-CN',
      titleTemplate: ':title | Antdv Admin 文档',
      description:
        'Vue 3 + antdv-next 后台管理模板：开发、功能、工程化与部署说明',
      themeConfig: {
        nav: [
          { text: '指南', link: '/guide/introduction/quick-start' },
          { text: '组件示例', link: '/components/' },
          { text: '更新日志', link: '/guide/other/changelog' },
          { text: '常见问题', link: '/guide/other/faq' },
        ],
        sidebar: {
          '/guide/': [
            {
              text: '介绍',
              items: [
                { text: '快速开始', link: '/guide/introduction/quick-start' },
              ],
            },
            {
              text: '基础',
              items: [
                { text: '基础概念', link: '/guide/essentials/concepts' },
                { text: '本地开发', link: '/guide/essentials/development' },
                { text: '路由和菜单', link: '/guide/essentials/route' },
                { text: '配置', link: '/guide/essentials/config' },
                { text: '图标', link: '/guide/essentials/icons' },
                { text: '样式', link: '/guide/essentials/styles' },
                { text: '工具', link: '/guide/essentials/utils' },
                { text: '状态管理', link: '/guide/essentials/stores' },
                { text: '缓存', link: '/guide/essentials/cache' },
                { text: '外部模块', link: '/guide/essentials/external' },
                {
                  text: '服务端交互与接口约定',
                  link: '/guide/essentials/request',
                },
                { text: '数据 Mock', link: '/guide/essentials/mock' },
                { text: '构建与部署', link: '/guide/essentials/deploy' },
              ],
            },
            {
              text: '深入',
              items: [
                { text: '登录', link: '/guide/in-depth/login' },
                { text: '主题', link: '/guide/in-depth/theme' },
                { text: '权限', link: '/guide/in-depth/access' },
                {
                  text: '国际化',
                  link: '/guide/in-depth/internationalization',
                },
                { text: '常用功能', link: '/guide/in-depth/common' },
                { text: '组合式函数', link: '/guide/in-depth/composables' },
                { text: '检查更新', link: '/guide/in-depth/check-update' },
                { text: '全局 loading', link: '/guide/in-depth/loading' },
                { text: '布局与标签页', link: '/guide/in-depth/layout' },
              ],
            },
            {
              text: '工程',
              items: [
                { text: '规范', link: '/guide/project/protocol' },
                { text: 'CLI', link: '/guide/project/cli' },
                { text: '目录说明', link: '/guide/project/dir' },
                { text: '单元测试', link: '/guide/project/testing' },
                { text: 'Tailwind CSS', link: '/guide/project/tailwindcss' },
                { text: 'Changeset', link: '/guide/project/changeset' },
                { text: 'Vite Config', link: '/guide/project/vite' },
              ],
            },
            {
              text: '其他',
              items: [
                { text: '项目更新', link: '/guide/other/project-update' },
                { text: '移除代码', link: '/guide/other/remove-code' },
                { text: '更新日志', link: '/guide/other/changelog' },
                { text: '常见问题', link: '/guide/other/faq' },
              ],
            },
          ],
          /** 组件示例是独立一章，不混进指南侧栏：读指南时不该被 8 条示例页拖着走 */
          '/components/': [
            {
              text: '组件示例',
              items: [
                { text: '总览', link: '/components/' },
                { text: '表格', link: '/components/table' },
                { text: '表单', link: '/components/form' },
                { text: '弹窗与抽屉', link: '/components/modal-drawer' },
                { text: '数据与展示', link: '/components/display' },
                { text: '编辑器与文件上传', link: '/components/editor-upload' },
                { text: '图表与 Cron', link: '/components/chart-cron' },
                { text: '指令与拖拽布局', link: '/components/directive-drag' },
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
        'A Vue 3 + antdv-next admin template: development, features, tooling and deployment',
      themeConfig: {
        nav: [
          { text: 'Guide', link: '/en/guide/introduction/quick-start' },
          { text: 'Examples', link: '/en/components/' },
          { text: 'Changelog', link: '/en/guide/other/changelog' },
          { text: 'FAQ', link: '/en/guide/other/faq' },
        ],
        sidebar: {
          '/en/guide/': [
            {
              text: 'Introduction',
              items: [
                {
                  text: 'Quick start',
                  link: '/en/guide/introduction/quick-start',
                },
              ],
            },
            {
              text: 'Essentials',
              items: [
                {
                  text: 'Core concepts',
                  link: '/en/guide/essentials/concepts',
                },
                {
                  text: 'Local development',
                  link: '/en/guide/essentials/development',
                },
                { text: 'Routes and menu', link: '/en/guide/essentials/route' },
                { text: 'Configuration', link: '/en/guide/essentials/config' },
                { text: 'Icons', link: '/en/guide/essentials/icons' },
                { text: 'Styles', link: '/en/guide/essentials/styles' },
                { text: 'Utilities', link: '/en/guide/essentials/utils' },
                {
                  text: 'State management',
                  link: '/en/guide/essentials/stores',
                },
                { text: 'Caching', link: '/en/guide/essentials/cache' },
                {
                  text: 'External modules',
                  link: '/en/guide/essentials/external',
                },
                {
                  text: 'Server interaction and API contract',
                  link: '/en/guide/essentials/request',
                },
                { text: 'Data mocking', link: '/en/guide/essentials/mock' },
                {
                  text: 'Build and deployment',
                  link: '/en/guide/essentials/deploy',
                },
              ],
            },
            {
              text: 'In depth',
              items: [
                { text: 'Login', link: '/en/guide/in-depth/login' },
                { text: 'Theming', link: '/en/guide/in-depth/theme' },
                { text: 'Access control', link: '/en/guide/in-depth/access' },
                {
                  text: 'Internationalization',
                  link: '/en/guide/in-depth/internationalization',
                },
                { text: 'Common features', link: '/en/guide/in-depth/common' },
                { text: 'Composables', link: '/en/guide/in-depth/composables' },
                {
                  text: 'Checking for updates',
                  link: '/en/guide/in-depth/check-update',
                },
                { text: 'Global loading', link: '/en/guide/in-depth/loading' },
                { text: 'Layout and tabs', link: '/en/guide/in-depth/layout' },
              ],
            },
            {
              text: 'Engineering',
              items: [
                { text: 'Conventions', link: '/en/guide/project/protocol' },
                { text: 'CLI', link: '/en/guide/project/cli' },
                { text: 'Directory structure', link: '/en/guide/project/dir' },
                { text: 'Unit testing', link: '/en/guide/project/testing' },
                { text: 'Tailwind CSS', link: '/en/guide/project/tailwindcss' },
                { text: 'Changeset', link: '/en/guide/project/changeset' },
                { text: 'Vite config', link: '/en/guide/project/vite' },
              ],
            },
            {
              text: 'Other',
              items: [
                {
                  text: 'Updating the project',
                  link: '/en/guide/other/project-update',
                },
                { text: 'Removing code', link: '/en/guide/other/remove-code' },
                { text: 'Changelog', link: '/en/guide/other/changelog' },
                { text: 'FAQ', link: '/en/guide/other/faq' },
              ],
            },
          ],
          /** Examples is its own chapter, not a group inside the guide sidebar */
          '/en/components/': [
            {
              text: 'Examples',
              items: [
                { text: 'Overview', link: '/en/components/' },
                { text: 'Table', link: '/en/components/table' },
                { text: 'Form', link: '/en/components/form' },
                {
                  text: 'Modal and drawer',
                  link: '/en/components/modal-drawer',
                },
                { text: 'Data and display', link: '/en/components/display' },
                {
                  text: 'Editor and upload',
                  link: '/en/components/editor-upload',
                },
                { text: 'Chart and cron', link: '/en/components/chart-cron' },
                {
                  text: 'Directives and drag layout',
                  link: '/en/components/directive-drag',
                },
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
    logo: '/logo.png',
    socialLinks: [
      {
        icon: 'github',
        link: 'https://github.com/junjie73-blip/antdv-next-admin',
      },
    ],
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
