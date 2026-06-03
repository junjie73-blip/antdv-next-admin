import type { BackendMenu } from '#/menu'
import { get } from '@/api/request'

interface MenuResponse {
  list: BackendMenu[]
}

export function getMenus(): Promise<MenuResponse> {
  return get<MenuResponse>('/menus')
}
