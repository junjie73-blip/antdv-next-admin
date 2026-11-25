import type { VueWrapper } from '@vue/test-utils';

import type { LockPasswordStorage } from '../src/widgets/user-dropdown/lock-password';

import { readFileSync } from 'node:fs';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import UserDropdown from '../src/widgets/user-dropdown/index.vue';
import {
  clearLockPassword,
  configureLockPasswordStorage,
} from '../src/widgets/user-dropdown/lock-password';
import LockScreen from '../src/widgets/user-dropdown/lock-screen.vue';
import { useLockScreen } from '../src/widgets/user-dropdown/use-lock-screen';

/**
 * 头像下拉新增的「锁屏」与密码保护流程。
 *
 * 钉六件事：
 * 1. 入口是数据驱动菜单里多出来的一项，原有三项照旧 —— 非侵入式扩展；
 * 2. 首次锁屏进入「设置密码」，非空/两次一致/最短长度三个校验各挡一次；
 * 3. 设置成功仍保持锁定，要再输一次密码才解锁；重复锁屏走「解锁」模式；
 * 4. 错误/空密码只给提示不解锁；滚动锁与圆角规范不受影响；
 * 5. 下拉手势改成「提交密码」而不是直接放行，阈值判定与位移口径不变；
 * 6. 键盘不再能绕过密码解锁，但密码框内的输入照常。
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

/** 内存存储：用例间不串密码，也不碰真实 localStorage */
function createMemoryStorage(): LockPasswordStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    removeItem: (key) => void map.delete(key),
    setItem: (key, value) => void map.set(key, value),
  };
}

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
    const state = useLockScreen();
    return () =>
      h('div', { 'data-artwork': state.artworkUrl.value, 'data-testid': 'lock-harness' }, [
        h('button', { 'data-testid': 'harness-lock', onClick: state.lock }),
        state.locked.value
          ? h(LockScreen, {
              artworkUrl: state.artworkUrl.value,
              errorMessageKey: state.errorMessageKey.value,
              mode: state.mode.value,
              onSubmitPassword: (payload: {
                password: string;
                confirm: string;
              }) => state.submitPassword(payload.password, payload.confirm),
            })
          : null,
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

function pointer(el: HTMLElement | null, type: string, clientY: number) {
  el?.dispatchEvent(
    new MouseEvent(type, { bubbles: true, cancelable: true, clientY }),
  );
}

/** 往密码框里填值并触发输入事件（v-model 靠 input 事件回写） */
function typeInto(testId: string, value: string) {
  const input = inBody(testId) as HTMLInputElement | null;
  if (!input) return;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function submitForm() {
  inBody('lock-unlock-button')?.click();
  await flushPromises();
}

// 先卸载再清 body：遮罩是 Teleport 出去的，容器先没了会让 Vue 的卸载流程撞在空父节点上
beforeEach(() => {
  configureLockPasswordStorage(createMemoryStorage());
  clearLockPassword();
});

afterEach(async () => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  await flushPromises();
  document.body.innerHTML = '';
  configureLockPasswordStorage(null);
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

  it('触发器只留图标：用户名从 `aria-label` 念，不再常驻文本', async () => {
    const wrapper = await mountDropdown();
    const trigger = wrapper.get('[data-testid="header-user"]');

    // 与 `widget-button.vue` 同一条规矩：顶栏按钮一律不带文字，
    // 窄视口里多一段用户名（约 60px）就把菜单和 logo 挤没了。
    // 按钮里只剩头像兜底字符，读屏与 tooltip 走 aria-label / title。
    expect(trigger.text().trim()).toBe('U');
    const label = trigger.attributes('aria-label');
    expect(label).toBeTruthy();
    expect(trigger.attributes('title')).toBe(label);
  });

  it('点「锁屏」挂出首次设置面板，设置 + 校验后才收掉', async () => {
    await openUserMenu();

    inBody('user-menu-lock')?.click();
    await flushPromises();
    expect(inBody('lock-screen')).not.toBeNull();
    // 首次：设置模式，两个密码框
    expect(inBody('lock-password-confirm')).not.toBeNull();

    typeInto('lock-password-input', '1234');
    typeInto('lock-password-confirm', '1234');
    await submitForm();
    // 设置成功仍锁定，切到解锁模式（确认框消失）
    expect(inBody('lock-screen')).not.toBeNull();
    expect(inBody('lock-password-confirm')).toBeNull();

    typeInto('lock-password-input', '1234');
    await submitForm();
    expect(inBody('lock-screen')).toBeNull();
  });
});

describe('锁屏密码 —— 校验与边界', () => {
  it('空密码设置被挡住，保持在设置模式并给出明确提示', async () => {
    mountLockHarness();
    inBody('harness-lock')?.click();
    await flushPromises();

    await submitForm();
    expect(inBody('lock-screen')).not.toBeNull();
    expect(inBody('lock-password-hint')?.dataset.lockError).toBe(
      'header.lockPasswordRequired',
    );
    expect(inBody('lock-password-confirm')).not.toBeNull();
  });

  it('两个密码框都关闭自动填充，不让管理器填出两个不同的密码', async () => {
    mountLockHarness();
    inBody('harness-lock')?.click();
    await flushPromises();

    const password = inBody('lock-password-input') as HTMLInputElement;
    const confirm = inBody('lock-password-confirm') as HTMLInputElement;
    // 一个 current-password + 一个 new-password 会让浏览器分别填「旧密码」
    // 与「生成的新密码」：看着都有圆点，值却不同，提交必报 mismatch。
    expect(password.autocomplete).toBe('off');
    expect(confirm.autocomplete).toBe('off');
  });

  it('两个框都能经真实按键输入，两次一致即可设置成功', async () => {
    mountLockHarness();
    inBody('harness-lock')?.click();
    await flushPromises();

    /** 每个字符先过 keydown（捕获阶段不得吞掉），再写值触发 v-model */
    function typeWithKeydown(testId: string, value: string) {
      const input = inBody(testId) as HTMLInputElement;
      for (const char of value) {
        const event = new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          key: char,
        });
        input.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(false);
      }
      typeInto(testId, value);
    }

    typeWithKeydown('lock-password-input', 'abcd');
    typeWithKeydown('lock-password-confirm', 'abcd');
    await submitForm();

    expect(inBody('lock-password-hint')?.dataset.lockError).toBeUndefined();
    // 设置成功切到解锁模式，确认框消失
    expect(inBody('lock-password-confirm')).toBeNull();
  });

  it('两次密码不一致被挡住，错误提示是 mismatch', async () => {
    mountLockHarness();
    inBody('harness-lock')?.click();
    await flushPromises();

    typeInto('lock-password-input', 'abcd');
    typeInto('lock-password-confirm', 'abce');
    await submitForm();
    expect(inBody('lock-screen')).not.toBeNull();
    expect(inBody('lock-password-hint')?.dataset.lockError).toBe(
      'header.lockPasswordMismatch',
    );
  });

  it('密码不足最短长度被挡住，提示 tooShort', async () => {
    mountLockHarness();
    inBody('harness-lock')?.click();
    await flushPromises();

    typeInto('lock-password-input', 'ab');
    typeInto('lock-password-confirm', 'ab');
    await submitForm();
    expect(inBody('lock-screen')).not.toBeNull();
    expect(inBody('lock-password-hint')?.dataset.lockError).toBe(
      'header.lockPasswordTooShort',
    );
  });

  it('已设密码后重复锁屏走解锁模式，错误/空密码都不放行，正确密码放行', async () => {
    mountLockHarness();
    // 第一次：设置密码并解锁
    inBody('harness-lock')?.click();
    await flushPromises();
    typeInto('lock-password-input', '5678');
    typeInto('lock-password-confirm', '5678');
    await submitForm();
    typeInto('lock-password-input', '5678');
    await submitForm();
    expect(inBody('lock-screen')).toBeNull();

    // 第二次锁屏：直接进入解锁模式（无确认框）
    inBody('harness-lock')?.click();
    await flushPromises();
    expect(inBody('lock-password-confirm')).toBeNull();

    // 错误密码
    typeInto('lock-password-input', '0000');
    await submitForm();
    expect(inBody('lock-screen')).not.toBeNull();
    expect(inBody('lock-password-hint')?.dataset.lockError).toBe(
      'header.lockPasswordWrong',
    );

    // 空密码
    typeInto('lock-password-input', '');
    await submitForm();
    expect(inBody('lock-screen')).not.toBeNull();
    expect(inBody('lock-password-hint')?.dataset.lockError).toBe(
      'header.lockPasswordWrong',
    );

    // 正确密码
    typeInto('lock-password-input', '5678');
    await submitForm();
    expect(inBody('lock-screen')).toBeNull();
  });

  it('存储里只有散列，没有密码明文', async () => {
    const storage = createMemoryStorage();
    configureLockPasswordStorage(storage);
    mountLockHarness();
    inBody('harness-lock')?.click();
    await flushPromises();

    typeInto('lock-password-input', 'secret');
    typeInto('lock-password-confirm', 'secret');
    await submitForm();

    const stored = storage.getItem('antdv.lock.password');
    expect(stored).toBeTruthy();
    expect(stored).not.toContain('secret');
  });
});

describe('锁屏背景图 —— 锁定时生成，解锁后移除', () => {
  it('每次锁定得到一张本地 SVG 图，解锁后图片与 data URL 一起清掉', async () => {
    mountLockHarness();
    inBody('harness-lock')?.click();
    await flushPromises();

    const artwork = inBody('lock-artwork') as HTMLImageElement | null;
    expect(artwork).not.toBeNull();
    expect(artwork?.getAttribute('src')).toMatch(/^data:image\/svg\+xml,/u);
    expect(inBody('lock-harness')?.dataset.artwork).toBeTruthy();

    typeInto('lock-password-input', '1234');
    typeInto('lock-password-confirm', '1234');
    await submitForm();
    typeInto('lock-password-input', '1234');
    await submitForm();

    expect(inBody('lock-screen')).toBeNull();
    expect(inBody('lock-harness')?.dataset.artwork).toBe('');
  });
});

describe('锁屏期间 —— 滚动与默认交互', () => {
  it('锁上时视口与 html 都滚不动，正确解锁后原样还回去', async () => {
    const viewport = seedViewport();
    mountLockHarness();

    inBody('harness-lock')?.click();
    await flushPromises();

    expect(inBody('lock-screen')).not.toBeNull();
    expect(viewport.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');

    typeInto('lock-password-input', '1234');
    typeInto('lock-password-confirm', '1234');
    await submitForm();
    typeInto('lock-password-input', '1234');
    await submitForm();

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

    typeInto('lock-password-input', '1234');
    typeInto('lock-password-confirm', '1234');
    await submitForm();
    typeInto('lock-password-input', '1234');
    await submitForm();
    expect(content.style.overflow).not.toBe('hidden');
  });

  it('按键不再能绕过密码解锁，但密码框内的输入照常', async () => {
    seedViewport();
    mountLockHarness();

    inBody('harness-lock')?.click();
    await flushPromises();

    // 落在遮罩上的按键被吞掉，但不会解锁
    const blocked = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'a',
    });
    window.dispatchEvent(blocked);
    await flushPromises();
    expect(blocked.defaultPrevented).toBe(true);
    expect(inBody('lock-screen')).not.toBeNull();

    // 落在密码框上的按键放行（否则用户根本输不了密码）
    const input = inBody('lock-password-input');
    const allowed = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'a',
    });
    input?.dispatchEvent(allowed);
    expect(allowed.defaultPrevented).toBe(false);

    // 设置模式的「确认密码」框同样必须放行：捕获阶段漏掉它，
    // 用户打字被 preventDefault 吞掉，提交时必然误报「两次输入不一致」。
    const confirm = inBody('lock-password-confirm');
    const confirmAllowed = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'a',
    });
    confirm?.dispatchEvent(confirmAllowed);
    expect(confirmAllowed.defaultPrevented).toBe(false);
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

  it('基准取 `--radius`，卡片是它的 1.5 倍，把手与按钮跟基准', async () => {
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

describe('下拉手势 —— 提交密码而非直接放行', () => {
  async function mountAtThreshold(threshold: number) {
    const wrapper = attach(
      mount(LockScreen, { attachTo: document.body, props: { threshold } }),
    );
    await flushPromises();
    return { handle: inBody('lock-pull-handle'), wrapper };
  }

  it.each([
    { drag: 79, submits: false },
    { drag: 80, submits: true },
    { drag: 240, submits: true },
  ])('阈值 80px：下拉 $drag px → 提交 $submits', async ({ drag, submits }) => {
    const { handle, wrapper } = await mountAtThreshold(80);

    pointer(handle, 'pointerdown', 500);
    pointer(handle, 'pointermove', 500 + drag);
    pointer(handle, 'pointerup', 500 + drag);
    await flushPromises();

    expect(wrapper.emitted('submit-password')?.length).toBe(
      submits ? 1 : undefined,
    );
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
    expect(wrapper.emitted('submit-password')).toBeUndefined();
  });

  it('阈值由宿主给：窄屏 48px 时拖过 48 就提交', async () => {
    const { handle, wrapper } = await mountAtThreshold(48);

    pointer(handle, 'pointerdown', 300);
    pointer(handle, 'pointermove', 352);
    pointer(handle, 'pointerup', 352);
    await flushPromises();

    expect(wrapper.emitted('submit-password')).toHaveLength(1);
  });
});
