import { flushPromises, mount } from '@vue/test-utils';
import { h, nextTick } from 'vue';

import BasicDrawer from '../src/drawer/BasicDrawer.vue';
import BasicModal from '../src/modal/BasicModal.vue';

/**
 * 确认按钮的 loading 必须跟提交函数的生命周期对齐：
 * 校验失败（抛错）或接口报错（reject）时不能把按钮留在转圈禁用状态。
 * modal 与 drawer 走同一份 shared/confirm.ts，这里成对断言防止两边再度分叉。
 */
const CASES = [
  { component: BasicModal, name: 'BasicModal', selector: '.basic-modal' },
  { component: BasicDrawer, name: 'BasicDrawer', selector: '.basic-drawer' },
] as const;

function okButton(selector: string): HTMLButtonElement {
  const btn = [...document.querySelectorAll(`${selector} button`)].find((b) =>
    b.textContent?.includes('保存'),
  ) as HTMLButtonElement | undefined;
  if (!btn) throw new Error(`${selector} 未找到保存按钮`);
  return btn;
}

async function mountWith(Component: any, onOk: (e: MouseEvent) => unknown) {
  const wrapper = mount(Component, {
    attrs: { onOk },
    props: { title: '测试', open: true },
    slots: { default: () => h('div', '内容') },
    attachTo: document.body,
  });
  await flushPromises();
  return wrapper;
}

describe.each(CASES)('$name 确认按钮 loading', ({ component, selector }) => {
  let wrapper: Awaited<ReturnType<typeof mountWith>> | null = null;

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
  });

  it('校验失败（handler 同步抛错）后按钮恢复可点击且能重试', async () => {
    const onOk = vi.fn(() => {
      throw new Error('表单校验失败');
    });
    wrapper = await mountWith(component, onOk);

    okButton(selector).click();
    await flushPromises();
    expect(okButton(selector).disabled).toBe(false);
    expect(onOk).toHaveBeenCalledTimes(1);

    okButton(selector).click();
    await flushPromises();
    expect(onOk).toHaveBeenCalledTimes(2);
  });

  it('接口报错（handler reject）期间 loading，失败后复位', async () => {
    const onOk = vi.fn(async () => {
      await Promise.resolve();
      throw new Error('500');
    });
    wrapper = await mountWith(component, onOk);

    okButton(selector).click();
    await nextTick();
    expect(okButton(selector).disabled).toBe(true);

    await flushPromises();
    expect(okButton(selector).disabled).toBe(false);
  });

  it('校验不通过提前 return 后按钮恢复可点击', async () => {
    const onOk = vi.fn(() => undefined);
    wrapper = await mountWith(component, onOk);

    okButton(selector).click();
    await flushPromises();
    expect(okButton(selector).disabled).toBe(false);
  });

  it('提交进行中保持 loading，成功后复位且不会重复触发', async () => {
    let resolveOk: (() => void) | undefined;
    const onOk = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveOk = resolve;
        }),
    );
    wrapper = await mountWith(component, onOk);

    okButton(selector).click();
    await nextTick();
    expect(okButton(selector).disabled).toBe(true);

    // loading 中的重复点击要被拦下
    okButton(selector).click();
    expect(onOk).toHaveBeenCalledTimes(1);

    resolveOk?.();
    await flushPromises();
    expect(okButton(selector).disabled).toBe(false);
  });

  it('submit 失败不会产生 Vue 未处理异常', async () => {
    const errorSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onOk = vi.fn(() => {
      throw new Error('校验失败');
    });
    wrapper = await mountWith(component, onOk);

    okButton(selector).click();
    await flushPromises();
    expect(
      errorSpy.mock.calls.some((call) =>
        String(call[0]).includes('Unhandled error'),
      ),
    ).toBe(false);
    errorSpy.mockRestore();
  });
});
