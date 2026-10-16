import type { Page } from '@playwright/test';

import process from 'node:process';

import { expect, test } from '@playwright/test';

import { go, HOME_PATH, navigate, signIn, watchErrors } from './utils/app';

/**
 * 全站页面巡检：把菜单里每一个叶子页面都走一遍，只问三个问题 ——
 * 控制台有没有本站错误、接口有没有 4xx/5xx、页面有没有真的渲染出来。
 *
 * 为什么单独成一条而不是塞进冒烟：冒烟验的是"架构拼装对不对"（守卫/登录/外壳/联动），
 * 这里验的是"每一页自己有没有坏"。菜单是从 Nitro 的 `/api/menus` 现取的，
 * 所以清单也在那里读一次，避免"用例里写死 21 条路径、后端加页面却没人发现"。
 *
 * 实现上刻意用**一个用例串行走完**：登录一次、在同一 SPA 会话里换 hash，
 * 既快又顺便覆盖了"站内连续导航"这条路径；发现问题靠汇总报告，不靠中途断言失败,
 * 否则第一页报错就把后面 20 页的的诊断机会一起吞掉了。
 */

interface LeafMenu {
  keepAlive: boolean;
  path: string;
  title: string;
}

/**
 * 落到了兜底错误页？（在浏览器里执行，所以必须是纯函数、不引用外部变量）
 *
 * 菜单里指向一个没注册的路由时，守卫/通配路由会跳到 403/404 —— 那仍然是一段
 * "渲染成功、控制台干净"的 HTML，只靠 errors + html 长度发现不了。
 * 巡检必须能抓到这种"链接是死的、页面却像是好的"的问题，所以按文案特征判定。
 *
 * 刻意**跳过卡片里的文字**：示例页会把 404/403 的结果状态素材摆在卡片里，
 * 整段 innerText 会把它一起读进来，把好页面误报成兜底页（第一版就是这么红的）。
 * 真的兜底页（`views/error/404.vue`）是裸的 h1/h2/p，不在卡里。
 */
function hasFallbackMarker(region: Element): boolean {
  const markers = ['页面不存在', '您没有权限访问此页面', '服务暂不可用'];
  const collect = (node: Node): string => {
    if (
      node.nodeType === Node.ELEMENT_NODE &&
      (node as Element).closest('[data-slot="card"]')
    ) {
      return '';
    }
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
    return [...node.childNodes].map(collect).join(' ');
  };
  return markers.some((marker) => collect(region).includes(marker));
}

/** 内容区定位器（巡检与下面的判定共用同一种"页面主体"口径） */
function contentRegion(page: Page) {
  return page
    .locator('main, [data-layout-region="content"], .layout-content')
    .first();
}

interface SweepRow {
  /** antd 的 deprecation 提示之类，一次会话里通常只 warn 一条 */
  warnings: string[];
  errors: string[];
  badResponses: string[];
  /** 落到了 403/404/500 兜底页：链接是死的，但页面看起来"正常" */
  errorPage: boolean;
  /** 页面上的嵌入框架（src → sandbox），用于核对隔离策略 */
  frames: string[];
  /** 其中 sandbox 可被逃逸的 */
  escapableFrames: string[];
  toasts: string[];
  render: string;
  path: string;
  /**
   * 被 `VENDOR_CONSOLE_NOISE` 洗掉的那部分控制台错误，单列出来只为"看得见但不判负"。
   * 巡检报告里如果这条数量变了，说明第三方依赖换版本了，需要回来复核。
   */
  vendorNoise: string[];
}

/**
 * 按页面登记的第三方控制台噪音。
 *
 * 只允许"本站代码改不到"的东西进来，所以判据是**页面 + 文案**两个都对上才洗：
 * 本站自己写错 props 触发的同类告警（路径不同）照样会红。
 *
 * - `/components/form-designer`：`@form-create/designer` 把 antd 的弹窗写在了它的
 *   打包产物里，仍在传 `destroyOnClose`；antd 1.6 已把它更名为 `destroyOnHidden`。
 *   升级设计器之前我们无法修，且它只是 deprecation 提示，不影响设计器可用。
 *   本站自己的弹窗（BasicModal）已全部改用 `destroy-on-hidden`。
 */
const VENDOR_CONSOLE_NOISE: Record<string, string[]> = {
  '/components/form-designer': ['[antd: Modal] `destroyOnClose` is deprecated'],
};

function splitVendorNoise(path: string, errors: string[]) {
  const patterns = VENDOR_CONSOLE_NOISE[path] ?? [];
  const vendorNoise: string[] = [];
  const real = errors.filter((message) => {
    const hit = patterns.some((pattern) => message.includes(pattern));
    if (hit) vendorNoise.push(message);
    return !hit;
  });
  return { real, vendorNoise };
}

/** 菜单树 → 叶子清单（外链不参与；隐藏项照样要巡） */
async function collectLeaves(page: Page): Promise<LeafMenu[]> {
  return page.evaluate(async () => {
    const res = await fetch('/api/menus', { credentials: 'include' });
    const body = (await res.json()) as {
      data?: { list?: Array<Record<string, unknown>> };
    };
    const leaves: LeafMenu[] = [];
    const walk = (nodes: Array<Record<string, unknown>>) => {
      for (const node of nodes) {
        const children = (node.children ?? []) as Array<
          Record<string, unknown>
        >;
        const path = String(node.path ?? '');
        if (children.length > 0) {
          walk(children);
        } else if (path.startsWith('/')) {
          /**
           * 这里**不**跳过 `hidden` 节点。
           *
           * 导航现在只展示四类（仪表盘 / 系统管理三项 / 组件示例 / 微前端），
           * 部门管理、数据字典、个人中心等都改成了 `hidden: true` —— 它们照样在权限表里、
           * 照样能直达，属于"上线了但不排在菜单上"的页面。巡检要问的是"每一页有没有坏"，
           * 所以全量都走一遍；真正的可见性由 layout/smoke 那两条按导航渲染结果去验。
           */
          leaves.push({
            keepAlive: node.keepAlive === true,
            path,
            title: String(node.menuName ?? node.title ?? path),
          });
        }
      }
    };
    walk(body.data?.list ?? []);
    return leaves;
  });
}

test.describe('全站页面巡检', () => {
  test('每个菜单叶子页面都能打开，且没有本站错误 / 接口非 2xx', async ({
    page,
  }, testInfo) => {
    await signIn(page);

    const leaves = await collectLeaves(page);
    // 后端菜单缩水的保护：清单空了这条用例就什么都验不到，直接判失败
    expect(leaves.length).toBeGreaterThan(10);

    /**
     * 巡检是一条用例串完 21 页的"循环型"用例，超时预算必须按页数算，不能沿用配置里的
     * 单页基准（全局 90s / WebKit 240s）。
     *
     * 原先 21 × (导航 + 沉降 + 读 DOM) 全靠那个固定上限兜着：Chromium 5 分钟、Firefox
     * 9 分钟的整跑里它都擦着边过，而本机 WebKit 慢 3-5 倍时就直接被判成超时红 ——
     * 单跑立刻绿，说明红的是计时器不是页面。
     *
     * 所以这里显式声明"每页预算"，默认 15s，需要更严用 `E2E_SWEEP_PAGE_BUDGET` 覆盖；
     * 页面数变多时预算自动跟着长。
     *
     * WebKit 单独放宽一档（25s/页、激活等待 60s）：三引擎整跑时它曾把 `/system/user`
     * 判红 —— 现场快照停在上一个页面（实时监控大屏，本身还在跑定时器），标签页始终
     * 没冒出来，也就是导航还在路上而不是页面坏了；把这一条单独重跑立刻绿。
     * 巡检是"每页都能打开"的存在性检查，不是性能闸门，所以只给这个引擎放宽；
     * Chromium / Firefox 保持 20s，真卡住仍然立刻红。
     */
    const isWebkit = testInfo.project.name === 'webkit';
    const perPageBudget = Number(
      process.env.E2E_SWEEP_PAGE_BUDGET ?? (isWebkit ? 25_000 : 15_000),
    );
    const activateTimeout = isWebkit ? 60_000 : 20_000;
    test.setTimeout(Math.max(150_000, leaves.length * perPageBudget + 60_000));

    const rows: SweepRow[] = [];

    for (const leaf of leaves) {
      // 每页一个独立的探针，读完就 stop()，否则上一片的桶会把后面的错误也收进去
      const probe = watchErrors(page);

      await page.evaluate((target) => {
        window.location.hash = `#${target}`;
      }, leaf.path);
      await expect(
        page.locator(`.tab-item[data-scroll-key="${leaf.path}"]`),
      ).toHaveAttribute('data-active', 'true', { timeout: activateTimeout });
      /**
       * 每页留出一点沉降时间：路由异步块、接口失败提示都在"导航完成"信号之后再冒出来。
       * 不留的话首屏 loading 还没换掉就去读 DOM，会把好页面读成"空白"（巡检第一次跑
       * 就把 /system/user 报成 259 字符的空页）。
       */
      await page.waitForTimeout(500);

      // 页面主体真的挂载了：内容区里要有可见元素，不能只剩 loading
      const render = await contentRegion(page)
        .innerHTML()
        .then((html) => `${html.length}`)
        .catch(() => 'NO-CONTENT-REGION');

      const landedOnErrorPage = await contentRegion(page)
        .evaluate(hasFallbackMarker)
        .catch(() => false);

      // 应用级错误提示（接口 5xx / 权限不足都会以 toast 呈现，用户看得见）
      const toasts = await page
        .locator('li[data-sonner-toast][data-type="error"], .ant-notification-notice-error')
        .allInnerTexts()
        .catch(() => [] as string[]);

      /**
       * 站内嵌的 iframe 不许出现 `allow-scripts` + `allow-same-origin` 的组合：
       * 这两个同时给就是浏览器自己会告警的"sandbox 可被逃逸"，框架里的脚本能顺着
       * 同源身份摸到顶层文档、读走主应用 token。策略由 `buildIframeSandbox` 统一决定，
       * 这里在真实 DOM 上兜底，防止有人改回硬编码或新加页面绕过工具函数。
       */
      const frames = await page
        .locator('iframe')
        .evaluateAll((list) =>
          list.map(
            (f) =>
              `${f.getAttribute('src') ?? '(no src)'} → sandbox=${f.getAttribute('sandbox') ?? '(无)'}`,
          ),
        )
        .catch(() => [] as string[]);

      const escapableFrames = frames.filter(
        (f) => f.includes('allow-scripts') && f.includes('allow-same-origin'),
      );

      const { real, vendorNoise } = splitVendorNoise(leaf.path, probe.errors);

      rows.push({
        badResponses: probe.badResponses,
        errorPage: landedOnErrorPage,
        errors: real,
        escapableFrames,
        frames,
        path: leaf.path,
        render,
        toasts,
        vendorNoise,
        warnings: [...new Set(probe.warnings)],
      });

      probe.stop();

      // toast 是一次性的，读完就清场，避免污染下一页
      await page.mouse.move(0, 0);
    }

    // 汇总报告：失败时这些数字本身就是诊断结论，不必再去翻 trace
    const report = rows.map((row) => ({
      bad: row.badResponses,
      err: row.errors,
      frames: row.frames,
      html: row.render,
      page: row.errorPage ? '兜底错误页' : row.path,
      toast: row.toasts,
    }));
    console.table(report);

    const broken = rows.filter(
      (row) =>
        row.errors.length > 0 ||
        row.badResponses.length > 0 ||
        row.toasts.length > 0 ||
        row.escapableFrames.length > 0 ||
        row.errorPage,
    );
    expect(
      broken,
      `有 ${broken.length}/${rows.length} 个页面存在问题：\n${JSON.stringify(broken, null, 2)}`,
    ).toEqual([]);

    // 顺带确认首页还在（巡检没有把会话搞坏）
    await expect(
      page.locator(`.tab-item[data-scroll-key="${HOME_PATH}"]`),
    ).toBeVisible();

    const warned = rows.filter((row) => row.warnings.length > 0);
    if (warned.length > 0) {
      console.log(
        '非致命 warning（antd deprecation / Vue 提示等，不参与判定）：',
        JSON.stringify(
          warned.map((row) => ({ path: row.path, warnings: row.warnings })),
          null,
          2,
        ),
      );
    }

    /**
     * 洗掉的第三方噪音必须留痕，否则"绿了"会让人误以为第三方也干净了。
     * 数量突然变化 = 依赖换了行为，要回来复核 `VENDOR_CONSOLE_NOISE` 还成不成立。
     */
    const suppressed = rows.filter((row) => row.vendorNoise.length > 0);
    if (suppressed.length > 0) {
      console.log(
        '按页面登记的第三方控制台噪音（已豁免，不计入判定）：',
        JSON.stringify(
          suppressed.map((row) => ({
            count: row.vendorNoise.length,
            path: row.path,
            sample: row.vendorNoise[0],
          })),
          null,
          2,
        ),
      );
    }
  });

  /**
   * 兜底页判定的正反两例 —— 上面那条巡检靠它抓"链接是死的、页面却像是好的"，
   * 而它自己也得有人守着：
   *  - 假阴：判定失效，死链接混进绿；
   *  - 假阳：示例页把 404 的 `a-result` 当素材摆在卡片里时，会把好页面判成兜底页
   *    （巡检第一跑就是被它红的），所以"跳过卡片"这半边也要钉住。
   */
  test('兜底页判定：死链接要认得出，卡片里的 404 素材不能误判', async ({
    page,
  }) => {
    await signIn(page);

    await navigate(page, '/components/this-page-does-not-exist');
    // 兜底页不进标签页（`hidden` + 不在菜单里），所以按地址判落地，不能用 expectActivePath
    await expect(page).toHaveURL(/#\/error\/404/);
    expect(await contentRegion(page).evaluate(hasFallbackMarker)).toBe(true);

    // 「跳过卡片」这半边不靠某个示例页养着：素材页曾经真的存在过（旧的
    // `/components/feedback`），页面一删这条护栏就没人守了。自己造一段更稳。
    await go(page, '/components/overview');
    await contentRegion(page).evaluate((region) => {
      const card = document.createElement('div');
      card.dataset.slot = 'card';
      card.textContent = '抱歉，您访问的页面不存在';
      region.append(card);
    });
    expect(await contentRegion(page).evaluate(hasFallbackMarker)).toBe(false);
  });
});
