import type { ModalInnerMethods, ModalMethods } from '../src/types';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';

import BasicModal from '../src/modal/BasicModal.vue';
import { useModal } from '../src/modal/useModal';
import { useModalInner } from '../src/modal/useModalInner';

type RegisteredModal = ModalInnerMethods & ModalMethods;

const MODAL_SELECTOR = '.basic-modal';

function mountModal(props: Record<string, any> = {}) {
  return mount(BasicModal, {
    props: { title: '测试弹窗', ...props },
    slots: {
      default: () => h('div', { class: 'slot-content' }, '弹窗内容'),
    },
    attachTo: document.body,
  });
}

async function getRegisteredInstance(
  wrapper: ReturnType<typeof mountModal>,
): Promise<RegisteredModal> {
  await new Promise((resolve) => setTimeout(resolve, 10));
  await flushPromises();
  const events = wrapper.emitted('register');
  if (!events) throw new Error('register 事件未触发');
  return events[0]![0] as RegisteredModal;
}

function modalContent(): HTMLElement | null {
  return document.querySelector(MODAL_SELECTOR);
}

function clickButtonByText(text: string) {
  const buttons = [...document.querySelectorAll(`${MODAL_SELECTOR} button`)];
  const btn = buttons.find((b) => b.textContent?.includes(text));
  if (!btn) throw new Error(`未找到文本包含 "${text}" 的按钮`);
  (btn as HTMLElement).click();
  return btn;
}

describe('BasicModal', () => {
  let wrapper: null | ReturnType<typeof mountModal> = null;

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    document.body.innerHTML = '';
  });

  it('默认关闭时不渲染弹层内容', async () => {
    wrapper = mountModal();
    await getRegisteredInstance(wrapper);
    expect(modalContent()).toBeNull();
  });

  /** 与抽屉同一条层级约定：默认跟随 DialogContent 的 `z-50`，让浮层能盖在弹窗之上 */
  it('默认不覆盖层级，显式传入才写内联 zIndex', async () => {
    wrapper = mountModal({ open: true });
    await flushPromises();
    expect(modalContent()!.style.zIndex).toBe('');
    wrapper.unmount();

    wrapper = mountModal({ open: true, zIndex: 1100 });
    await flushPromises();
    expect(modalContent()!.style.zIndex).toBe('1100');
  });

  it('mount 后通过 register 事件暴露实例方法', async () => {
    wrapper = mountModal();
    const instance = await getRegisteredInstance(wrapper);
    expect(typeof instance.openModal).toBe('function');
    expect(typeof instance.closeModal).toBe('function');
    expect(typeof instance.setModalProps).toBe('function');
    expect(typeof instance.getVisible).toBe('function');
    expect(typeof instance.changeOkLoading).toBe('function');
    expect(typeof instance.changeLoading).toBe('function');
  });

  it('openModal/closeModal 切换可见性并触发事件', async () => {
    wrapper = mountModal();
    const instance = await getRegisteredInstance(wrapper);

    instance.openModal(true);
    await flushPromises();
    expect(instance.getVisible()).toBe(true);
    expect(modalContent()).not.toBeNull();
    expect(modalContent()!.textContent).toContain('测试弹窗');
    expect(modalContent()!.textContent).toContain('弹窗内容');
    expect(wrapper.emitted('visibleChange')?.at(-1)).toEqual([true]);
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([true]);

    await instance.closeModal();
    await flushPromises();
    expect(instance.getVisible()).toBe(false);
    expect(wrapper.emitted('visibleChange')?.at(-1)).toEqual([false]);
  });

  it('destroyOnHidden=false 时强制挂载（关闭也在 DOM）', async () => {
    wrapper = mountModal({ destroyOnHidden: false });
    await getRegisteredInstance(wrapper);
    expect(modalContent()).not.toBeNull();
  });

  it('setModalProps 动态覆盖 title 并可直接打开', async () => {
    wrapper = mountModal();
    const instance = await getRegisteredInstance(wrapper);

    instance.setModalProps({ title: '新标题', open: true });
    await flushPromises();
    expect(instance.getVisible()).toBe(true);
    expect(modalContent()!.textContent).toContain('新标题');
    expect(modalContent()!.textContent).not.toContain('测试弹窗');
  });

  it('closeFunc 返回 false 时阻止关闭', async () => {
    const closeFunc = vi.fn(async () => false);
    wrapper = mountModal({ closeFunc });
    const instance = await getRegisteredInstance(wrapper);

    instance.openModal(true);
    await flushPromises();
    await instance.closeModal();
    await flushPromises();
    expect(closeFunc).toHaveBeenCalledOnce();
    expect(instance.getVisible()).toBe(true);

    closeFunc.mockResolvedValueOnce(true);
    await instance.closeModal();
    await flushPromises();
    expect(instance.getVisible()).toBe(false);
  });

  it('点击确定触发 ok，changeOkLoading 禁用确定按钮', async () => {
    wrapper = mountModal();
    const instance = await getRegisteredInstance(wrapper);
    instance.openModal(true);
    await flushPromises();

    clickButtonByText('保存');
    expect(wrapper.emitted('ok')).toHaveLength(1);

    instance.changeOkLoading(true);
    await flushPromises();
    const okBtn = [...document.querySelectorAll(`${MODAL_SELECTOR} button`)].find((b) =>
      b.textContent?.includes('保存'),
    ) as HTMLButtonElement;
    expect(okBtn.disabled).toBe(true);

    instance.changeOkLoading(false);
    await flushPromises();
    const okBtn2 = [...document.querySelectorAll(`${MODAL_SELECTOR} button`)].find((b) =>
      b.textContent?.includes('保存'),
    ) as HTMLButtonElement;
    expect(okBtn2.disabled).toBe(false);
  });

  it('点击取消触发 cancel 并关闭', async () => {
    const afterClose = vi.fn();
    wrapper = mountModal({ afterClose });
    const instance = await getRegisteredInstance(wrapper);
    instance.openModal(true);
    await flushPromises();

    clickButtonByText('关闭');
    await flushPromises();
    expect(wrapper.emitted('cancel')).toHaveLength(1);
    expect(instance.getVisible()).toBe(false);
    expect(afterClose).toHaveBeenCalledOnce();
  });

  it('showFooter=false 隐藏整个底部；footer 插槽接管底部', async () => {
    wrapper = mountModal({ showFooter: false });
    const instance = await getRegisteredInstance(wrapper);
    instance.openModal(true);
    await flushPromises();
    expect(modalContent()!.querySelector('.modal-footer')).toBeNull();
    instance.closeModal();
    await flushPromises();

    wrapper.unmount();
    wrapper = mount(BasicModal, {
      props: { title: '自定义底部', destroyOnHidden: true },
      slots: {
        default: () => '内容',
        footer: () => h('div', { class: 'custom-footer' }, '自定义按钮区'),
      },
      attachTo: document.body,
    });
    const inst2 = await getRegisteredInstance(wrapper);
    inst2.openModal(true);
    await flushPromises();
    expect(modalContent()!.querySelector('.custom-footer')).not.toBeNull();
  });

  it('okType=danger 映射为 destructive 变体', async () => {
    wrapper = mountModal({ okType: 'danger' });
    const instance = await getRegisteredInstance(wrapper);
    instance.openModal(true);
    await flushPromises();
    const okBtn = [...document.querySelectorAll(`${MODAL_SELECTOR} button`)].find((b) =>
      b.textContent?.includes('保存'),
    );
    expect(okBtn!.className).toContain('destructive');
  });

  it('loading 遮罩在 changeLoading(true) 时出现', async () => {
    wrapper = mountModal();
    const instance = await getRegisteredInstance(wrapper);
    instance.openModal(true);
    await flushPromises();
    expect(modalContent()!.querySelector('.modal-loading-mask')).toBeNull();
    instance.changeLoading(true);
    await flushPromises();
    expect(modalContent()!.querySelector('.modal-loading-mask')).not.toBeNull();
  });
});

describe('useModal / useModalInner', () => {
  it('useModal 宿主组件可远程开关弹窗', async () => {
    let methods: null | ReturnType<typeof useModal>[1] = null;
    const Host = defineComponent({
      setup() {
        const [register, m] = useModal();
        methods = m;
        return () =>
          h(BasicModal, { title: '宿主弹窗', onRegister: register }, { default: () => '宿主内容' });
      },
    });

    const wrapper = mount(Host, { attachTo: document.body });
    await methods!.openModal(true);
    await flushPromises();
    expect(modalContent()).not.toBeNull();
    expect(modalContent()!.textContent).toContain('宿主内容');
    expect(methods!.getVisible()).toBe(true);

    await methods!.closeModal();
    await flushPromises();
    expect(methods!.getVisible()).toBe(false);
    wrapper.unmount();
    document.body.innerHTML = '';
  });

  it('useModal 在未注册时最终抛错', async () => {
    let methods: null | ReturnType<typeof useModal>[1] = null;
    const Host = defineComponent({
      setup() {
        const [, m] = useModal();
        methods = m;
        return () => h('div');
      },
    });
    const wrapper = mount(Host);
    const opened = methods!.openModal(true);
    await expect(opened).rejects.toThrow('[useModal] Modal instance not found');
    wrapper.unmount();
  });

  it('useModalInner 回调接收 openModal 传递的数据', async () => {
    const received: any[] = [];
    const dataRef = ref<any>(null);
    let innerRegister: ((instance: any) => void) | null = null;

    const Host = defineComponent({
      setup() {
        const [register] = useModalInner((data) => {
          received.push(data);
          dataRef.value = data;
        });
        innerRegister = register;
        return () =>
          h(
            BasicModal,
            { title: '编辑用户', onRegister: register },
            { default: () => `id=${dataRef.value?.id ?? ''}` },
          );
      },
    });

    const wrapper = mount(Host, { attachTo: document.body });
    await new Promise((resolve) => setTimeout(resolve, 10));
    await flushPromises();

    // 模拟父组件 openModal(true, data)：经过 innerRegister 包装后的实例
    const instance = wrapper.findComponent(BasicModal).vm as any;
    void instance;
    // 通过 register 通道拿到被 useModalInner 包装的实例
    const events = wrapper.findComponent(BasicModal).emitted('register');
    expect(events).toBeTruthy();
    const modalInstance = events![0]![0] as RegisteredModal;
    modalInstance.openModal(true, { id: 7 });
    await flushPromises();

    expect(received).toEqual([{ id: 7 }]);
    expect(modalContent()!.textContent).toContain('id=7');
    void innerRegister;
    wrapper.unmount();
    document.body.innerHTML = '';
  });
});
