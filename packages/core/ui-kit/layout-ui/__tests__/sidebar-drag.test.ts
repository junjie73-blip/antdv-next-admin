import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import { afterEach, describe, expect, it } from 'vitest';

import LayoutSider from '../src/components/layout-sidebar/index.vue';
import {
  LAYOUT_SIDEBAR_MAX_WIDTH,
  LAYOUT_SIDEBAR_MIN_WIDTH,
  LAYOUT_SIDEBAR_WIDTH,
} from '../src/layout';
import { menuTree } from './fixtures';

/**
 * 侧栏拖拽条。
 *
 * 断言全部走 DOM：预览宽度看 `aside` 的 style，提交看 `update:width` 事件，
 * 这样"拖完不落偏好"和"拖的时候别弹一下"两条契约同时被钉住 ——
 * 换成直接调 hook 就只剩数学，夹不住接线写反（比如抬起时才写预览值）。
 *
 * 事件用手写的 `MouseEvent('pointerdown'|'pointermove'|'pointerup')` 派发：
 * `@vue/test-utils` 的 `trigger` 不认识 pointer 系列，会退化成没有 `clientX`
 * 的 `Event`，预览值直接算成 NaN。
 */

const mounted: Array<{ unmount: () => void }> = [];

function mountSider(props: Record<string, unknown> = {}) {
  const wrapper = mount(LayoutSider, {
    attachTo: document.body,
    props: { menus: menuTree, ...props },
  });
  mounted.push(wrapper);
  return wrapper;
}

function dispatch(
  target: EventTarget,
  type: string,
  clientX: number,
  button?: number,
) {
  target.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      button: button ?? 0,
      cancelable: true,
      clientX,
    }),
  );
}

/**
 * 按下点取"当前宽度的那条右边缘"，移动到 `clientX` —— 于是预览宽度就等于
 * `clientX`（夹在上下限之间），断言读起来不用换算位移量。
 */
async function dragTo(
  wrapper: ReturnType<typeof mountSider>,
  clientX: number,
  button?: number,
) {
  dispatch(
    wrapper.get('[data-layout-sidebar-drag]').element,
    'pointerdown',
    LAYOUT_SIDEBAR_WIDTH,
    button,
  );
  dispatch(window, 'pointermove', clientX);
  await nextTick();
  return widthOf(wrapper);
}

/** 接着把指针抬起，返回提交出去的宽度事件 */
async function release(wrapper: ReturnType<typeof mountSider>, clientX = 0) {
  dispatch(window, 'pointerup', clientX);
  await nextTick();
  return wrapper.emitted('update:width');
}

function widthOf(wrapper: ReturnType<typeof mountSider>) {
  const matched = (wrapper.attributes('style') ?? '').match(/width: (\d+)px/);
  return matched?.[1];
}

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  document.body.style.userSelect = '';
});

describe('LayoutSider - 拖拽改宽度', () => {
  it('常驻展开态才有拖拽条，折叠态与浮动态都不给', () => {
    expect(mountSider().find('[data-layout-sidebar-drag]').exists()).toBe(true);
    expect(
      mountSider({ collapsed: true })
        .find('[data-layout-sidebar-drag]')
        .exists(),
    ).toBe(false);
    expect(
      mountSider({ overlay: true }).find('[data-layout-sidebar-drag]').exists(),
    ).toBe(false);
  });

  it('拖拽条是根分隔符语义，横向可拖', () => {
    const handle = mountSider().get('[data-layout-sidebar-drag]');
    expect(handle.attributes('role')).toBe('separator');
    expect(handle.attributes('aria-orientation')).toBe('vertical');
  });

  it('拖动中跟手预览，宽度只在抬起时提交一次', async () => {
    const wrapper = mountSider();
    expect(await dragTo(wrapper, 260)).toBe('260');
    expect(wrapper.emitted('update:width')).toBeUndefined();

    expect(await release(wrapper, 260)).toEqual([[260]]);
    // 抬起后预览值让位给使用方传入的宽度，不再自己留着
    expect(widthOf(wrapper)).toBe(String(LAYOUT_SIDEBAR_WIDTH));
  });

  it('拖出范围夹在上下限之间，不会拖出没有菜单的一列', async () => {
    expect(await dragTo(mountSider(), 5000)).toBe(
      String(LAYOUT_SIDEBAR_MAX_WIDTH),
    );
    expect(await dragTo(mountSider(), -5000)).toBe(
      String(LAYOUT_SIDEBAR_MIN_WIDTH),
    );
  });

  it('拖回原宽度不提交，免得白白写一次偏好', async () => {
    const wrapper = mountSider();
    await dragTo(wrapper, LAYOUT_SIDEBAR_WIDTH);
    expect(await release(wrapper)).toBeUndefined();
  });

  it('拖动期间关掉宽度过渡，松手后恢复', async () => {
    const wrapper = mountSider();
    await dragTo(wrapper, 300);
    expect(wrapper.classes()).toContain('transition-none');

    await release(wrapper, 300);
    expect(wrapper.classes()).not.toContain('transition-none');
  });

  it('拖动时禁掉文字选中，松手恢复原值', async () => {
    document.body.style.userSelect = 'text';
    const wrapper = mountSider();
    await dragTo(wrapper, 300);
    expect(document.body.style.userSelect).toBe('none');

    await release(wrapper, 300);
    expect(document.body.style.userSelect).toBe('text');
  });

  it('指针滑出拖拽条也不断：监听挂在 window 上', async () => {
    const wrapper = mountSider();
    await dragTo(wrapper, 200);
    // 不重新按下，直接从 window 发第二个 move，仍要继续算
    dispatch(window, 'pointermove', 240);
    await nextTick();
    expect(widthOf(wrapper)).toBe('240');
  });

  it('按右键不算拖拽起点', async () => {
    const wrapper = mountSider();
    expect(await dragTo(wrapper, 240, 2)).toBe(String(LAYOUT_SIDEBAR_WIDTH));
  });

  it('取消（pointercancel）等于放弃这次拖拽，不提交也不留预览', async () => {
    document.body.style.userSelect = 'text';
    const wrapper = mountSider();
    await dragTo(wrapper, 320);

    dispatch(window, 'pointercancel', 320);
    await nextTick();
    expect(wrapper.emitted('update:width')).toBeUndefined();
    expect(widthOf(wrapper)).toBe(String(LAYOUT_SIDEBAR_WIDTH));
    expect(document.body.style.userSelect).toBe('text');
  });
});
