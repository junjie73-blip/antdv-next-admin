/**
 * 源码接口清单（registry）
 *
 * legacy 里 vite-plugin-fake-server 在 dev server 启动时一次性加载全部 mock 文件，
 * 清单因此天然完整；Nitro 的 handler 模块要到首次命中才会加载（dev 懒加载）。
 * 这里保留一份与 legacy *.fake.ts 完全同序（按文件名字母序）的静态清单，
 * 由 server/plugins/init.ts 在启动时预注册，面板在任何请求发生前即可列出全量接口。
 *
 * defineMockRoute 自身仍会在模块加载时注册（幂等），本表只负责"提前"与"补全 duplicates"。
 */

import type { MockMethod } from '@antdv/types';

import type { RouteManifestItem } from './store';

import { keyOf, methodOf, moduleOf } from './route-meta';

interface SourceRoute {
  method: MockMethod;
  /** 分组覆盖：仅用于 legacy 中跨文件重复注册的接口（见 GET /system/user/options） */
  module?: string;
  path: string;
}

/** 与 legacy mock 文件逐一对应；顺序 = 文件名（auth → user），决定 duplicates 归属 */
const SOURCE_ROUTES: SourceRoute[] = [
  // auth.fake.ts
  { method: 'POST', path: '/auth/logout' },
  { method: 'GET', path: '/auth/user-info' },
  // dept.fake.ts
  { method: 'GET', path: '/system/dept/tree' },
  { method: 'GET', path: '/system/dept/list' },
  { method: 'POST', path: '/system/dept' },
  { method: 'PUT', path: '/system/dept/:id' },
  { method: 'DELETE', path: '/system/dept/:id' },
  // dict.fake.ts
  { method: 'GET', path: '/system/dict/list' },
  { method: 'GET', path: '/system/dict/items/:typeId' },
  { method: 'POST', path: '/system/dict' },
  { method: 'PUT', path: '/system/dict/:id' },
  { method: 'DELETE', path: '/system/dict/:id' },
  { method: 'POST', path: '/system/dict/item' },
  { method: 'PUT', path: '/system/dict/item/:id' },
  { method: 'DELETE', path: '/system/dict/item/:id' },
  // file.fake.ts
  { method: 'GET', path: '/system/file/list' },
  { method: 'GET', path: '/system/file/tree' },
  { method: 'POST', path: '/system/file/upload' },
  { method: 'DELETE', path: '/system/file/:id' },
  { method: 'POST', path: '/system/file/folder' },
  { method: 'PUT', path: '/system/file/:id' },
  // log.fake.ts
  { method: 'GET', path: '/system/log/list' },
  { method: 'DELETE', path: '/system/log/:id' },
  // login-log.fake.ts
  { method: 'GET', path: '/system/login-log/list' },
  { method: 'GET', path: '/system/login-log/stats' },
  // login.fake.ts
  { method: 'POST', path: '/auth/login' },
  // menu.fake.ts（注意 legacy 路径就是 /menus，不在 system 下）
  { method: 'GET', path: '/menus' },
  // notice.fake.ts
  { method: 'GET', path: '/system/notice/list' },
  { method: 'PUT', path: '/system/notice/read/:id' },
  { method: 'PUT', path: '/system/notice/read-all' },
  { method: 'DELETE', path: '/system/notice/:id' },
  // online.fake.ts
  { method: 'GET', path: '/system/online/list' },
  { method: 'DELETE', path: '/system/online/:tokenId' },
  // post.fake.ts
  { method: 'GET', path: '/system/post/list' },
  { method: 'POST', path: '/system/post' },
  { method: 'PUT', path: '/system/post/:id' },
  { method: 'DELETE', path: '/system/post/:id' },
  { method: 'GET', path: '/system/post/users/:postId' },
  // role.fake.ts —— role 文件里也注册了 GET /system/user/options，先加载者取得清单归属
  { method: 'GET', path: '/system/role/list' },
  { method: 'POST', path: '/system/role' },
  { method: 'PUT', path: '/system/role/:id' },
  { method: 'DELETE', path: '/system/role/:id' },
  { method: 'GET', module: 'system/role', path: '/system/user/options' },
  // screen.fake.ts
  { method: 'GET', path: '/screen/monitor' },
  // security.fake.ts
  { method: 'GET', path: '/security/score' },
  { method: 'GET', path: '/security/events/list' },
  { method: 'GET', path: '/security/stats' },
  { method: 'GET', path: '/security/alerts/list' },
  { method: 'POST', path: '/security/alerts/:alertId/handle' },
  // settings.fake.ts
  { method: 'GET', path: '/system/settings/list' },
  { method: 'POST', path: '/system/settings' },
  { method: 'PUT', path: '/system/settings/:id' },
  { method: 'DELETE', path: '/system/settings/:id' },
  // table.fake.ts
  { method: 'GET', path: '/table/list' },
  { method: 'GET', path: '/dashboard/stats' },
  // user.fake.ts —— options 与 role.fake.ts 重复注册，缺省分组 system/user 会进入 duplicates
  { method: 'GET', path: '/system/user/list' },
  { method: 'GET', path: '/system/user/:id' },
  { method: 'POST', path: '/system/user' },
  { method: 'PUT', path: '/system/user/:id' },
  { method: 'DELETE', path: '/system/user/:id' },
  { method: 'GET', path: '/system/user/options' },
];

/** 把紧凑表展开成 store 需要的 RouteManifestItem[] */
export function buildSourceManifest(): RouteManifestItem[] {
  return SOURCE_ROUTES.map((route) => ({
    duplicates: [],
    key: keyOf(route.method, route.path),
    method: methodOf(route.method),
    module: route.module ?? moduleOf(route.path),
    path: route.path,
    source: 'source',
  }));
}
