export interface MicroAppItem {
  name: string
  url: string
  title: string
  icon?: string
  active?: boolean
  baseroute?: string
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
