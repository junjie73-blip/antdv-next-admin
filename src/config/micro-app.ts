import type { MicroAppConfig, MicroAppItem } from '#/micro-app'

export const microAppConfig: MicroAppConfig = {
  enabled: import.meta.env.VITE_MICRO_APP === 'true' || import.meta.env.VITE_MICRO_APP === true,
  apps: [
    {
      name: 'sub-app-example',
      url: 'http://localhost:9090',
      title: '子应用示例',
      icon: 'carbon:application',
      active: false,
      baseroute: '/sub-app',
      description: '示例子应用，用于演示微前端集成能力',
      version: '1.0.0',
      owner: '前端团队 A',
      lastUpdate: '2025-01-15 10:30:00',
      healthUrl: '/api/health',
      loader: 'webcomponent',
    },
    {
      name: 'crm-system',
      url: 'http://localhost:9091',
      title: 'CRM 客户管理',
      icon: 'carbon:user-multiple',
      active: true,
      baseroute: '/crm',
      description: '客户关系管理系统，包含客户、商机、合同等模块',
      version: '2.3.1',
      owner: '业务中台组',
      lastUpdate: '2025-01-14 16:45:00',
      healthUrl: '/crm/health',
      loader: 'webcomponent',
    },
    {
      name: 'data-bi',
      url: 'http://localhost:9092',
      title: '数据 BI 平台',
      icon: 'carbon:chart-line-data',
      active: false,
      baseroute: '/bi',
      description: '商业智能数据分析平台，支持报表、大屏、自助分析',
      version: '3.0.2',
      owner: '数据团队',
      lastUpdate: '2025-01-13 09:20:00',
      loader: 'iframe',
    },
    {
      name: 'workflow-engine',
      url: 'http://localhost:9093',
      title: '流程引擎中心',
      icon: 'carbon:flow',
      active: true,
      baseroute: '/workflow',
      description: '工作流引擎，支持审批流、任务流转、流程设计器',
      version: '1.8.5',
      owner: '平台架构组',
      lastUpdate: '2025-01-12 14:10:00',
      healthUrl: '/wf/api/health',
      loader: 'webcomponent',
    },
    {
      name: 'file-manager',
      url: 'http://localhost:9094',
      title: '文件管理中心',
      icon: 'carbon:document',
      active: false,
      baseroute: '/files',
      description: '企业级文件管理系统，支持文档预览、在线编辑、版本控制',
      version: '2.1.0',
      owner: '基础服务组',
      lastUpdate: '2025-01-11 11:55:00',
      loader: 'iframe',
    },
    {
      name: 'message-center',
      url: 'http://localhost:9095',
      title: '消息通知中心',
      icon: 'carbon:notification',
      active: true,
      baseroute: '/message',
      description: '统一消息推送服务，支持站内信、短信、邮件、钉钉等多渠道',
      version: '1.5.3',
      owner: '中间件团队',
      lastUpdate: '2025-01-10 08:40:00',
      healthUrl: '/msg/health',
      loader: 'webcomponent',
    },
  ],
}

export function getMicroAppByName(name: string): MicroAppItem | undefined {
  return microAppConfig.apps.find(app => app.name === name)
}

export function getAllMicroApps(): MicroAppItem[] {
  return microAppConfig.apps
}
