export interface MicroAppItem {
  /** 子应用唯一标识 */
  name: string
  /** 子应用访问地址 */
  url: string
  /** 显示名称 */
  title: string
  /** 图标 */
  icon?: string
  /** 是否运行中 */
  active?: boolean
  /** 基础路由 */
  baseroute?: string
  /** 应用描述 */
  description?: string
  /** 版本号 */
  version?: string
  /** 负责人/团队 */
  owner?: string
  /** 最后更新时间 */
  lastUpdate?: string
  /** 健康检查地址 */
  healthUrl?: string
  /** 加载方式：iframe / webcomponent */
  loader?: 'iframe' | 'webcomponent'
}

export interface MicroAppConfig {
  enabled: boolean
  apps: MicroAppItem[]
}

declare global {
  interface ImportMetaEnv {
    VITE_MICRO_APP?: string | boolean
  }
}
