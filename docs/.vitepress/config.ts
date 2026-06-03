import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Antdv Next Vue Admin',
  description: '现代化企业级后台管理系统模板 - 基于 Vue 3 + TypeScript + Antdv Next + Tailwind CSS',
  lang: 'zh-CN',
  // GitHub Pages 部署路径，与仓库名保持一致
  base: process.env.VITEPRESS_BASE || '/',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['meta', { name: 'theme-color', content: '#1890ff' }],
  ],

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: false,

    nav: [
      { text: '指南', link: '/guide/introduction' },
      { text: '组件', link: '/components/table' },
      {
        text: '更多',
        items: [
          { text: 'Changelog', link: 'https://github.com/your-repo/antdv-next-admin/blob/main/CHANGELOG.md' },
          { text: 'GitHub', link: 'https://github.com/your-repo/antdv-next-admin' },
        ],
      },
    ],

    sidebar: {
      '/guide/': [
        {
          text: '开始',
          items: [
            { text: '项目介绍', link: '/guide/introduction' },
            { text: '快速开始', link: '/guide/getting-started' },
            { text: '目录结构', link: '/guide/directory-structure' },
          ],
        },
        {
          text: '基础',
          items: [
            { text: '技术栈说明', link: '/guide/tech-stack' },
            { text: '开发规范', link: '/guide/conventions' },
            { text: '环境变量', link: '/guide/env-variables' },
          ],
        },
        {
          text: '功能特性',
          items: [
            { text: '权限系统', link: '/guide/features/permission' },
            { text: '国际化 i18n', link: '/guide/features/i18n' },
            { text: '主题系统', link: '/guide/features/theme' },
            { text: '数据导出与打印', link: '/guide/features/export-print' },
            { text: '微前端集成', link: '/guide/features/micro-app' },
            { text: '锁屏保护', link: '/guide/features/lock-screen' },
          ],
        },
        {
          text: '业务模块',
          items: [
            { text: '用户管理', link: '/guide/modules/user' },
            { text: '角色管理', link: '/guide/modules/role' },
            { text: '操作日志', link: '/guide/modules/log' },
            { text: '在线用户', link: '/guide/modules/online' },
            { text: '消息通知', link: '/guide/modules/notice' },
            { text: '微前端管理', link: '/guide/modules/micro-app' },
          ],
        },
        {
          text: '工程化',
          items: [
            { text: '构建部署', link: '/guide/engineering/build' },
            { text: '版本发布', link: '/guide/engineering/release' },
            { text: '测试指南', link: '/guide/engineering/testing' },
          ],
        },
      ],
      '/components/': [
        {
          text: '业务组件',
          items: [
            { text: 'Table 表格', link: '/components/table' },
            { text: 'Form 表单', link: '/components/form' },
            { text: 'Modal 弹窗', link: '/components/modal' },
            { text: 'Drawer 抽屉', link: '/components/drawer' },
            { text: 'Description 描述列表', link: '/components/description' },
            { text: 'Upload 上传', link: '/components/upload' },
            { text: 'CountTo 数字动画', link: '/components/count-to' },
            { text: 'MarkdownEditor 编辑器', link: '/components/markdown-editor' },
            { text: 'MicroAppContainer 微前端容器', link: '/components/micro-app-container' },
            { text: 'LockScreen 锁屏', link: '/components/lock-screen' },
          ],
        },
        {
          text: '通用工具',
          items: [
            { text: 'Excel 导出工具', link: '/components/utils/excel' },
            { text: '打印工具', link: '/components/utils/print' },
            { text: '缓存存储', link: '/components/utils/cache' },
            { text: '类名合并 (cn)', link: '/components/utils/cn' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/your-repo/antdv-next-admin' },
    ],

    footer: {
      message: '基于 MIT 协议发布',
      copyright: 'Copyright © 2024-present Antdv Next Team',
    },

    editLink: {
      pattern: 'https://github.com/your-repo/antdv-next-admin/edit/main/docs/:path',
      text: '在 GitHub 上编辑此页',
    },

    lastUpdated: {
      text: '最后更新于',
    },

    search: {
      provider: 'local',
    },
  },
})
