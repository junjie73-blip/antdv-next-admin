import type { BackendMenu } from '@antdv/types';

/**
 * Mock 账号表：凭据 → 角色 / 权限码 → 可见菜单，一条记录讲完一个人的权限来源。
 *
 * 为什么要两个账号：本项目**菜单即权限**（`stores/modules/route.ts` 把树上的
 * name/path 摊成 allowedNames/allowedPaths，守卫按它判 403），只有一份账号时
 * 所有页面永远可达，"权限生成对不对"这件事根本无法被观测 —— 按钮、指令、
 * 路由三层都在同一个全通账号上跑，看起来一切正常。
 *
 * - `admin` 持有 `permissions: ['*']`，走通配分支；
 * - `custom` 没有任何通配，权限码逐条列出，菜单被裁到一小部分，
 *   越界直达（如 `/system/menu`）应当落 403。
 *
 * Token 形如 `mock_token_<username>_<timestamp>`：把身份编码进 token，
 * 好让 `/menus`、`/auth/user-info` 这类"读会话"的接口能按请求头分账号返回。
 * 这是 mock 的取巧手法，不是安全的会话凭据 —— 真实后端应验签后再取身份。
 */
export interface MockAccount {
  /** 登录凭据（mock 明文，勿照搬到真实服务） */
  password: string;
  /** 业务权限码；`'*'` 表示全通，由 `usePermission` 的通配分支消费 */
  permissions: string[];
  profile: {
    avatar: string;
    email: string;
    id: string;
    nickname: string;
    phone: string;
    username: string;
  };
  roles: string[];
  /**
   * 可见菜单**叶子**节点的 name；`null` = 整棵树都给了（不做裁剪）。
   * 目录节点不用列：只要还剩一个孩子，`pickMenus` 就保留它这个壳 ——
   * 剔掉父壳会把孩子的绝对 path 一起丢掉，导航直接断。
   */
  visibleMenus: null | string[];
}

/** token 前缀；改这里要同步 `mock:fixtures` 生成器与浏览器内 overlay */
export const TOKEN_PREFIX = 'mock_token_';

/** 元组头保证"至少一条"：`noUncheckedIndexedAccess` 下 `accounts[0]` 才是 `MockAccount` 而不是 `| undefined` */
export const accounts: [MockAccount, ...MockAccount[]] = [
  {
    password: 'admin123',
    permissions: ['*'],
    profile: {
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
      email: 'admin@antdv-next.com',
      id: '1',
      nickname: '管理员',
      phone: '138-0000-0001',
      username: 'admin',
    },
    roles: ['admin'],
    visibleMenus: null,
  },
  {
    password: 'custom123',
    // 逐条列举，故意不含 `*`：这样"权限码没配全"会表现为按钮消失 / 403，而不是被通配掩盖
    permissions: [
      'dashboard:analysis:list',
      'demo:task:list',
      'demo:task:query',
      'demo:task:add',
      'demo:task:edit',
      // 故意不给 remove：按钮级权限需要一个"看得见页面、看不见按钮"的账号才能被观测，
      // 「表格增删改查」示例页就靠这条差异演示 `ActionItem.auth`
      'demo:task:export',
      'system:role:list',
      'system:role:query',
      'system:user:list',
      'system:user:query',
    ],
    profile: {
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=custom',
      email: 'custom@antdv-next.com',
      id: '2',
      nickname: '演示用户',
      phone: '138-0000-0002',
      username: 'custom',
    },
    roles: ['custom'],
    visibleMenus: [
      'Analysis',
      'AccountCenter',
      'AccountSettings',
      'DemoComponentsOverview',
      'DemoTableAnimation',
      'DemoTableBasic',
      'DemoTableCrud',
      'DemoTableDragSort',
      'DemoTableTree',
      'SystemRole',
      'SystemUser',
    ],
  },
];

/** 未带（或带坏）token 时的回落账号：mock 允许直接浏览接口数据，不必先登录 */
export const defaultAccount = accounts[0];

export function authenticate(
  username: string,
  password: string,
): MockAccount | undefined {
  return accounts.find(
    (account) =>
      account.profile.username === username && account.password === password,
  );
}

export function issueToken(account: MockAccount): string {
  return `${TOKEN_PREFIX}${account.profile.username}_${Date.now()}`;
}

/** 从 token 反解账号；识别不了就返回 undefined（调用方回落 `defaultAccount`） */
export function accountOfToken(token?: string): MockAccount | undefined {
  const raw = (token ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!raw.startsWith(TOKEN_PREFIX)) return undefined;
  const username = raw.slice(TOKEN_PREFIX.length).replace(/_\d+$/, '');
  return accounts.find((account) => account.profile.username === username);
}

/**
 * 按请求头里的 Authorization 取账号。
 *
 * 键名不假定大小写：Node 的入站头是小写，浏览器 fetch 里写的却是
 * `Authorization`，而 h3 的版本差异会让载体在 `IncomingHttpHeaders` 与
 * `Headers` 之间变。所以这里做一次性忽略大小写的查找，而不是 `headers.authorization`。
 */
export function accountOfHeaders(
  headers: Record<string, string>,
): MockAccount | undefined {
  const authorization = Object.entries(headers).find(
    ([name]) => name.toLowerCase() === 'authorization',
  )?.[1];
  return accountOfToken(authorization);
}

export function resolveAccount(headers: Record<string, string>): MockAccount {
  return accountOfHeaders(headers) ?? defaultAccount;
}

/** 按 name 白名单裁剪菜单树：叶子按名单取舍，父壳跟着孩子走 */
export function pickMenus(
  list: BackendMenu[],
  visibleMenus: null | string[],
): BackendMenu[] {
  if (!visibleMenus) return list;
  const allowed = new Set(visibleMenus);
  const picked: BackendMenu[] = [];
  for (const menu of list) {
    const children = menu.children?.length
      ? pickMenus(menu.children, visibleMenus)
      : [];
    if (children.length > 0) {
      picked.push({ ...menu, children });
      continue;
    }
    if (menu.children?.length) continue;
    if (menu.name && allowed.has(menu.name)) picked.push(menu);
  }
  return picked;
}
