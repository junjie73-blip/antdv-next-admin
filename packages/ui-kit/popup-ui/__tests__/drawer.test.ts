import type { DrawerInnerMethods, DrawerMethods } from '../src/drawer/types';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import { useDrawerInner } from '../src/drawer';
import BasicDrawer from '../src/drawer/BasicDrawer.vue';
import { useDrawer } from '../src/drawer/useDrawer';

type RegisteredDrawer = DrawerInnerMethods & DrawerMethods;

const DRAWER_SELECTOR = '.basic-drawer';

function mountDrawer(props: Record<string, any> = {}) {
  return mount(BasicDrawer, {
    props: { title: '测试抽屉', ...props },
    slots: {
      default: () => h('div', { class: 'slot-content' }, '抽屉内容'),
    },
    attachTo: document.body,
  });
}

async function getRegisteredInstance(
  wrapper: ReturnType<typeof mountDrawer>,
): Promise<RegisteredDrawer> {
  await new Promise((resolve) => setTimeout(resolve, 10));
  await flushPromises();
  const events = wrapper.emitted('register');
  if (!events) throw new Error('register 事件未触发');
  return events[0]![0] as RegisteredDrawer;
}

function drawerContent(): HTMLElement | null {
  return document.querySelector(DRAWER_SELECTOR);
}

function clickButtonByText(text: string) {
  const buttons = [...document.querySelectorAll(`${DRAWER_SELECTOR} button`)];
  const btn = buttons.find((b) => b.textContent?.includes(text));
  if (!btn) throw new Error(`未找到文本包含 "${text}" 的按钮`);
  (btn as HTMLElement).click();
  return btn;
}

describe('BasicDrawer', () => {
  let wrapper: null | ReturnType<typeof mountDrawer> = null;

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    document.body.innerHTML = '';
  });

  it('默认关闭时不渲染', async () => {
    wrapper = mountDrawer();
    await getRegisteredInstance(wrapper);
    expect(drawerContent()).toBeNull();
  });

  it('未绑 open/visible 时，父组件改其他 props 不会把抽屉顶关', async () => {
    wrapper = mountDrawer();
    const instance = await getRegisteredInstance(wrapper);
    instance.openDrawer(true);
    await flushPromises();
    expect(drawerContent()).not.toBeNull();

    // 模板里 `:ok-button-props="{ disabled: !agreement }"` 每次重渲染都是新对象，
    // 曾经会触发 [open, visible] 数组源 watcher，把 visibleRef 重置成 false
    wrapper.setProps({ okButtonProps: { disabled: true } });
    await flushPromises();
    wrapper.setProps({ okButtonProps: { disabled: false } });
    await flushPromises();
    expect(drawerContent()).not.toBeNull();
    expect(instance.getVisible()).toBe(true);

    instance.closeDrawer();
    await flushPromises();
    expect(drawerContent()).toBeNull();
  });

  it('openDrawer/closeDrawer 切换并触发 visibleChange 与 update:visible', async () => {
    wrapper = mountDrawer();
    const instance = await getRegisteredInstance(wrapper);

    instance.openDrawer(true);
    await flushPromises();
    expect(instance.getVisible()).toBe(true);
    expect(drawerContent()).not.toBeNull();
    expect(drawerContent()!.textContent).toContain('测试抽屉');
    expect(drawerContent()!.textContent).toContain('抽屉内容');
    expect(wrapper.emitted('visibleChange')?.at(-1)).toEqual([true]);
    expect(wrapper.emitted('update:visible')?.at(-1)).toEqual([true]);

    await instance.closeDrawer();
    await flushPromises();
    expect(instance.getVisible()).toBe(false);
    expect(wrapper.emitted('visibleChange')?.at(-1)).toEqual([false]);
  });

  it('左右 placement 使用宽度（默认 520，size 覆盖）', async () => {
    wrapper = mountDrawer();
    const instance = await getRegisteredInstance(wrapper);
    instance.openDrawer(true);
    await flushPromises();
    expect(drawerContent()!.getAttribute('style')).toContain('width: 520px');
    instance.closeDrawer();
    await flushPromises();

    wrapper.unmount();
    wrapper = mountDrawer({ placement: 'left', size: '620px' });
    const inst2 = await getRegisteredInstance(wrapper);
    inst2.openDrawer(true);
    await flushPromises();
    expect(drawerContent()!.getAttribute('style')).toContain('width: 620px');
  });

  it('上下 placement 使用高度（默认 400）', async () => {
    wrapper = mountDrawer({ placement: 'bottom' });
    const instance = await getRegisteredInstance(wrapper);
    instance.openDrawer(true);
    await flushPromises();
    expect(drawerContent()!.getAttribute('style')).toContain('height: 400px');
  });

  /**
   * 「顶部切换条固定 + 面板内部再滚动」的调用方（偏好抽屉）要关掉这层：
   * 抽屉自带的 ScrollArea 会把内层滚动容器撑到内容高度，滚动条反过来长在正文上。
   */
  it('bodyScroll 默认包 ScrollArea，关掉后插槽内容直接落到正文', async () => {
    wrapper = mountDrawer({ open: true });
    await flushPromises();
    expect(
      document.querySelector('.basic-drawer [data-slot="scroll-area"]'),
    ).not.toBeNull();

    wrapper.unmount();
    wrapper = mountDrawer({ bodyScroll: false, open: true });
    await flushPromises();
    expect(
      document.querySelector('.basic-drawer [data-slot="scroll-area"]'),
    ).toBeNull();
    expect(drawerContent()!.querySelector('.slot-content')).not.toBeNull();
  });

  it('setDrawerProps 覆盖 title/open/visible', async () => {
    wrapper = mountDrawer();
    const instance = await getRegisteredInstance(wrapper);

    instance.setDrawerProps({ title: '新抽屉标题', visible: true });
    await flushPromises();
    expect(instance.getVisible()).toBe(true);
    expect(drawerContent()!.textContent).toContain('新抽屉标题');
  });

  it('closeFunc 返回 false 时阻止关闭', async () => {
    const closeFunc = vi.fn(async () => false);
    wrapper = mountDrawer({ closeFunc });
    const instance = await getRegisteredInstance(wrapper);

    instance.openDrawer(true);
    await flushPromises();
    await instance.closeDrawer();
    await flushPromises();
    expect(closeFunc).toHaveBeenCalledOnce();
    expect(instance.getVisible()).toBe(true);
  });

  it('ok/cancel 按钮事件与文案自定义', async () => {
    wrapper = mountDrawer({ okText: '提交', cancelText: '离开' });
    const instance = await getRegisteredInstance(wrapper);
    instance.openDrawer(true);
    await flushPromises();

    clickButtonByText('提交');
    expect(wrapper.emitted('ok')).toHaveLength(1);

    clickButtonByText('离开');
    await flushPromises();
    expect(wrapper.emitted('cancel')).toHaveLength(1);
    expect(instance.getVisible()).toBe(false);
  });

  it('destroyOnHidden=false 时强制挂载', async () => {
    wrapper = mountDrawer({ destroyOnHidden: false });
    await getRegisteredInstance(wrapper);
    expect(drawerContent()).not.toBeNull();
  });

  /**
   * force-mount 的关闭态面板不会从 DOM 摘掉，样式上必须自己"退场"：
   * 少了这两条，一块透明的 fixed 面板会盖在页面上吃掉所有点击（jsdom 量不出来，
   * 但类名在，真实浏览器里的级联才对）。
   */
  it('force-mount 的关闭态面板要置为不可交互并停在退场终点', async () => {
    wrapper = mountDrawer({ destroyOnHidden: false });
    await getRegisteredInstance(wrapper);
    const cls = drawerContent()!.className;
    expect(cls).toContain('data-[state=closed]:pointer-events-none');
    expect(cls).toContain('data-[state=closed]:fill-mode-forwards');
  });

  /** 宽度是内联 style，所以不能出现 `w-auto!` 这类 important 覆盖 */
  it('左右 placement 不给面板加 !important 宽度覆盖', async () => {
    wrapper = mountDrawer({ size: 680 });
    const instance = await getRegisteredInstance(wrapper);
    instance.openDrawer(true);
    await flushPromises();
    expect(drawerContent()!.className).not.toMatch(/\bw-auto!?\b/);
    expect(drawerContent()!.getAttribute('style')).toContain('width: 680px');
  });
});

describe('useDrawer / useDrawerInner', () => {
  it('useDrawer 宿主远程开关', async () => {
    let methods: null | ReturnType<typeof useDrawer>[1] = null;
    const Host = defineComponent({
      setup() {
        const [register, m] = useDrawer();
        methods = m;
        return () =>
          h(BasicDrawer, { title: '宿主抽屉', onRegister: register }, { default: () => '宿主内容' });
      },
    });

    const wrapper = mount(Host, { attachTo: document.body });
    await methods!.openDrawer(true);
    await flushPromises();
    expect(drawerContent()).not.toBeNull();
    expect(drawerContent()!.textContent).toContain('宿主内容');

    await methods!.closeDrawer();
    await flushPromises();
    expect(methods!.getVisible()).toBe(false);
    wrapper.unmount();
    document.body.innerHTML = '';
  });

  it('useDrawerInner 是 useDrawer 的别名（与旧实现一致，无回调）', async () => {
    expect(useDrawerInner).toBe(useDrawer);
    let methods: null | ReturnType<typeof useDrawer>[1] = null;
    const Host = defineComponent({
      setup() {
        const [register, m] = useDrawerInner();
        methods = m;
        return () =>
          h(BasicDrawer, { title: '别名抽屉', onRegister: register }, { default: () => '内容' });
      },
    });

    const wrapper = mount(Host, { attachTo: document.body });
    await methods!.openDrawer(true);
    await flushPromises();
    expect(drawerContent()).not.toBeNull();
    wrapper.unmount();
    document.body.innerHTML = '';
  });

  it('未注册时 openDrawer 抛错', async () => {
    let methods: null | ReturnType<typeof useDrawer>[1] = null;
    const Host = defineComponent({
      setup() {
        const [, m] = useDrawer();
        methods = m;
        return () => h('div');
      },
    });
    const wrapper = mount(Host);
    await expect(methods!.openDrawer(true)).rejects.toThrow(
      '[useDrawer] Drawer instance not found',
    );
    wrapper.unmount();
  });
});
