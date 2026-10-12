export type HttpMethod = 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';

/**
 * 单条接口：路径已归一化（不含接口前缀与查询串），Nitro 文件路由的 `[id]` 写成 `:id`。
 *
 * 集合（`collection`）是写覆盖层的锚点：读接口用它登记内存副本，写接口用同一个规则
 * 反查要改的那份副本，所以两边的推导必须一致。
 */
export interface FixtureRoute {
  /** 归属集合根，例如 `/system/user`；不属于任何可写集合时省略 */
  collection?: string;
  /** 列表接口在 `data` 里的数组字段（本项目一律 `list`） */
  listField?: string;
  method: HttpMethod;
  path: string;
  /**
   * 从 Nitro 现网抓下来的响应信封。
   * 写接口没有它 —— 抓一次写接口会真的改掉开发中 mock 服务的数据（DELETE 尤其致命），
   * 所以写响应由覆盖层按同一信封格式现造。
   */
  response?: unknown;
  /**
   * 由覆盖层**当场构造**应答的接口名（实现见 `dynamic.ts`）。
   *
   * 用于快照表达不了的接口：上传是 multipart、返回值还要求每次唯一，
   * 生成器把它列在透传名单里（不进 fixtures），产物里就没有别的数据来源，
   * 只能按 `backend-mock/server/utils/upload.ts` 的同一份契约现造。
   */
  replier?: string;
  /** 列表接口在 `data` 里的总数字段 */
  totalField?: string;
}

/**
 * 一个 mock 账号：凭据 + 身份 + 权限码 + 可见菜单白名单。
 *
 * 浏览器内 mock 没有服务端会话可问，所以「谁能登录、登录后看到哪些菜单」
 * 必须跟着快照一起进包 —— 少了 `visibleMenus`，生产预览里所有账号都会拿到
 * 完整菜单，双权限演示就只剩下开发环境能看了。
 */
export interface FixtureAccount {
  password: string;
  permissions: string[];
  /** 登录响应里 `data.user` 去掉 token 的那份档案 */
  profile: Record<string, unknown>;
  roles: string[];
  username: string;
  /** 可见菜单叶子节点的 name；`null` = 不裁剪 */
  visibleMenus: null | string[];
}

/** 登录态相关的三条接口 + mock 账号；写死在覆盖层里会和 mock 服务漂移 */
export interface FixtureAuth {
  /** 全部可登录账号，第一个是未登录/识别不了 token 时的回落账号 */
  accounts: FixtureAccount[];
  /** 密码错误的信封（现网抓的，code 与文案都要和真实 mock 对上） */
  failure: unknown;
  loginPath: string;
  logoutPath: string;
  /** 登录成功的信封（默认账号那份），覆盖层取它的文案与形状 */
  success: unknown;
  /** 会话用户来源接口：登录后它读会话里的那个人 */
  userPath: string;
}

export interface FixtureSet {
  auth: FixtureAuth;
  /** 快照对应的 mock 代码时刻（取 `server/api` 里最新的 mtime，重跑不变） */
  generatedAt: string;
  /** 菜单接口路径：它同时是导航数据源和权限来源，覆盖层要按会话账号裁剪 */
  menusPath: string;
  mockServer: string;
  routes: FixtureRoute[];
}

/** 拦截器的应答：HTTP 状态码 + 响应体（业务失败仍是 200 + 非 200 code，与 Nitro 一致） */
export interface MockReply {
  body: unknown;
  status: number;
}
