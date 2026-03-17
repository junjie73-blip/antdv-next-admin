import type { RouteRecordRaw } from 'vue-router'

export type RouteMeta = {
  title: string
  icon?: string
  hidden?: boolean
  keepAlive?: boolean
  requiresAuth?: boolean
  roles?: string[]
  permissions?: string[]
  layout?: 'default' | 'blank'
}

export type AppRouteRecordRaw = RouteRecordRaw & {
  meta?: RouteMeta
  children?: AppRouteRecordRaw[]
}

export interface RouteLocation {
  path: string
  name?: string
  meta?: RouteMeta
}
