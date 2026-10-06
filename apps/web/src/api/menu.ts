import type { BackendMenu } from '@antdv/types';

import { get } from '~/api/request';

interface MenuResponse {
  list: BackendMenu[];
}

export function getMenus(): Promise<MenuResponse> {
  return get<MenuResponse>('/menus');
}
