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
    },
  ],
}

export function getMicroAppByName(name: string): MicroAppItem | undefined {
  return microAppConfig.apps.find(app => app.name === name)
}

export function getAllMicroApps(): MicroAppItem[] {
  return microAppConfig.apps
}
