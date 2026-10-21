import type { Locator, Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import { go, HOME_PATH, signIn, watchErrors } from './utils/app';

/**
 * 浮层的定位与工具类复核。
 *
 * 这条盯的是"页面照样渲染、点了也能选中，就是浮层不定位"这一类静默失效。
 * 上一轮把业务组件从 `apps/web/src/components` 搬进子包时，风险点就在
 * `packages/core/base/design/src/index.css` 那串 `@source`：构建根是 `apps/web`，
 * `@antdv/*` 全在 `packages/` 下（软链进 node_modules，也在 Tailwind v4 的自动内容
 * 检测之外），少登记一个包 = 那个包模板里的工具类全部不生成。
 * 表现恰恰是最难发现的那种 —— 组件挂载、交互、数据都正常，浮层却裸奔。
 *
 * 所以这里验的是**浏览器算出来的结果**，不是模板里有没有写那个类：
 * - `z-index` 拿到 50：`z-50` 真的生成了；
 * - 底色不是 transparent：`bg-popover` 真的生成了；
 * - 有投影：`shadow-md` 真的生成了；
 * - 浮层与触发器在横向上有重叠、纵向间隙 ≤ 24px：popper 贴在触发器边上
 *   （`translate-y-1` 4px + `slide-in-from-*` 2px 的余量）；
 * - 浮层整个在视口内。
 *
 * 不检查浮层自己的 `position`：reka 的 popper 把 `position: absolute` 挂在
 * 外层 wrapper 上，内容元素本体是 `static` 的（实测：`PopoverContent` 就是这样，
 * 而 `SelectContent` 因为模板里写了 `relative` 才是 `relative`）—— 判据不能建立在
 * "某个包恰好多写了一个类"上，锚点交给下面的几何检查。
 */
const CHECK = ([trigger, content]: [HTMLElement, HTMLElement]) => {
  const t = trigger.getBoundingClientRect();
  const r = content.getBoundingClientRect();
  const s = getComputedStyle(content);
  const out: string[] = [];
  if (!(Number.parseInt(s.zIndex, 10) >= 50)) {
    out.push(`z-index 不是 50（${s.zIndex}）：z-50 没生成`);
  }
  if (
    s.backgroundColor === 'rgba(0, 0, 0, 0)' ||
    s.backgroundColor === 'transparent'
  ) {
    out.push('底色是透明的：bg-popover 没生成');
  }
  if (s.boxShadow === 'none') out.push('没有投影：shadow-md 没生成');
  const overlap = Math.min(t.right, r.right) - Math.max(t.left, r.left);
  if (overlap < 8) {
    out.push(`与触发器横向不重叠（overlap=${Math.round(overlap)}）`);
  }
  const gap = Math.max(0, r.top - t.bottom, t.top - r.bottom);
  if (gap > 24) out.push(`与触发器脱开 ${Math.round(gap)}px`);
  if (
    r.top < 0 ||
    r.bottom > innerHeight ||
    r.left < 0 ||
    r.right > innerWidth
  ) {
    out.push('浮层超出视口');
  }
  return out;
};

/**
 * 等浮层自己的入场动画停下再量。
 *
 * `animate-in` + `data-[side=*]:slide-in-from-*` 挂在浮层元素本体上，头几帧量到的是
 * 位移中的旧坐标 —— 这条和 `preference-effects.spec.ts` 里 `settleToast()` 同一个坑，
 * 差别只在浮层的动画更短，撞上的概率更低，但 WebKit 每帧慢，不能赌。
 */
async function settle(target: Locator) {
  await target.evaluate((el) =>
    Promise.all(el.getAnimations().map((a) => a.finished)).then(() => null),
  );
}

async function violations(page: Page, trigger: Locator, content: Locator) {
  const triggerHandle = await trigger.elementHandle();
  const contentHandle = await content.elementHandle();
  if (!triggerHandle || !contentHandle) {
    throw new Error('触发器或浮层不在 DOM 里，量不了');
  }
  return page.evaluate(CHECK, [triggerHandle, contentHandle]);
}

/** 每一类浮层各来一发：定位链路走的是同一个 `@floating-ui`，但模板分属不同的包 */
const POPOVER_PATH = '/components/icon-picker';

/**
 * 图标选择器：卡片内唯一的 combobox 就是触发器，
 * 面板里的分类下拉在 portal 里，打开之后才存在，不会串味。
 */
function popoverTrigger(page: Page) {
  return page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText('基础用法', { exact: true }) })
    .locator('button[role="combobox"]');
}

const LAYERS: Array<{
  content: string;
  name: string;
  open: (page: Page) => Promise<Locator>;
  path: string;
}> = [
  {
    name: 'Select',
    path: '/components/loading',
    content: '[data-slot="select-content"]',
    open: async (page) => {
      const trigger = page.locator('[data-slot="select-trigger"]').first();
      await trigger.click();
      return trigger;
    },
  },
  {
    name: 'Popover',
    path: POPOVER_PATH,
    content: '[data-slot="popover-content"]',
    open: async (page) => {
      const trigger = popoverTrigger(page);
      await trigger.click();
      return trigger;
    },
  },
  {
    name: 'DropdownMenu',
    path: HOME_PATH,
    content: '[data-slot="dropdown-menu-content"]',
    open: async (page) => {
      const trigger = page.getByRole('button', { name: '标签页操作' });
      await trigger.click();
      return trigger;
    },
  },
];

test.describe('浮层定位与工具类生成', () => {
  test('三类浮层都贴着触发器，且工具类真的被生成出来了', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page);

    for (const layer of LAYERS) {
      await go(page, layer.path);
      const trigger = await layer.open(page);
      const content = page.locator(layer.content).last();
      await expect(content, `${layer.name} 没打开`).toBeVisible();
      await settle(content);

      expect(
        await violations(page, trigger, content),
        `${layer.name} 的浮层不合格`,
      ).toEqual([]);

      await page.keyboard.press('Escape');
    }

    expect(errors.errors).toEqual([]);
  });

  /**
   * 反向对照：把三条样式手动剥掉，判据必须报出来。
   *
   * 只跑"现存页面上 0 违规"是不够的 —— `CHECK` 里任何一条判据写错（比如 `zIndex`
   * 读成了 `NaN` 却把比较写成了字符串拼接），结果同样是永远绿的空检查。
   * 这里拿一个真实浮层当靶子，把三条样式一起剥掉，看判据是不是三条都报。
   */
  test('判据抓得住被剥掉样式的浮层（反向对照）', async ({ page }) => {
    await signIn(page);
    await go(page, POPOVER_PATH);
    const trigger = popoverTrigger(page);
    await trigger.click();
    const content = page.locator('[data-slot="popover-content"]').last();
    await expect(content).toBeVisible();
    await settle(content);

    // 先自证：原样是干净的，否则下面"剥掉就报"说明不了是剥掉造成的
    expect(await violations(page, trigger, content)).toEqual([]);

    await content.evaluate((el) => {
      el.style.zIndex = 'auto';
      el.style.backgroundColor = 'transparent';
      el.style.boxShadow = 'none';
    });

    const found = await violations(page, trigger, content);
    expect(found).toContain('z-index 不是 50（auto）：z-50 没生成');
    expect(found).toContain('底色是透明的：bg-popover 没生成');
    expect(found).toContain('没有投影：shadow-md 没生成');
  });
});
