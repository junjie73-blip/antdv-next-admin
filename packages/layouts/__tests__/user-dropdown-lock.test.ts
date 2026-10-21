import { readFileSync } from 'node:fs';

import { flushPromises, mount } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import UserDropdown from '../src/widgets/user-dropdown/index.vue';
import LockScreen from '../src/widgets/user-dropdown/lock-screen.vue';
import { useLockScreen } from '../src/widgets/user-dropdown/use-lock-screen';

/**
 * 头像下拉新增的「锁屏」。
 *
 * 钉四件事：
 * 1. 入口是数据驱动菜单里多出来的一项，原有三项照旧 —— 非侵入式扩展；
 * 2. 锁上之后视口与 `<html>` 都滚不动、按键被吞掉并解锁，解锁后滚动锁还原；
 * 3. 圆角全部从 `--app-border-radius`（rem）派生，源码里一个 px 圆角都没有；
 * 4. 下拉解锁按阈值判定，阈值上下两侧各打一次。
 *
 * 遮罩与下拉菜单都是 Teleport / Portal 出去的，断言一律查 `document`。
 * 真实计算值（不同视口下半径是否相等）由 e2e 在浏览器里量，jsdom 不解析 CSS 变量。
 */

/**
 * 静态口径直接读源码：jsdom 不解析 CSS 变量，也不应用 SFC 的 `<style>`，
 * "圆角不许写 px" 这种规矩只能在文件层面钉，计算值交给 e2e 去量。
 * vitest 的工作目录是本包根目录，路径按它给（jsdom 下 `import.meta.url` 不是 file: 协议）。
 */
const LOCK_SCREEN_SOURCE = readFileSync(
  'src/widgets/user-dropdown/lock-screen.vue',
  'utf8',
);

/** 本文件挂出来的组件统一在这里登记，卸载交给 `afterEach`，用例里不各自 unmount */
const mounted: VueWrapper[] = [];

function attach(wrapper: VueWrapper) {
  mounted.push(wrapper);
  return wrapper;
}

/** 在 body 里放一个假的 reka 滚动视口，滚动锁要有真元素可锁 */
function seedViewport() {
  const viewport = document.createElement('div');
  viewport.dataset.rekaScrollAreaViewport = '';
  document.body.append(viewport);
  return viewport;
}

function mountWith(setup: () => unknown) {
  const pinia = createPinia();
  setActivePinia(pinia);
  return attach(
    mount(defineComponent({ setup }), {
      attachTo: document.body,
      global: { plugins: [pinia] },
    }),
  );
}

/** 只跑状态机的宿主：`useLockScreen` + 遮罩的 `v-if`，与 `index.vue` 的接法一致 */
function mountLockHarness() {
  return mountWith(() => {
    const { lock, locked, unlock } = useLockScreen();
    return () =>
      h('div', [
        h('button', { 'data-testid': 'harness-lock', onClick: lock }),
        locked.value ? h(LockScreen, { onUnlock: unlock }) : null,
      ]);
  });
}

async function mountDropdown() {
  const wrapper = mountWith(() => () => h(UserDropdown));
  await flushPromises();
  return wrapper;
}

async function openUserMenu() {
  const wrapper = await mountDropdown();
  await wrapper.get('[data-testid="header-user"]').trigger('click');
  await flushPromises();
  return wrapper;
}

function inBody(testId: string) {
  return document.body.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
}

function pointer(el: null | HTMLElement, type: string, clientY: number) {
  el?.dispatchEvent(
    new MouseEvent(type, { bubbles: true, cancelable: true, clientY }),
  );
}

// 先卸载再清 body：遮罩是 Teleport 出去的，容器先没了会让 Vue 的卸载流程撞在空父节点上
afterEach(async () => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  await flushPromises();
  document.body.innerHTML = '';
});

describe('用户下拉 —— 锁屏入口', () => {
  it('菜单里多出「锁屏」一项，原有三项与分隔线不动', async () => {
    await openUserMenu();

    const keys = [
      ...document.body.querySelectorAll('[data-testid^="user-menu-"]'),
    ].map((node) => (node as HTMLElement).dataset.testid);
    expect(keys).toEqual([
      'user-menu-profile',
      'user-menu-settings',
      'user-menu-docs',
      'user-menu-lock',
    ]);
  });

  it('点「锁屏」挂出遮罩，点遮罩上的解锁按钮收掉', async () => {
    await openUserMenu();

    inBody('user-menu-lock')?.click();
    await flushPromises();
    expect(inBody('lock-screen')).not.toBeNull();

    inBody('lock-unlock-button')?.click();
    await flushPromises();
    expect(inBody('lock-screen')).toBeNull();
  });
});

describe('锁屏期间 —— 滚动与默认交互', () => {
  it('锁上时视口与 html 都滚不动，解锁后原样还回去', async () => {
    const viewport = seedViewport();
    mountLockHarness();

    inBody('harness-lock')?.click();
    await flushPromises();

    expect(inBody('lock-screen')).not.toBeNull();
    expect(viewport.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');

    inBody('lock-unlock-button')?.click();
    await flushPromises();

    expect(inBody('lock-screen')).toBeNull();
    expect(viewport.style.overflow).not.toBe('hidden');
    expect(document.documentElement.style.overflow).not.toBe('hidden');
  });

  it('文档里有多枚滚动盒时，锁的是内容区那枚而不是侧栏', async () => {
    /*
     * 侧栏菜单在 DOM 里排在内容区之前，而它自己也是 reka 的 ScrollArea。
     * 裸选择器会先撞上侧栏那一枚，于是"锁住了"的是没人滚的菜单，用户滚的正文没锁。
     */
    const sidebar = seedViewport();
    const region = document.createElement('div');
    region.dataset.layoutRegion = 'content';
    const content = seedViewport();
    region.append(content);
    document.body.append(region);

    mountLockHarness();
    inBody('harness-lock')?.click();
    await flushPromises();

    expect(content.style.overflow).toBe('hidden');
    expect(sidebar.style.overflow).not.toBe('hidden');

    inBody('lock-unlock-button')?.click();
    await flushPromises();
    expect(content.style.overflow).not.toBe('hidden');
  });

  it('按任意键解锁，且这一键不会落进页面里的输入框', async () => {
    seedViewport();
    mountLockHarness();

    inBody('harness-lock')?.click();
    await flushPromises();

    const event = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'a',
    });
    window.dispatchEvent(event);
    await flushPromises();

    // 锁屏那条 keydown 是 capture + preventDefault：按键只用来解锁，不传给页面
    expect(event.defaultPrevented).toBe(true);
    expect(inBody('lock-screen')).toBeNull();
  });

  it('遮罩是全屏固定层，滚动条与右键菜单都在它之下', async () => {
    mountLockHarness();
    inBody('harness-lock')?.click();
    await flushPromises();

    const screen = inBody('lock-screen');
    expect(screen?.className).toContain('fixed');
    expect(screen?.className).toContain('inset-0');
    expect(screen?.className).toContain('overflow-hidden');
  });
});

describe('圆角口径（rem）', () => {
  it('样式表里的半径一律引用 rem 派生变量，源码没有 px 圆角', () => {
    const radii = [
      ...LOCK_SCREEN_SOURCE.matchAll(/border-radius:\s*([^;]+);/g),
    ].map((match) => match[1]?.trim() ?? '');

    // 卡片一档、按钮一档，都来自 `useCssVar` 写进卡上的变量
    expect(radii).toEqual([
      'var(--lock-card-radius)',
      'var(--lock-handle-radius)',
    ]);
    for (const value of radii) {
      expect(value).not.toMatch(/\d+(?:\.\d+)?px/u);
    }
  });

  it('基准取 `--app-border-radius`，卡片是它的 1.5 倍，把手与按钮跟基准', async () => {
    mountLockHarness();
    inBody('harness-lock')?.click();
    await flushPromises();

    const card = document.querySelector<HTMLElement>('.lock-card');
    expect(card?.style.getPropertyValue('--lock-card-radius')).toBe(
      'calc(1rem * 1.5)',
    );
    expect(card?.style.getPropertyValue('--lock-handle-radius')).toBe('1rem');
  });
});

describe('下拉解锁的阈值', () => {
  async function mountAtThreshold(threshold: number) {
    const wrapper = attach(
      mount(LockScreen, { attachTo: document.body, props: { threshold } }),
    );
    await flushPromises();
    return { handle: inBody('lock-pull-handle'), wrapper };
  }

  it.each([
    { drag: 79, unlocks: false },
    { drag: 80, unlocks: true },
    { drag: 240, unlocks: true },
  ])('阈值 80px：下拉 $drag px → 解锁 $unlocks', async ({ drag, unlocks }) => {
    const { handle, wrapper } = await mountAtThreshold(80);

    pointer(handle, 'pointerdown', 500);
    pointer(handle, 'pointermove', 500 + drag);
    pointer(handle, 'pointerup', 500 + drag);
    await flushPromises();

    expect(wrapper.emitted('unlock')?.length).toBe(unlocks ? 1 : undefined);
  });

  it('没到阈值就松手：进度归零，把手回到原位', async () => {
    const { handle, wrapper } = await mountAtThreshold(80);

    pointer(handle, 'pointerdown', 500);
    pointer(handle, 'pointermove', 560);
    pointer(handle, 'pointerup', 560);
    await flushPromises();

    // 进度写在卡片上（`--lock-pull`），位移与透明度由 CSS 自己换算，JS 不碰 style
    const card = document.querySelector<HTMLElement>('.lock-card');
    expect(card?.style.getPropertyValue('--lock-pull')).toBe('0');
    expect(wrapper.emitted('unlock')).toBeUndefined();
  });

  it('阈值由宿主给：窄屏 48px 时拖过 48 就放行', async () => {
    const { handle, wrapper } = await mountAtThreshold(48);

    pointer(handle, 'pointerdown', 300);
    pointer(handle, 'pointermove', 352);
    pointer(handle, 'pointerup', 352);
    await flushPromises();

    expect(wrapper.emitted('unlock')).toHaveLength(1);
  });
});
