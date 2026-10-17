import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';

import { createPinia, setActivePinia } from 'pinia';
import { useAppStore } from '@antdv/stores';

import { configureLayoutHost, layoutHost } from '../src/host';
import LocaleSwitcher from '../src/widgets/language-toggle/index.vue';

/**
 * 语言切换下拉（顶栏那个入口本体）。
 *
 * 标签页/面包屑的"译文只活在渲染层"由本包其他用例钉住，
 * 这里钉的是"改语言的开关还灵不灵"：选项只来自宿主注入的候选表，
 * 点一项就是把偏好写进 app store，不该多出第二个写入口。
 * 菜单项是 Portal 出去的，所以断言直接查 document。
 */
configureLayoutHost({
  locales: [
    { code: 'en-US', label: 'English' },
    { code: 'zh-CN', label: '简体中文' },
  ],
});

async function mountSwitcher() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const wrapper = mount(
    defineComponent({ setup: () => () => h(LocaleSwitcher) }),
    { global: { plugins: [pinia] } },
  );
  await flushPromises();
  return { appStore: useAppStore(), wrapper };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('LocaleSwitcher —— 选项与写入偏好', () => {
  it('触发器显示当前语言，展开后列出已注册的语言并标出当前项', async () => {
    const { wrapper } = await mountSwitcher();

    const trigger = wrapper.get('[data-testid="locale-switcher"]');
    expect(trigger.text()).toContain('简体中文');

    await trigger.trigger('click');
    await nextTick();

    const codes = [
      ...document.body.querySelectorAll('[data-testid^="locale-option-"]'),
    ].map((node) => (node as HTMLElement).dataset.testid);
    // 选项跟着文案表走：两门语言都在，且没有多余的第三门
    expect(codes).toEqual(['locale-option-en-US', 'locale-option-zh-CN']);

    const current = document.body.querySelector(
      '[data-testid="locale-option-zh-CN"]',
    ) as HTMLElement | null;
    expect(current?.getAttribute('aria-current')).toBe('true');
    expect(
      document.body
        .querySelector('[data-testid="locale-option-en-US"]')
        ?.getAttribute('aria-current'),
    ).toBeNull();
  });

  it('选 English 只写偏好：locale 落到 app store，候选表原封不动', async () => {
    const { appStore, wrapper } = await mountSwitcher();
    await wrapper.get('[data-testid="locale-switcher"]').trigger('click');
    await nextTick();

    (
      document.body.querySelector(
        '[data-testid="locale-option-en-US"]',
      ) as HTMLElement
    ).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();

    // 写偏好是唯一的出口：语言包、`<html lang>`、dayjs、antd 文案由宿主的 locale 效应统一展开
    expect(appStore.locale).toBe('en-US');
    expect(layoutHost.locales).toHaveLength(2);
  });
});
