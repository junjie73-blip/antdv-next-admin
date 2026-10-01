export type WidgetKey = 'notice' | 'fullscreen' | 'theme' | 'timezone' | 'logout' | 'search' | 'preferences'

export interface WidgetMeta {
  key: WidgetKey
  title: string
  icon: string
  component: () => Promise<unknown>
}
