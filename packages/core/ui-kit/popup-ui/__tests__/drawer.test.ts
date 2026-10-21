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

describe('basicDrawer', () => {
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

  /**
   * 头部内边距由抽屉负责：`#header` 插槽过去裸挂在 DrawerContent 里，
   * 调用方不给 padding 时标题就贴着抽屉外沿（偏好抽屉实测只剩 1px 边框）。
   */
  it('内置与自定义头部共用同一套内边距', async () => {
    wrapper = mountDrawer({ open: true });
    await flushPromises();
    const builtin = document.querySelector('.basic-drawer .drawer-header');
    expect(builtin?.className).toContain('px-6');
    expect(builtin?.className).toContain('py-4');
    wrapper.unmount();

    wrapper = mount(BasicDrawer, {
      props: { open: true, title: '自定义头' },
      slots: {
        default: () => h('div', { class: 'slot-content' }, '内容'),
        header: () => h('div', { class: 'custom-header' }, '自定义标题'),
      },
      attachTo: document.body,
    });
    await flushPromises();
    const custom = document.querySelector('.basic-drawer .drawer-header');
    expect(custom?.querySelector('.custom-header')).not.toBeNull();
    expect(custom?.className).toContain('px-6');
    expect(custom?.className).toContain('py-4');
  });

  /**
   * 层级不抢：抽屉默认不写内联 zIndex，跟着 DrawerContent 的 `z-50` 走。
   * 抽屉自带的 z-1000 会把同页所有 shadcn 浮层（Popover / Select / Tooltip 都是 z-50，
   * 且 portal 到 body 末尾）压在抽屉下面 —— 偏好抽屉里"自定义取色"点不开就是这一条。
   * 同一档位下由挂载顺序决定先后，正合"后开的在上"。需要钉死关系时才显式传 zIndex。
   */
  it('默认不覆盖层级，显式传入才写内联 zIndex', async () => {
    wrapper = mountDrawer({ open: true });
    await flushPromises();
    expect(drawerContent()!.style.zIndex).toBe('');
    wrapper.unmount();

    wrapper = mountDrawer({ open: true, zIndex: 1100 });
    await flushPromises();
    expect(drawerContent()!.style.zIndex).toBe('1100');
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

  /**
   * reka 只把 pointer-events 认领给 full-modal 分支的面板；我们走 'trap-focus'（见下条），
   * 而蒙层照样会把 body 锁成 `pointer-events: none` —— 面板不自己开回来就整块点不动。
   * 反过来关闭态必须继续不可交互，所以两条要同时钉住。
   */
  it('open 态面板认领 pointer-events，关闭态仍然不可交互', async () => {
    wrapper = mountDrawer({ destroyOnHidden: false, open: true });
    await flushPromises();
    expect(drawerContent()!.className).toContain(
      'data-[state=open]:pointer-events-auto',
    );

    wrapper.unmount();
    wrapper = mountDrawer({ destroyOnHidden: false });
    await getRegisteredInstance(wrapper);
    expect(drawerContent()!.className).toContain(
      'data-[state=closed]:pointer-events-none',
    );
  });

  /**
   * reka 的 DrawerContent 只要 modal 是严格 `true` 就把面板外的节点整片标成 aria-hidden，
   * 而且没有 Dialog 那层的 present 闸门：force-mount 的关闭态抽屉会让整个应用读屏不可见。
   * 根节点因此只传 'trap-focus' / false，这一条就是守住那个口子。
   */
  it('抽屉开着或 force-mount 关着都不把兄弟节点标成 aria-hidden', async () => {
    const appShell = document.createElement('div');
    appShell.textContent = '页面主内容';
    document.body.append(appShell);

    wrapper = mountDrawer({ destroyOnHidden: false });
    const instance = await getRegisteredInstance(wrapper);
    expect(appShell.getAttribute('aria-hidden')).toBeNull();

    instance.openDrawer(true);
    await flushPromises();
    expect(appShell.getAttribute('aria-hidden')).toBeNull();

    instance.closeDrawer();
    await flushPromises();
    expect(appShell.getAttribute('aria-hidden')).toBeNull();
  });

  /** mask 仍然管蒙层：默认有，关掉就没有（焦点陷阱跟着 modal 一起退场） */
  it('mask=false 时不渲染蒙层', async () => {
    wrapper = mountDrawer({ mask: false, open: true });
    await flushPromises();
    expect(drawerContent()).not.toBeNull();
    expect(document.querySelector('[data-slot="drawer-overlay"]')).toBeNull();

    wrapper.unmount();
    wrapper = mountDrawer({ open: true });
    await flushPromises();
    expect(
      document.querySelector('[data-slot="drawer-overlay"]'),
    ).not.toBeNull();
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
          h(
            BasicDrawer,
            { title: '宿主抽屉', onRegister: register },
            { default: () => '宿主内容' },
          );
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
          h(
            BasicDrawer,
            { title: '别名抽屉', onRegister: register },
            { default: () => '内容' },
          );
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
