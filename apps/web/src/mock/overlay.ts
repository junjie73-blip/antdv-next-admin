import type { NormalizedRequest } from './matcher';
import type {
  FixtureAccount,
  FixtureRoute,
  FixtureSet,
  MockReply,
} from './types';

import { repliers } from './dynamic';

/** 与 `backend-mock/server/utils/response.ts` 的 `success()` 保持一致 */
const SUCCESS_CODE = 200;
const OK_MESSAGE = 'ok';
/** 与 Nitro handler 里的 `Number(query.pageSize) || 10` 对齐 */
const DEFAULT_PAGE_SIZE = 10;

interface Collection {
  field: string;
  items: any[];
  /** 列表接口本体：应答时沿用它的信封与其余字段 */
  route: FixtureRoute;
  totalField: string;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** 信封字段顺序固定 `code/data/message`，与 Nitro 的 `envelope()` 逐字节对齐 */
function envelope(data: unknown, message: string = OK_MESSAGE): MockReply {
  return { body: { code: SUCCESS_CODE, data, message }, status: SUCCESS_CODE };
}

function dataOf(response: unknown): any {
  return (response as any)?.data;
}

function messageOf(response: unknown): string {
  const message = (response as any)?.message;
  return typeof message === 'string' ? message : OK_MESSAGE;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** 分页键不参与筛选，否则 `page=1` 会被当成一个要求 `item.page === '1'` 的条件 */
const PAGING_KEYS = new Set(['page', 'pageNum', 'pageSize']);
/**
 * 关键词检索的查询键：本项目所有搜索框都发 `keyword`（见各 `views/**` 的搜索表单）。
 *
 * 口径与 `backend-mock/server/api/**\/list.get.ts` 对齐 —— 那边对若干文本字段做
 * 不区分大小写的 `includes`；这里不必知道每个集合搜的是哪几个字段，
 * 对记录上所有字符串字段一起做子串匹配即可（是 Nitro 规则的超集，
 * 少搜一个字段表现为"搜不到"，比"搜索没反应"更接近正确）。
 */
const KEYWORD_KEYS = ['keyword', 'searchValue'];

/**
 * 列表筛选：`keyword` 走子串，其余命中记录字段的键走等值。
 *
 * 等值而非子串：`status`、`type`、`parentId` 这些枚举/外键在 Nitro 那边一律 `===`，
 * 用子串会让 `parentId=1` 把 `10`、`21` 一起捞出来，树形列表当场乱套。
 * 不是记录字段的键（`sort`、`dateRange`…）直接忽略 —— 和"没实现"相比，
 * 全过滤掉是更糟的结果（表格会空）。
 */
function filterItems(items: any[], query: Record<string, string>): any[] {
  const keywordValue = KEYWORD_KEYS.map((key) => query[key]).find(
    (value) => value !== undefined && value !== '',
  );
  const sample = items.find((item) => item && typeof item === 'object');

  let filtered = items;
  if (keywordValue !== undefined) {
    const kw = String(keywordValue).toLowerCase();
    filtered = filtered.filter((item) =>
      Object.values(item ?? {}).some(
        (value) =>
          typeof value === 'string' && value.toLowerCase().includes(kw),
      ),
    );
  }

  for (const [key, value] of Object.entries(query)) {
    if (PAGING_KEYS.has(key) || KEYWORD_KEYS.includes(key)) continue;
    if (value === undefined || value === '') continue;
    if (!sample || !(key in sample)) continue;
    const expected = String(value);
    filtered = filtered.filter(
      (item) => String(item?.[key] ?? '') === expected,
    );
  }
  return filtered;
}

/** mock 服务用 dayjs 写 `YYYY-MM-DD HH:mm:ss`；新增记录不带时间戳的话列表里会空一列 */
function formatNow(): string {
  const now = new Date();
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  );
}

function nextId(items: any[]): number {
  let max = 0;
  for (const item of items) max = Math.max(max, Number(item?.id) || 0);
  return max + 1;
}

function findIndex(items: any[], name: string, value: string): number {
  return items.findIndex(
    (item) => String(item?.id) === value || String(item?.[name]) === value,
  );
}

/**
 * 按账号裁剪菜单树，规则与 `backend-mock/server/utils/accounts.ts` 一致：
 * 叶子按白名单取舍，父壳只要有孩子活着就留下（剔掉父壳会连带丢掉它的绝对 path）。
 */
function pickMenus(list: any[], visibleMenus: null | string[]): any[] {
  if (!visibleMenus) return list;
  const allowed = new Set(visibleMenus);
  const picked: any[] = [];
  for (const menu of list) {
    const children = menu?.children?.length
      ? pickMenus(menu.children, visibleMenus)
      : [];
    if (children.length > 0) {
      picked.push({ ...menu, children });
      continue;
    }
    if (menu?.children?.length) continue;
    if (menu?.name && allowed.has(menu.name)) picked.push(menu);
  }
  return picked;
}

/** 会话里那个人：档案给 `/auth/user-info`，账号表给 `/menus` 决定能看到哪些页面 */
interface Session {
  account: FixtureAccount;
  profile: Record<string, any>;
}

/**
 * 会话状态 + 写覆盖层。
 *
 * 覆盖层是**内存态**的：刷新页面就回到 fixtures 的快照。这是有意的取舍 —— 生产预览里
 * 没有真实后端可对账，把会话落盘反而会让人换台机器后读到一份对不上号的数据。
 */
export function createOverlay(fixtures: FixtureSet) {
  const collections = new Map<string, Collection>();
  let session: null | Session = null;

  // 生成时列表接口按大 pageSize 抓的是全集，这份全集就是集合的种子
  for (const route of fixtures.routes) {
    if (route.method !== 'GET' || !route.listField || !route.collection)
      continue;
    const data = dataOf(route.response);
    if (!Array.isArray(data?.[route.listField])) continue;
    collections.set(route.collection, {
      field: route.listField,
      items: clone(data[route.listField]),
      route,
      totalField: route.totalField ?? 'total',
    });
  }

  function readList(
    collection: Collection,
    query: Record<string, string>,
  ): MockReply {
    const page = Number(query.page ?? query.pageNum) || 1;
    const pageSize = Number(query.pageSize) || DEFAULT_PAGE_SIZE;
    const filtered = filterItems(collection.items, query);
    const start = (page - 1) * pageSize;
    const body = clone(dataOf(collection.route.response));
    body[collection.field] = clone(filtered.slice(start, start + pageSize));
    // total 跟着**筛选后**的内存副本走：新增/删除/搜索后分页器的页数才对得上
    body[collection.totalField] = filtered.length;
    return envelope(body, messageOf(collection.route.response));
  }

  function readByParam(
    collection: Collection,
    route: FixtureRoute,
    params: Record<string, string>,
  ): MockReply | null {
    const entry = Object.entries(params)[0];
    if (!entry) return null;
    const [name, value] = entry;
    const record = collection.items[findIndex(collection.items, name, value)];
    return record ? envelope(clone(record), messageOf(route.response)) : null;
  }

  /** 会话接口（`/auth/user-info`）在登录后读会话里的那个人，而不是快照里的常量 */
  function readFromSession(route: FixtureRoute): MockReply | null {
    if (!session || route.path !== fixtures.auth.userPath) return null;
    const body = clone(route.response);
    if (dataOf(body)?.user === undefined) return null;
    dataOf(body).user = {
      ...clone(session.profile),
      permissions: session.account.permissions,
      roles: session.account.roles,
    };
    return { body, status: SUCCESS_CODE };
  }

  /**
   * 菜单接口按会话账号裁剪。它同时是**权限来源**（前端把树上的 name/path 摊成
   * allowedNames/allowedPaths），不裁就等于生产预览里换个账号还是全通。
   * 未登录时给全量 —— 和 Nitro 那边回落默认账号的行为一致。
   */
  function readMenus(route: FixtureRoute): MockReply | null {
    if (route.path !== fixtures.menusPath) return null;
    const body = clone(route.response);
    const list = dataOf(body)?.list;
    if (!Array.isArray(list)) return null;
    dataOf(body).list = pickMenus(list, session?.account.visibleMenus ?? null);
    return { body, status: SUCCESS_CODE };
  }

  function create(collection: Collection, body: any): MockReply {
    const sample = collection.items[0];
    const timestamps = Object.keys(sample ?? {})
      .filter((key) => key.endsWith('At'))
      .map((key) => [key, formatNow()]);
    const record = {
      ...body,
      ...Object.fromEntries(timestamps),
      id: nextId(collection.items),
    };
    collection.items.push(record);
    return envelope(clone(record));
  }

  function mutate(
    collection: Collection,
    params: Record<string, string>,
    body: any,
    remove: boolean,
  ): MockReply {
    const entry = Object.entries(params)[0];
    const index = entry ? findIndex(collection.items, entry[0], entry[1]) : -1;
    if (index < 0) return envelope(null);
    if (remove) {
      collection.items.splice(index, 1);
      return envelope(null);
    }
    collection.items[index] = { ...collection.items[index], ...body };
    return envelope(clone(collection.items[index]));
  }

  function login(body: any): MockReply {
    const { auth } = fixtures;
    const payload = body && typeof body === 'object' ? body : {};
    const account = auth.accounts.find(
      (item) =>
        item.username === String(payload.username ?? '') &&
        item.password === String(payload.password ?? ''),
    );
    // 密码错误：HTTP 仍是 200，只有信封 code 非 200 —— Nitro 的 `bizError` 就是这个形状
    if (!account) return { body: clone(auth.failure), status: SUCCESS_CODE };

    const profile = clone(account.profile);
    session = { account, profile };
    return {
      body: {
        code: SUCCESS_CODE,
        data: {
          user: {
            ...clone(profile),
            permissions: account.permissions,
            roles: account.roles,
            // token 与 Nitro 同形（身份编在里面），时间戳必须是回放这一刻的
            token: `mock_token_${account.username}_${Date.now()}`,
          },
        },
        message: messageOf(auth.success),
      },
      status: SUCCESS_CODE,
    };
  }

  function handle(
    route: FixtureRoute,
    request: NormalizedRequest,
    params: Record<string, string>,
  ): MockReply | null {
    // 现造应答优先：这类接口没有快照（multipart / 要求每次唯一），见 `dynamic.ts`
    const replier = route.replier ? repliers[route.replier] : undefined;
    if (replier) {
      const { data, message } = replier(params, Date.now());
      return envelope(data, message);
    }

    const { auth } = fixtures;
    if (request.method === 'POST' && route.path === auth.loginPath) {
      return login(request.body);
    }
    if (request.method === 'POST' && route.path === auth.logoutPath) {
      session = null;
      return envelope(null, messageOf(auth.success));
    }

    const collection = route.collection
      ? collections.get(route.collection)
      : undefined;

    if (request.method === 'GET') {
      const sessionUser = readFromSession(route);
      if (sessionUser) return sessionUser;
      const menus = readMenus(route);
      if (menus) return menus;
      if (collection && route.listField)
        return readList(collection, request.query);
      if (collection && route.response) {
        const detail = readByParam(collection, route, params);
        if (detail) return detail;
      }
      return route.response === undefined
        ? null
        : { body: clone(route.response), status: SUCCESS_CODE };
    }

    if (!collection) return envelope(null);
    if (request.method === 'POST') return create(collection, request.body);
    return mutate(
      collection,
      params,
      request.body,
      request.method === 'DELETE',
    );
  }

  return { handle };
}
