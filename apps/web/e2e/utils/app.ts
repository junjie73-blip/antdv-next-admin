import type {
  ConsoleMessage,
  Locator,
  Page,
  Request,
  Response,
} from '@playwright/test';

import { expect } from '@playwright/test';

/**
 * e2e 公共脚手架。
 *
 * 两条约束决定了这里的大部分内容：
 * 1. **应用用 hash 路由**（`createWebHashHistory`），而 Playwright 的 `baseURL`
 *    只负责协议+域名+端口，路径部分写成 `/#/system/user` 交给配置解析，
 *    所以这里没有任何硬编码的 `localhost:xxxx`——换端口只用改 playwright.config.ts。
 * 2. **改 hash ≠ 访问 URL**。整页 `goto` 会重新加载应用，标签页 store 与
 *    KeepAlive 缓存一起被清空，那样的"缓存测试"测的是页面初始值而不是缓存命中。
 *    所以站内跳转走 `navigate()`：只动 hash，路由守卫照常跑，但 SPA 状态延续；
 *    `go()` 在它之上多加一条"目标标签已激活"的等待，正常导航都用它。
 */

/** 与 `apps/web/src/config/constants.ts` 保持一致，别在断言里再写一遍字面量 */
export const HOME_PATH = '/dashboard/analysis';

/** Nitro mock 只认这一组账号（`apps/backend-mock/server/api/auth/login.post.ts`） */
export const ACCOUNT = { password: 'admin123', username: 'admin' };

/**
 * 收集"真·错误"。
 *
 * 分工：`requestfailed` 带 URL，能区分本站接口和本地拉不到的第三方资源；
 * console 里的 `Failed to load resource` 是同一件事的重复播报且没有 URL，
 * 直接吞掉——本项目用 `@iconify/vue` 的 `<Icon>`，图标数据在运行时从
 * api.iconify.design 拉，断网/CDN 抖动会报错但不影响功能，不该把整套用例带红。
 * 想彻底消掉这条噪音要装离线图标 provider，属于另一件事。
 */
export interface PageErrors {
  /** 本站脚本异常 + 本站请求失败，用例断言用这个 */
  errors: string[];
  /** 第三方资源（图标 CDN / 头像站）失败，只记录不判负 */
  external: string[];
  /** console 里的 warning（Vue 组件解析失败、antd deprecation 都从这里冒出来） */
  warnings: string[];
  /** 本站 /api 的 4xx/5xx —— 页面会渲染成功，但数据是空的，只靠 errors 抓不到 */
  badResponses: string[];
  /**
   * 卸载本页面的监听器。
   *
   * 连续巡检多个页面时每页都要新建一个桶，不调 `stop()` 的话旧桶的监听器还在挂着：
   * 第 1 页的桶会把后面所有页面的错误一并收进去，报告就指不出"到底是哪一页坏的"，
   * 21 页 × 3 套监听器还会一路累积到测试结束。
   */
  stop: () => void;
}

/**
 * 已知的环境噪音，不该把用例判负。
 *
 * - `ResizeObserver loop completed with undelivered notifications.`
 *   浏览器在"观察回调里又改了布局，导致同一帧内还有尺寸变化没送达通知"时抛这条。
 *   WHATWG 的观察者规范明确说这是一种**正常收敛状态**，Chrome 团队也写过
 *   "它不是错误、不需要修"。本项目里 antd 的 Menu/Drawer 与标签栏都在用 ResizeObserver
 *   做溢出计算，切布局时必然出现；WebKit 抛成 `pageerror`、Firefox 抛成 console error，
 *   同一个原因，两种口音，所以两条都要过滤。
 *   真出问题的溢出表现是"箭头不出现/滚轮不动"，那由断言本身覆盖，不靠这条错误。
 */
const BENIGN_MESSAGES = [
  'ResizeObserver loop completed with undelivered notifications',
  'ResizeObserver loop limit exceeded', // 老版本 Chromium 的措辞
];

function isBenign(message: string): boolean {
  return BENIGN_MESSAGES.some((pattern) => message.includes(pattern));
}

/**
 * 从 console 文本里挑出"外站资源拉取失败"。
 *
 * 第三方图标库的运行时拉取失败在每个引擎里口音都不一样，必须都认下来：
 * - Chromium 报 `Failed to load resource`（上面已经吞掉）；
 * - Firefox 报 `[JavaScript Error: "Cross-Origin Request Blocked: ... api.unisvg.com ..."]`，
 *   类型是 error 且带完整文案，落到 `errors` 就会把整条巡检判红；
 * - `@iconify/vue` 的 API 主机列表里既有 api.iconify.design 也有镜像 api.unisvg.com，
 *   内网/被墙时两边都不通，图标少几个但功能不受影响。
 *
 * 判据要同时满足两条，不然就把真错误也洗白了：① 文案是资源/网络失败的样子；
 * ② 提到的 URL 不属于本站（本站错误一定带 localhost 或相对路径）。
 * 外站脚本自己抛的异常没有这些措辞，仍然算错误。
 */
const RESOURCE_FAILURE =
  /(Cross-Origin Request Blocked|Failed to load resource|Load failed|CORS|net::ERR|could not be loaded|due to access control checks)/i;
/**
 * 同一件事的第三种写法：WebKit/Firefox 会把本站的绝对地址印成**没有协议头**的样子
 * （`/localhost:6080/api/...`、`/api.simplesvg.com/carbon.json?...`），
 * 只按 `https?://` 抽地址就会抽不到，于是"外站不通"和"本站被打断"分不开，
 * 后果是把图标库的正常失败算进 `errors`，整条巡检被判红。
 */
const ANY_URL = /(?:https?:)?\/\/[\w.-]+(?::\d+)?\/\S*|\/[\w.-]+\.\w+\/\S*/;
const LOCAL_ORIGIN = /(?:^|\/\/|\/)(?:localhost|127\.0\.0\.1)(?::\d+)?\//i;

function externalResourceFailure(message: string): string | undefined {
  if (!RESOURCE_FAILURE.test(message)) return undefined;
  const url = ANY_URL.exec(message)?.[0];
  return url && !LOCAL_ORIGIN.test(url) ? url : undefined;
}

/**
 * "浏览器自己把这次请求打断了"在三个引擎里的三套措辞。
 *
 * 典型触发：用例在页面还在加载数据时 `reload()`（面包屑那条用例就是），
 * 顶栏通知的 `/api/system/notice/list` 正在飞就被掐了。
 * 页面随后正常渲染，所以这条不是缺陷；真正的接口挂了走 `badResponses`
 * （4xx/5xx 的响应仍然会被收），网络真断了走非取消措辞的 `requestfailed`。
 *
 * - Chromium / WebKit 的 `requestfailed`：`net::ERR_ABORTED`
 * - Firefox 的 `requestfailed`：`NS_BINDING_ABORTED`
 * - Firefox 的 `pageerror`：`NetworkError when attempting to fetch resource.`
 * - WebKit 的 `pageerror`：`Fetch API cannot load <url> due to access control checks.`
 */
const REQUEST_CANCELLED = [
  'net::ERR_ABORTED',
  'NS_BINDING_ABORTED',
  'NetworkError when attempting to fetch resource',
  'due to access control checks',
];

function requestCancelled(message: string): boolean {
  return REQUEST_CANCELLED.some((pattern) => message.includes(pattern));
}

export function watchErrors(page: Page): PageErrors {
  const bucket: PageErrors = {
    badResponses: [],
    errors: [],
    external: [],
    warnings: [],
    stop,
  };

  const onPageError = (error: Error) => {
    const message = `pageerror: ${error.message}`;
    if (isBenign(message)) return;
    /** 同一个原因（外站资源不通）在 WebKit 那边是 pageerror 的口音，见上面的注释 */
    const external = externalResourceFailure(error.message);
    if (external) {
      bucket.external.push(`${external} ${error.message}`);
      return;
    }
    if (requestCancelled(error.message)) return;
    bucket.errors.push(message);
  };
  const onConsole = (message: ConsoleMessage) => {
    if (message.type() === 'warning') {
      bucket.warnings.push(message.text());
      return;
    }
    if (message.type() !== 'error') return;
    // `Failed to load resource` 是同一件事的重复播报（requestfailed 里带 URL 的那条更可读）
    if (message.text().includes('Failed to load resource')) return;
    if (isBenign(message.text())) return;
    const external = externalResourceFailure(message.text());
    if (external) {
      bucket.external.push(`${external} ${message.text()}`);
      return;
    }
    if (requestCancelled(message.text())) return;
    bucket.errors.push(`console: ${message.text()}`);
  };
  const onRequestFailed = (request: Request) => {
    const url = request.url();
    const failure = request.failure()?.errorText ?? 'failed';
    /**
     * "浏览器自己取消了这次请求"不是"请求失败"，且三个引擎措辞不同（见 `REQUEST_CANCELLED`）。
     * dev server 下最常见的成因是 Vite 边服务边做依赖预打包：一次会话里第一次打开某个
     * 重型页面 → 发现新依赖 → 重新 optimize → 触发整页 reload，正在飞的模块请求全部 aborted。
     * 另一条是用例自己在数据还在飞的时候 `reload()`（面包屑那条用例就是）。
     * 页面随后会重新加载并跑起来，所以这条不该把用例判负（真挂了由后面的可见性断言兜）。
     */
    if (requestCancelled(failure)) return;
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)) {
      bucket.errors.push(`request: ${url} ${failure}`);
      return;
    }
    bucket.external.push(`${url} ${failure}`);
  };
  /**
   * 接口 4xx/5xx 不会进 console（fetch 拿到响应就算成功），页面却会渲染成
   * "表格空 / 提示无权限"。巡检要看的就是这一层，所以在这里统一收。
   */
  const onResponse = (response: Response) => {
    const url = response.url();
    if (!/\/api\//.test(url)) return;
    if (response.status() < 400) return;
    bucket.badResponses.push(`${response.status()} ${url.replace(/^https?:\/\/[^/]+/, '')}`);
  };

  page.on('pageerror', onPageError);
  page.on('console', onConsole);
  page.on('requestfailed', onRequestFailed);
  page.on('response', onResponse);

  function stop() {
    page.off('pageerror', onPageError);
    page.off('console', onConsole);
    page.off('requestfailed', onRequestFailed);
    page.off('response', onResponse);
  }

  return bucket;
}

/** 填账号密码 */
export async function fillAccount(page: Page) {
  await page.getByPlaceholder('请输入用户名').fill(ACCOUNT.username);
  await page.getByPlaceholder('请输入密码').fill(ACCOUNT.password);
}

/**
 * 点提交。
 *
 * 必须 `exact: true`：登录页顶部还有「账号登录」「手机登录」两个切换按钮，
 * 用模糊匹配会命中 3 个元素，Playwright 的 strict mode 直接报错。
 */
export async function submitLogin(page: Page) {
  await page.getByRole('button', { exact: true, name: '登录' }).click();
}

/** 登录：拿到布局外壳（标签栏出现）才算成功，否则后续点击会打在 loading 上 */
export async function signIn(page: Page) {
  await page.goto('/#/login');
  await fillAccount(page);
  await submitLogin(page);
  await expectTabBar(page);
}

/**
 * 站内跳转：只改 hash，不断言落点。
 * 用于"预期会被守卫拦走"的场景（比如退出后访问受保护页面）。
 *
 * `page.evaluate` 撞上导航会抛 "Execution context was destroyed"。
 * 退出登录就是这种时机：token / 菜单 / 标签页被一起清掉，守卫立刻把当前页重定向到
 * 登录页，而用例紧接着就要改 hash —— 赋值本身在旧上下文里已经生效或被丢弃都无所谓，
 * 等新文档就绪再补一次即可，调用方后面的 expect 会自己轮询到落点。
 */
export async function navigate(page: Page, path: string) {
  const setHash = () =>
    page.evaluate((target) => {
      window.location.hash = `#${target}`;
    }, path);

  try {
    await setHash();
  } catch (error) {
    if (!String(error).includes('Execution context was destroyed')) throw error;
    await page.waitForLoadState('domcontentloaded');
    await setHash();
  }
}

/**
 * 站内跳转并等待新页面挂载完。
 *
 * 重试而不是把超时拉长：刚改过布局偏好时，外壳整棵重渲染，
 * 这次 hash 变更有概率被 vue-router 当成"被中止的导航"把 URL 回滚掉 ——
 * 表现是页面停在原处，等多久都不会自己过去，只能重新触发一次导航。
 *
 * 但重试之前要先分清两种"没到"：
 * - **URL 还在原处**：导航真被中止了，重设一次 hash 有意义；
 * - **URL 已经是目标、标签页却没激活**：外壳只是还没忙完。dev 下第一次进某个路由
 *   要现场编译这个页面和它的依赖，WebKit 冷启动时这一口能到十几秒（实测在
 *   `/screen/monitor` 之后紧接 `/system/user` 就会踩到）。此时再赋一次相同的 hash
 *   是空操作 —— vue-router 判重复导航直接丢弃 —— 三次尝试全花在等一个不会发生的
 *   变更上，只能产出假红。这种局面交给 `activateTimeout` 多等一会儿。
 */
export async function go(page: Page, path: string, activateTimeout?: number) {
  /**
   * 最后一次尝试给 20s，而不是吃全局默认的 10s。
   *
   * 判据是"某个页面的**第一次**访问"：dev 下异步块要现场编译，WebKit 冷跑这条链路
   * 实测能到十几秒（Chromium 热跑不到 1s）。10s 会把"引擎刚起来"读成"点了没反应"，
   * 整跑时固定产出 2-3 条无法复现的假红（layout / tabs / ops-sweep 都中过同一个
   * `/system/user`）。只放宽最后那次等待，判定条件一个没动：真坏了照样红，只是多等十秒。
   */
  const attempts: Array<number | undefined> = [4000, 4000, activateTimeout ?? 20_000];

  for (const [index, timeout] of attempts.entries()) {
    if (!hashAt(page, path)) await navigate(page, path);
    try {
      await expectActivePath(page, path, timeout ?? activateTimeout);
      return;
    } catch (error) {
      if (index === attempts.length - 1) throw error;
      await page.waitForTimeout(250);
    }
  }
}

/** 当前 hash 是否就是目标 path（忽略 query 与结尾斜杠） */
function hashAt(page: Page, path: string) {
  const strip = (value: string) => value.split('?')[0]?.replace(/\/+$/, '') || '/';
  return strip(new URL(page.url()).hash.replace(/^#/, '')) === strip(path);
}

/**
 * 标签栏：布局外壳渲染完成的可靠标志，比等某个业务组件快且稳定。
 *
 * 显式给 25s 而不是吃默认的 10s：每个引擎的**第一条**用例要付一次浏览器冷启动 +
 * dev server 首次 transform 的代价（实测 WebKit 冷跑这条链路 40s+，Chromium 热跑 2s）。
 * 默认 10s 会把"引擎刚起来"误判成"登录没进去"。25s 仍然远小于功能真坏时的表现
 * （外壳不挂载就永远等不到 `.tab-item`），不会把真问题洗白。
 */
export async function expectTabBar(page: Page) {
  await expect(page.locator('.tab-item').first()).toBeVisible({
    timeout: 25_000,
  });
}

/**
 * 当前激活标签的 key 就是归一化 path。
 *
 * 用它当"导航完成"的信号：菜单、守卫、标签页三方都以 path 为连接键，
 * 所以 `data-active="true"` 翻到目标标签，等价于页面真的换过去了。
 *
 * `timeout` 给重试链路用：前几次尝试只等一小会儿，失败就重新触发导航。
 */
export async function expectActivePath(
  page: Page,
  path: string,
  timeout?: number,
) {
  await expect(tab(page, path)).toHaveAttribute(
    'data-active',
    'true',
    timeout === undefined ? {} : { timeout },
  );
}

/** 按 key（归一化 path）取标签节点 */
export function tab(page: Page, path: string) {
  return page.locator(`.tab-item[data-scroll-key="${path}"]`);
}

/** 页面上的搜索框：这些列表页都带一个唯一 placeholder，用来留状态指纹 */
export function searchBox(page: Page, placeholder: string) {
  return page.getByPlaceholder(placeholder, { exact: false });
}

/**
 * 从当前页跳到另一个页面，再回到 `backPath`。
 * 走标签点击而不是 hash，才能同时验证「点标签切页」这条真实路径。
 */
export async function switchAwayAndBack(
  page: Page,
  otherPath: string,
  backPath: string,
) {
  await go(page, otherPath);
  await tab(page, backPath).click();
  await expectActivePath(page, backPath);
}

/**
 * 改偏好设置（布局形态、标签页开关等）。
 *
 * 走 pinia 而不是点设置抽屉里的开关，是因为设置抽屉本身只是一层 UI：
 * 它最终也调 `appStore.updateSetting(...)`。用例要验的是"蓝图 → 区域渲染"
 * 这段逻辑，复用同一条写入路径就够，不必再测那排按钮能不能点。
 *
 * 取不到 store 就直接抛错，避免"偏好没生效但用例照样绿"。
 */
export async function setPreference(
  page: Page,
  partial: Record<string, unknown>,
) {
  await page.evaluate((patch) => {
    const host = document.querySelector('#app') as (Element & {
      __vue_app__?: {
        config?: { globalProperties?: { $pinia?: { _s?: Map<string, unknown> } } };
      };
    }) | null;
    const store = host?.__vue_app__?.config?.globalProperties?.$pinia?._s?.get(
      'app',
    ) as undefined | {
      updateSetting?: (value: Record<string, unknown>) => void;
    };
    if (!store?.updateSetting) throw new Error('pinia app store 不可用，无法切换偏好');
    store.updateSetting(patch);
  }, partial);
}

export function setLayout(page: Page, layout: string) {
  return setPreference(page, { layout });
}

/**
 * 外壳区域探针。
 * `data-layout-region` 由 `@antdv/layouts` 的蓝图决定，是"形态 → 渲染"最直接的观测点。
 */
export function region(
  page: Page,
  name: 'breadcrumb' | 'header' | 'header-nav' | 'nav-rail' | 'sidebar',
) {
  return page.locator(`[data-layout-region="${name}"]`);
}

/**
 * 偏好抽屉（设置抽屉）：从工具区按钮真实点开，再切到底部面板。
 *
 * `layout.spec.ts` 里改偏好走 `setPreference` 直写 store，那条路径绕过了抽屉本身；
 * 但"滚动区看不全""控件挤在一行"这类缺陷恰好只出现在抽屉的 UI 层，
 * 所以这几条用例必须真点按钮，把抽屉当作被测对象。
 */
export async function openPreferenceDrawer(
  page: Page,
  section: '外观' | '布局' | '通用',
) {
  await page.getByRole('button', { name: '偏好设置' }).click();
  const drawer = page.locator('.setting-drawer');
  // 同 `closePreferenceDrawer`：展开与否看 `ant-drawer-open`，容器盒子一直都在
  await expect(drawer).toHaveClass(/ant-drawer-open/);

  /**
   * 分段控件里点 section。
   * 不能直接 `drawer.getByText(section)`：面板内部还有同名的小节标题
   * （「布局」「通用」都是 SettingGroup 的 title），strict mode 会撞上多个命中。
   * `.ant-segmented-item` 只属于顶部那排切换条。
   */
  await drawer
    .locator('.ant-segmented-item')
    .filter({ hasText: section })
    .first()
    .click();
  await expect(drawer.locator('.scrollbar__view')).toBeVisible();
  return drawer;
}

/**
 * 抽屉里某一行的控件（开关 / 输入框 / 数字框…）。
 * 键值是 `SettingItem` 上的 `data-setting-label`，就是面板上那行标题的原文。
 */
export function settingControl(drawer: Locator, label: string) {
  return drawer
    .locator(`[data-setting-label="${label}"]`)
    .locator(
      '.ant-switch, .ant-segmented, .ant-slider, .ant-input-number, .ant-input',
    )
    .first();
}

/**
 * 收起偏好抽屉。
 *
 * 按 Esc 关不掉：抽屉标题栏右上角那颗 × 是 `SettingDrawer` 自绘的
 * （`:closable="false"` 关掉了 antd 自带的），所以这里点它。
 * 判"关好了"也不能看 `.setting-drawer` 是否可见 —— antd 不销毁 DOM，
 * 收起后只是从根节点摘掉 `ant-drawer-open`，容器盒子还在。
 */
export async function closePreferenceDrawer(page: Page) {
  await page
    .locator('.setting-drawer .ant-drawer-header button')
    .first()
    .click();
  await expect(page.locator('.setting-drawer')).not.toHaveClass(
    /ant-drawer-open/,
  );
}
