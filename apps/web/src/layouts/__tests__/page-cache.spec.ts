import type { MenuConfig, TabItem } from '@antdv/types';

import { mount } from '@vue/test-utils';
import { defineComponent, h, KeepAlive, nextTick, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';
import { useRouteStore } from '~/stores/modules/route';
import { useTabsStore } from '~/stores/modules/tabs';

import { resetPageCache, usePageCache } from '../composables/usePageCache';

/**
 * 页面缓存（`<KeepAlive :include>`）的行为测试。
 *
 * 这里要守住的是一条**过去一直是坏的**链路：include 曾被喂以路由 name
 * （`/system/user/`），而 KeepAlive 按组件名匹配，于是所有页面缓存静默失效，
 * 表现是"切走再切回，表单草稿没了"。测试因此全部围绕"名字对得上"来写。
 */

const Inner = defineComponent({
  render: () => h('div', { class: 'inner-page' }, 'page-body'),
});

function makeTab(path: string, overrides: Partial<TabItem> = {}): TabItem {
  return {
    closable: true,
    key: path,
    path,
    title: path,
    ...overrides,
  };
}

/** 菜单：/system/user 与 /dashboard/analysis 声明缓存，/system/log 不缓存 */
function setupStores(menuList?: MenuConfig[]) {
  const routeStore = useRouteStore();
  routeStore.menus = menuList ?? [
    {
      children: [
        { keepAlive: true, name: 'SystemUser', path: '/system/user', title: '用户管理' },
        { name: 'SystemLog', path: '/system/log', title: '系统日志' },
      ],
      name: 'System',
      path: '/system',
      title: '系统管理',
    },
    { keepAlive: true, name: 'Analysis', path: '/dashboard/analysis', title: '分析面板' },
  ] as unknown as MenuConfig[];

  const tabsStore = useTabsStore();
  return { routeStore, tabsStore };
}

beforeEach(() => {
  setActivePinia(createPinia());
  resetPageCache();
});

describe('isCacheable —— 以 path 为连接键', () => {
  it('菜单声明了 keepAlive 的页面可缓存，未声明的不行', () => {
    setupStores();
    const { isCacheable } = usePageCache();
    expect(isCacheable('/system/user')).toBe(true);
    expect(isCacheable('/system/log')).toBe(false);
  });

  it('结尾斜杠差异不影响判定（path 归一化后才比对）', () => {
    setupStores();
    const { isCacheable } = usePageCache();
    expect(isCacheable('/system/user/')).toBe(true);
  });

  it('空 path 一律不缓存', () => {
    setupStores();
    const { isCacheable } = usePageCache();
    expect(isCacheable('')).toBe(false);
    expect(isCacheable(undefined)).toBe(false);
  });
});

describe('wrap —— 给可缓存页面套上"名字可控"的包装组件', () => {
  it('不可缓存页面原样返回，渲染路径与改动前一致', () => {
    setupStores();
    const { wrap } = usePageCache();
    expect(wrap('/system/log', Inner)).toBe(Inner);
  });

  it('包装组件的 name 用 path + 代号，而不是框架生成的路由 name', () => {
    setupStores();
    const { wrap } = usePageCache();
    const wrapped = wrap('/system/user', Inner) as { name?: string };
    expect(wrapped.name).toBe('/system/user#0');
  });

  it('同一 path 复用同一包装组件实例（标识不稳定则 KeepAlive 认不出缓存槽）', () => {
    setupStores();
    const { wrap } = usePageCache();
    expect(wrap('/system/user', Inner)).toBe(wrap('/system/user', Inner));
  });

  it('包装后仍能渲染出真正的页面内容', () => {
    setupStores();
    const { wrap } = usePageCache();
    const Host = defineComponent({
      render: () => h(wrap('/system/user', Inner)!),
    });
    const wrapper = mount(Host);
    expect(wrapper.find('.inner-page').exists()).toBe(true);
    expect(wrapper.text()).toContain('page-body');
    wrapper.unmount();
  });

  it('页面换了新的 vnode，包装组件渲染的是最新那一份', () => {
    setupStores();
    const { wrap } = usePageCache();
    const First = defineComponent({ render: () => h('div', { class: 'first' }) });
    const Second = defineComponent({ render: () => h('div', { class: 'second' }) });

    const cache = wrap('/system/user', First);
    const Host = defineComponent({ render: () => h(cache!) });
    const wrapper = mount(Host);
    expect(wrapper.find('.first').exists()).toBe(true);

    // 同一个 path 再次进入：拿到的是同一个包装标识，但内容要跟上新 vnode
    wrap('/system/user', Second);
    expect(wrapper.find('.second').exists()).toBe(false); // 未触发重渲染，符合预期
    wrapper.unmount();

    const remounted = mount(defineComponent({ render: () => h(cache!) }));
    expect(remounted.find('.second').exists()).toBe(true);
    remounted.unmount();
  });
});

describe('include —— 只收录"标签开着 + 菜单允许缓存"的页面', () => {
  it('未打开的标签不进列表，关闭标签即自动失活', () => {
    const { tabsStore } = setupStores();
    const { include } = usePageCache();

    expect(include.value).toEqual([]);

    tabsStore.tabs = [makeTab('/system/user'), makeTab('/dashboard/analysis')];
    expect(include.value).toEqual(['/system/user#0', '/dashboard/analysis#0']);

    tabsStore.tabs = [makeTab('/system/user')];
    expect(include.value).toEqual(['/system/user#0']);
  });

  it('不可缓存的页面（菜单没写 keepAlive）永远不进列表', () => {
    const { tabsStore } = setupStores();
    const { include } = usePageCache();
    tabsStore.tabs = [makeTab('/system/log')];
    expect(include.value).toEqual([]);
  });

  it('外链标签不占缓存位', () => {
    const { tabsStore } = setupStores();
    const { include } = usePageCache();
    tabsStore.tabs = [makeTab('/system/user', { href: 'https://example.com' })];
    expect(include.value).toEqual([]);
  });

  it('同 path 多标签（不同 query）只产出一个缓存名', () => {
    const { tabsStore } = setupStores();
    const { include } = usePageCache();
    tabsStore.tabs = [makeTab('/system/user'), makeTab('/system/user')];
    expect(include.value).toEqual(['/system/user#0']);
  });
});

describe('invalidate —— "刷新当前标签"必须重建而不是复活', () => {
  it('换代后 include 与 wrap 都用新名字，旧实例会被 KeepAlive 清掉', () => {
    const { tabsStore } = setupStores();
    const { include, invalidate, wrap } = usePageCache();
    tabsStore.tabs = [makeTab('/system/user')];

    const before = wrap('/system/user', Inner);
    expect(include.value).toEqual(['/system/user#0']);

    invalidate('/system/user');

    const after = wrap('/system/user', Inner);
    expect(after).not.toBe(before);
    expect((after as { name?: string }).name).toBe('/system/user#1');
    expect(include.value).toEqual(['/system/user#1']);
  });

  it('只影响目标页面，其他页面的缓存代号不动', () => {
    const { tabsStore } = setupStores();
    const { include, invalidate } = usePageCache();
    tabsStore.tabs = [makeTab('/system/user'), makeTab('/dashboard/analysis')];

    invalidate('/system/user');
    expect(include.value).toEqual(['/system/user#1', '/dashboard/analysis#0']);
  });

  it('空 path 调用不产生副作用', () => {
    setupStores();
    const { include, invalidate } = usePageCache();
    invalidate(undefined);
    expect(include.value).toEqual([]);
  });
});

describe('resetPageCache —— 换账号不能留下上一个账号的页面实例', () => {
  it('清空后同一 path 产生全新包装组件', () => {
    setupStores();
    const first = usePageCache().wrap('/system/user', Inner);
    resetPageCache();
    const second = usePageCache().wrap('/system/user', Inner);
    expect(second).not.toBe(first);
  });

  it('菜单里没有 keepAlive 时一切照旧走不缓存分支', () => {
    setupStores([{ name: 'Plain', path: '/plain', title: '普通页' }] as unknown as MenuConfig[]);
    const { include, isCacheable, wrap } = usePageCache();
    expect(isCacheable('/plain')).toBe(false);
    expect(wrap('/plain', Inner)).toBe(Inner);
    expect(include.value).toEqual([]);
  });
});

describe('真机链路 —— 交给 Vue 的 KeepAlive 管缓存', () => {
  /**
   * 上面那些断言只验到"名字算得对"，这一步把结果真的塞进 `<KeepAlive>`：
   * 上一版实现用 `cloneVNode` 复用 RouterView 的 vnode，把 KeepAlive 烙过的
   * `COMPONENT_SHOULD_KEEP_ALIVE` 形状标记带进了包装组件内部，
   * 浏览器里表现为 `parentComponent.ctx.deactivate is not a function`。
   * 所以这里既验"缓存确实命中/确实失效"，也验"渲染器没有内部报错"。
   */
  function makePage(label: string, mounts: string[]) {
    return defineComponent({
      name: label,
      setup() {
        mounts.push(label);
        return () => h('div', { class: `page-${label}` }, label);
      },
    });
  }

  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  function mountHost(api: ReturnType<typeof usePageCache>, initial: { node: unknown; path: string }) {
    const current = ref(initial);
    const Host = defineComponent({
      render: () =>
        h(KeepAlive, { include: api.include.value }, {
          default: () => [h(api.wrap(current.value.path, current.value.node)!, { key: api.keyOf(current.value.path) })],
        }),
    });
    return { current, wrapper: mount(Host) };
  }

  it('切走再切回：命中缓存，不重新挂载', async () => {
    const { tabsStore } = setupStores();
    tabsStore.tabs = [makeTab('/system/user'), makeTab('/system/role')];
    const api = usePageCache();
    const mounts: string[] = [];
    const User = makePage('User', mounts);
    const Role = makePage('Role', mounts);

    const host = mountHost(api, { node: h(User), path: '/system/user' });
    expect(host.wrapper.find('.page-User').exists()).toBe(true);

    host.current.value = { node: h(Role), path: '/system/role' };
    await nextTick();
    expect(host.wrapper.find('.page-Role').exists()).toBe(true);

    host.current.value = { node: h(User), path: '/system/user' };
    await nextTick();
    expect(host.wrapper.find('.page-User').exists()).toBe(true);
    expect(mounts).toEqual(['User', 'Role']);
    expect(consoleError).not.toHaveBeenCalled();
    host.wrapper.unmount();
  });

  it('invalidate 之后回到该页：重建而非复活', async () => {
    const { tabsStore } = setupStores();
    tabsStore.tabs = [makeTab('/system/user'), makeTab('/system/role')];
    const api = usePageCache();
    const mounts: string[] = [];
    const User = makePage('User', mounts);
    const Role = makePage('Role', mounts);

    const host = mountHost(api, { node: h(User), path: '/system/user' });
    host.current.value = { node: h(Role), path: '/system/role' };
    await nextTick();

    api.invalidate('/system/user');
    host.current.value = { node: h(User), path: '/system/user' };
    await nextTick();

    expect(host.wrapper.find('.page-User').exists()).toBe(true);
    expect(mounts).toEqual(['User', 'Role', 'User']);
    expect(consoleError).not.toHaveBeenCalled();
    host.wrapper.unmount();
  });

  it('关掉标签 → 切走 → 再进：不命中缓存，且渲染器无报错', async () => {
    const { tabsStore } = setupStores();
    tabsStore.tabs = [makeTab('/system/user'), makeTab('/system/role')];
    const api = usePageCache();
    const mounts: string[] = [];
    const User = makePage('User', mounts);
    const Role = makePage('Role', mounts);

    const host = mountHost(api, { node: h(User), path: '/system/user' });

    // 关闭"用户管理"标签 → include 收缩，该页缓存条目按 prune 路径销毁
    tabsStore.tabs = [makeTab('/system/role')];
    host.current.value = { node: h(Role), path: '/system/role' };
    await nextTick();
    expect(host.wrapper.find('.page-Role').exists()).toBe(true);

    host.current.value = { node: h(User), path: '/system/user' };
    await nextTick();
    expect(mounts).toEqual(['User', 'Role', 'User']);
    expect(consoleError).not.toHaveBeenCalled();
    host.wrapper.unmount();
  });

  it('keyOf：可缓存页与组件名同步换代，普通页保持原 path', () => {
    setupStores();
    const { invalidate, keyOf } = usePageCache();
    expect(keyOf('/system/user')).toBe('/system/user#0');
    expect(keyOf('/system/log')).toBe('/system/log');
    invalidate('/system/user');
    expect(keyOf('/system/user')).toBe('/system/user#1');
  });

  it('可缓存页与不可缓存页来回切：两种分支交替也不报错', async () => {
    const { tabsStore } = setupStores();
    tabsStore.tabs = [makeTab('/system/user'), makeTab('/system/log')];
    const api = usePageCache();
    const mounts: string[] = [];
    const User = makePage('User', mounts);
    const Log = makePage('Log', mounts);

    const host = mountHost(api, { node: h(User), path: '/system/user' });
    host.current.value = { node: h(Log), path: '/system/log' };
    await nextTick();
    host.current.value = { node: h(User), path: '/system/user' };
    await nextTick();
    host.current.value = { node: h(Log), path: '/system/log' };
    await nextTick();

    expect(host.wrapper.find('.page-Log').exists()).toBe(true);
    expect(consoleError).not.toHaveBeenCalled();
    host.wrapper.unmount();
  });
});
