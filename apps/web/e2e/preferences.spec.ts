import type { Locator } from '@playwright/test';

import { expect, test } from '@playwright/test';

import {
  closePreferenceDrawer,
  openPreferenceDrawer,
  signIn,
  watchErrors,
} from './utils/app';

/**
 * 偏好设置抽屉（SettingDrawer）本体。
 *
 * `layout.spec.ts` 改偏好是直接写 pinia，那条路径绕过抽屉这层 UI；
 * 而这一批缺陷恰好都长在 UI 上：滚动区被裁掉一截、控件挤在标题同一行、
 * 风格选项点了没反应。所以这里全程真点：按钮开抽屉 → 切面板 → 滚到底 → 点分段控件。
 */

/** 抽屉里的面板滚动容器（`@antdv/ui` Scrollbar 的 wrap 层） */
function scrollWrap(drawer: Locator) {
  return drawer.locator('.scrollbar__wrap');
}

/**
 * 分段控件。
 * 按"其中一个选项的文字"定位，因为抽屉里同时挂着顶部面板切换条（外观/布局/通用）
 * 和面板里的风格选择条，用 `.ant-segmented` 的序号太脆。
 */
function segmented(drawer: Locator, optionText: string) {
  return drawer
    .locator('.ant-segmented')
    .filter({ hasText: optionText })
    .first();
}

/** 分段控件里点某个选项 */
async function pickSegment(
  drawer: Locator,
  anchor: string,
  option: string,
) {
  const bar = segmented(drawer, anchor);
  await bar.locator('.ant-segmented-item').filter({ hasText: option }).click();
  await expect(bar.locator('.ant-segmented-item-selected')).toContainText(
    option,
  );
}

test.describe('偏好抽屉的滚动区', () => {
  test('布局面板能滚到底，最后一项完整可见也可输入', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page);
    const drawer = await openPreferenceDrawer(page, '布局');
    const wrap = scrollWrap(drawer);

    // 内容比视口高，"需要滚动"是这条用例的前提
    const overflow = await wrap.evaluate(
      (el) => el.scrollHeight - el.clientHeight,
    );
    expect(overflow, '布局面板应当超出可视高度').toBeGreaterThan(0);

    /**
     * 原缺陷：滚动区带着组件默认的 `h-full`（=父容器 100% 高），而父容器里
     * 上面还有一条面板切换条 —— 两者相加超出容器，被 `overflow-hidden` 裁掉一段，
     * 表现就是"滚到底也差一截"，最下面的「底栏与版权」永远摸不到。
     */
    await wrap.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));

    const lastItem = drawer.getByPlaceholder('如：京ICP备...');
    await expect(lastItem).toBeVisible();

    const fit = await wrap.evaluate((host) => {
      const field = host.querySelector<HTMLInputElement>(
        'input[placeholder="如：京ICP备..."]',
      )!;
      const box = field.getBoundingClientRect();
      const view = host.getBoundingClientRect();
      return {
        below: box.bottom <= view.bottom + 1,
        above: box.top >= view.top - 1,
      };
    });
    expect(fit, '滚到底后末项应完整落在滚动视口内').toEqual({
      above: true,
      below: true,
    });

    // 摸得到还得点得动：填进去的值要留在 DOM 里
    await lastItem.fill('端到端测试备案号');
    await expect(lastItem).toHaveValue('端到端测试备案号');

    expect(errors.errors).toEqual([]);
  });

  test('标签风格控件换到下一行并铺满，不再挤在标题右侧', async ({ page }) => {
    await signIn(page);
    const drawer = await openPreferenceDrawer(page, '布局');

    const control = segmented(drawer, '谷歌');
    await control.scrollIntoViewIfNeeded();

    const label = drawer.getByText('标签风格', { exact: true }).first();
    const labelBox = await label.boundingBox();
    const controlBox = await control.boundingBox();
    const viewBox = await drawer.locator('.scrollbar__view').boundingBox();
    expect(labelBox).not.toBeNull();
    expect(controlBox).not.toBeNull();
    expect(viewBox).not.toBeNull();

    /*
     * 原缺陷：5 个风格选项塞在 380px 抽屉里"标题左 / 控件右"的同一行，
     * 选项被挤出边框、说明文字被挤没。改成 stacked 后控件独立成行、横向铺满。
     */
    expect(controlBox!.y, '控件应在标题下一行').toBeGreaterThanOrEqual(
      labelBox!.y + labelBox!.height,
    );
    expect(controlBox!.x, '控件应与标题左对齐，而不是吊在右侧').toBeLessThanOrEqual(
      labelBox!.x + 8,
    );
    expect
      .soft(controlBox!.width, '铺满后不该被滚动区横向截断')
      .toBeLessThanOrEqual(viewBox!.width);

    // 铺满之后每个选项都得点得到：逐个切一遍，不出现"点了没反应"
    for (const option of ['卡片', '谷歌', '胶囊', '下划线', '纯文本']) {
      await pickSegment(drawer, '谷歌', option);
    }
  });
});

test.describe('谷歌风格标签页', () => {
  test('选谷歌得到浏览器标签的排布，切回卡片再还原', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page);
    let drawer = await openPreferenceDrawer(page, '布局');
    await pickSegment(drawer, '谷歌', '谷歌');
    await closePreferenceDrawer(page);

    const bar = page.locator('.tab-bar');
    const active = page.locator('.tab-item[data-active="true"]');
    const list = page.locator('.tab-list');

    // 栏内 stretch + 列表贴底：标签才会"坐"在标签栏下沿，而不是垂直居中悬空
    await expect
      .poll(() => bar.evaluate((el) => getComputedStyle(el).alignItems))
      .toBe('stretch');
    await expect
      .poll(() => list.evaluate((el) => getComputedStyle(el).alignItems))
      .toBe('flex-end');

    /**
     * 只有顶部两个圆角、且不画底边 —— 这是浏览器标签和卡片风格最直观的区别。
     * 底边由标签栏自己的 border-b 接续，所以选中页看着像和内容区连成一片。
     */
    const radii = await active.evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        bottomLeft: style.borderBottomLeftRadius,
        borderTopLeft: style.borderTopLeftRadius,
        bottomWidth: style.borderBottomWidth,
      };
    });
    expect(radii.borderTopLeft).toBe('8px');
    expect(radii.bottomLeft).toBe('0px');
    expect(radii.bottomWidth).toBe('0px');

    // 切回卡片风格：排布与圆角都回到原样，证明风格是"可切换"而不是一次性
    drawer = await openPreferenceDrawer(page, '布局');
    await pickSegment(drawer, '卡片', '卡片');
    await closePreferenceDrawer(page);

    await expect
      .poll(() => bar.evaluate((el) => getComputedStyle(el).alignItems))
      .toBe('center');
    const cardRadii = await active.evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        bottomLeft: style.borderBottomLeftRadius,
        borderTopLeft: style.borderTopLeftRadius,
      };
    });
    expect(cardRadii.borderTopLeft).not.toBe('0px');
    expect(cardRadii.bottomLeft).not.toBe('0px');

    expect(errors.errors).toEqual([]);
  });
});
