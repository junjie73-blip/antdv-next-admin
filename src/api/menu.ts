import type { BackendMenu } from '#/menu'
import type { R } from '@/api/request'
import { get } from '@/api/request'

interface MenuResponse {
  list: BackendMenu[]
}

export function getMenus(): Promise<MenuResponse> {
  return get<MenuResponse>('/menus')
}