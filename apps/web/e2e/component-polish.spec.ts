import type { Locator, Page, Route } from '@playwright/test';

import { expect, test } from '@playwright/test';

import {
  expectActivePath,
  go,
  navigate,
  painted,
  signIn,
  watchErrors,
} from './utils/app';

/**
 * 三项组件级修复的落点验证：抽屉头部与滑动动画、路由加载指示器的取色、
 * 大文件上传列表的对齐。
 *
 * 共同点是把"改了什么"翻译成**计算样式**上的一个具体读数：
 * 类名里有 `border-b` 不等于画出了下边框（令牌没接上就是 0 宽的透明线），
 * `text-primary` 写进源码不等于转出来的圈是主色（祖先可能再盖一层 color），
 * 单元格加了 `text-center` 也不等于整格居中（进度条和操作列是 flex 容器，
 * 它们只吃 `justify-content`）。所以每条断言都读浏览器最终算出来的值。
 */

/** 卡片墙按标题取卡片（`CardTitle` 上有 `data-slot="card-title"`） */
function cardByTitle(page: Page, title: string) {
  return page.locator('[data-slot="card"]').filter({
    has: page.locator('[data-slot="card-title"]', { hasText: title }),
  });
}

/** 按标题取那一个抽屉面板（`.basic-drawer` 是 DrawerContent 上的稳定类） */
function drawerPanel(page: Page, title: string) {
  return page
    .locator('.basic-drawer')
    .filter({ has: page.getByText(title, { exact: true }) });
}

/**
 * 等入场动画跑完再量包围盒：动画途中读到的盒子还在屏幕外，
 * 起点落在蒙层上就会变成"点蒙层关闭"，拖拽压根不会开始。
 */
async function settledBox(panel: Locator) {
  return panel.evaluate(async (el) => {
    await Promise.allSettled(
      (el as HTMLElement).getAnimations().map((anim) => anim.finished),
    );
    return (el as HTMLElement).getBoundingClientRect().toJSON();
  });
}

test.describe('抽屉头部与滑动动画', () => {
  test('头部有下边框、内边距与内容区统一；滑动只补间 translate 且只在拖拽期间提层', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await signIn(page);
    await go(page, '/components/modal-drawer');

    const box = cardByTitle(page, '抽屉基础与位置');
    await box.getByRole('button', { name: /右侧抽屉/ }).click();
    const panel = drawerPanel(page, '右侧抽屉 · 模块选择');
    await expect(panel).toBeVisible();

    /*
     * 原缺陷：头部与内容之间没有分隔线（`border-b` 缺类 / 边框色没走令牌）。
     * 只断言"有 1px 的线"不够，还得确认那条线的颜色就是全站边框令牌，
     * 否则深色主题下会画出一条白边或干脆是 rgba(0,0,0,0)。
     */
    const header = panel.locator('.drawer-header');
    await expect(header).toHaveCSS('border-bottom-width', '1px');
    await expect(header).toHaveCSS(
      'border-bottom-color',
      await painted(page, 'var(--app-border)'),
    );
    // 内置头部与插槽头部共用同一圈内边距，插槽内容不再贴着抽屉边缘
    await expect(header).toHaveCSS('padding-left', '24px');
    await expect(header).toHaveCSS('padding-top', '16px');

    /*
     * 动画契约：甩动位移走 `translate`，开关场走 `transform`（keyframes），
     * 两条各占一个属性才互不顶掉。都挂在 transform 上时，动画结束那一刻
     * 声明值重新接管，`transition-transform` 把它当一次位移补间 ——
     * 表现就是面板"再滑一下"，也就是原来那道卡顿。
     */
    const atRest = await panel.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        timing: cs.transitionTimingFunction,
        duration: cs.transitionDuration,
        property: cs.transitionProperty,
        willChange: cs.willChange,
      };
    });
    expect(atRest.property, '面板的补间对象只能是 translate').toBe('translate');
    expect(atRest.duration).toBe('0.5s');
    expect(atRest.timing).toBe('cubic-bezier(0.32, 0.72, 0, 1)');
    /** 面板是铺满一侧的大元素，常驻 will-change 会长期占一个合成层 */
    expect(atRest.willChange, '静止时不该提前提层').not.toBe('translate');

    // 拖 20px（低于 40px 阈值）：拖拽期间才提层、时长归 0 让手指位移直接跟手
    const rect = await settledBox(panel);
    await page.mouse.move(rect.x + 80, rect.y + 20);
    await page.mouse.down();
    await page.mouse.move(rect.x + 100, rect.y + 20, { steps: 4 });

    const swiping = await panel.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        duration: cs.transitionDuration,
        willChange: cs.willChange,
      };
    });
    const swipingFlag = await panel.getAttribute('data-swiping');
    await page.mouse.up();

    expect(swipingFlag, '拖拽期间面板应带上 data-swiping').not.toBeNull();
    expect(swiping.willChange, '拖拽期间才提层').toBe('translate');
    expect(swiping.duration, '跟手阶段不该再补间').toBe('0s');

    await expect(panel).toBeVisible();
    await expect(panel).toHaveCSS('will-change', 'auto');

    expect(errors.errors).toEqual([]);
  });
});

test.describe('路由加载指示器', () => {
  /**
   * spinner 只在导航真正卡住的那一刻存在，所以把目标页的 `.vue` 模块请求扣住不放：
   * `router.beforeEach` 已经跑了（loading 置真），而异步组件还没出库 ——
   * 遮罩就一直挂着，读数不需要和动画抢时间。放行放在 finally 里，
   * 万一断言炸了也不会把 dev server 的请求闸门留给下一个用例。
   */
  test('导航期间的加载圈与进度条都吃全局主色', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page);

    /*
     * 闸门必须赶在目标页的**第一次**访问之前挂好：
     * 同一个 document 里 ES 模块只加载一次，第二次 `import()` 直接命中模块图，
     * 网络请求根本不会发出（实测第二次进 /system/user 一个 .vue 请求都没有），
     * 到时候想扣也扣不住。
     *
     * 预热因此换一个"同依赖家族"的页面（角色管理，同样吃 table/form 那一套）：
     * dev 下第一次访问某页要现场编译，发现新依赖时 Vite 还会整页 reload，
     * 那一下会把闸门扣着的请求掐断 —— 让它发生在挂闸门之前。
     */
    await go(page, '/system/role');

    const target = 'views/system/user';
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const held: string[] = [];
    const holdTargetChunk = async (route: Route) => {
      const url = route.request().url();
      if (!url.includes(target)) return route.continue();
      held.push(url);
      await gate;
      /** 浏览器可能已经自己取消了这个请求（整页 reload / 导航被中止），此时 continue 会抛 */
      try {
        await route.continue();
      } catch {
        /* 交给页面自己的超时兜底，不让 handler 的异常盖掉真正的断言失败 */
      }
    };
    await page.route(/\.vue(\?|$)/, holdTargetChunk);

    try {
      await navigate(page, '/system/user');

      const overlay = page.getByRole('status', { name: '页面加载中' });
      await expect(overlay, '组件还没出库时应当挂着加载遮罩').toBeVisible({
        timeout: 8_000,
      });

      const primary = await painted(page, 'var(--app-primary)');
      /**
       * 原缺陷：旋转指示器是写死的灰黑色。`Spinner` 画的是 `currentColor` 描边，
       * 所以决定转圈颜色的是元素自己算出来的 `color` —— 这里要它等于主色令牌。
       */
      const spinner = overlay.locator('svg[aria-label="Loading"]');
      await expect(spinner).toHaveCSS('color', primary);
      const stroke = await spinner.evaluate(
        (el) => getComputedStyle(el).stroke,
      );
      expect(
        stroke === 'currentColor' ? primary : stroke,
        '描边应继承 currentColor，而不是另一个硬编码色',
      ).toBe(primary);
    } finally {
      release();
      await page.unroute(/\.vue(\?|$)/, holdTargetChunk);
    }

    expect(held, '闸门没拦住目标模块，等于这条用例什么都没验').not.toEqual([]);

    await expectActivePath(page, '/system/user');

    /*
     * 顶部进度条取色：`barColor` 走 `var(--app-primary)` 而不是十六进制字面量。
     * 导航结束后进度归零、整条淡出，但底色仍是同一个变量，所以这时读也稳。
     */
    const bar = page.locator('[role="progressbar"]').first();
    await expect(bar).toHaveAttribute('aria-label', /加载/);
    await expect(bar.locator('div').first()).toHaveCSS(
      'background-color',
      await painted(page, 'var(--app-primary)'),
    );

    expect(errors.errors).toEqual([]);
  });
});

test.describe('大文件上传列表', () => {
  /** 1×1 透明 PNG：走「缩略图」那列的图片分支 */
  const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  );

  test('表头与每个单元格都居中，flex 单元格靠 justify-content 居中', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await signIn(page);
    await go(page, '/components/upload');

    const card = cardByTitle(page, '大文件上传');
    const chooser = page.waitForEvent('filechooser');
    await card.getByRole('button', { name: /选择文件/ }).click();
    (await chooser).setFiles([
      { name: 'photo.png', mimeType: 'image/png', buffer: PNG },
      {
        name: 'dataset.bin',
        mimeType: 'application/octet-stream',
        buffer: Buffer.alloc(2048),
      },
    ]);

    await expect(card.locator('tbody tr')).toHaveCount(2);

    /*
     * 原缺陷：整张表左对齐，居中的缩略图顶着左对齐的表头。
     * 判据是"这一张表里没有任何一个格子还是别的对齐方式"，
     * 把没对齐的那格连文字一起打出来，方便定位是哪一列漏了类。
     */
    const misaligned = await card
      .locator('th, td')
      .evaluateAll((cells) =>
        cells
          .filter((cell) => getComputedStyle(cell).textAlign !== 'center')
          .map((cell) => ({
            tag: cell.tagName.toLowerCase(),
            text: (cell.textContent ?? '').trim().slice(0, 16),
          })),
      );
    expect(misaligned, '存在未居中的单元格').toEqual([]);

    /**
     * 缩略图、进度、操作三列里装的是 flex 容器：`text-align` 管不到它们，
     * 居中得看 `justify-content`。漏一列就是那一列在宽表里靠左。
     */
    const flexRows = await card
      .locator('tbody tr')
      .first()
      .evaluate((row) =>
        [...row.children]
          .map((td) => td.firstElementChild as HTMLElement | null)
          .filter((child): child is HTMLElement => !!child)
          .map((child) => ({
            display: getComputedStyle(child).display,
            justify: getComputedStyle(child).justifyContent,
          }))
          .filter((entry) => entry.display.includes('flex')),
      );
    expect(flexRows.length, '应当至少量到一个 flex 单元格').toBeGreaterThan(0);
    for (const entry of flexRows) {
      expect(entry.justify, 'flex 单元格应在水平方向居中').toBe('center');
    }

    expect(errors.errors).toEqual([]);
  });
});
