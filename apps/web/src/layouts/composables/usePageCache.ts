import type { Component, VNode } from 'vue';

import { computed, defineComponent, h, isVNode, markRaw, ref } from 'vue';

import { normalizeMenuPath } from '@antdv/shared/menu';
import { useRouteStore } from '~/stores/modules/route';
import { useTabsStore } from '~/stores/modules/tabs';

/**
 * 标签页驱动的页面缓存（`<KeepAlive :include>` 的正确打开方式）。
 *
 * 为什么需要这一层：Vue 的 KeepAlive 按**组件名**匹配 include，
 * 而本项目走文件约定式路由，路由 name 是框架生成的 `/system/user/`，
 * 页面组件名要么是 `defineOptions({ name: 'SystemUser' })`、要么退化成文件名
 * `index`（几十个页面会撞成一片）。两边永远对不上，早先直接
 * `:include="路由 name 列表"` 的结果就是"缓存声明写了一堆，一个页面都没缓存住"。
 *
 * 解法：不给页面组件改名（61 个视图逐个补 `defineOptions` 既不现实也易漏），
 * 而是在渲染时套一层**名字可控的稳定包装组件**：
 * - 名字用 `path` 作键（本项目里 path 是菜单 / 路由 / 标签的唯一连接键）；
 * - 同一个 path 只创建一次包装组件，标识稳定，否则 KeepAlive 认不出同一个缓存槽；
 * - 刷新时递增代号（`/x#0 → /x#1`），旧名字从 include 里消失，
 *   Vue 的 KeepAlive 会主动清除不再匹配的条目，于是回来时是重建而不是复活。
 *
 * include 只收录"标签还开着 + 菜单声明 keepAlive"的页面，
 * 所以关闭标签会自动丢掉它的缓存，不需要另找时机手动清理。
 */

/** 缓存代号：`/system/user#0`，刷新后变成 `#1` */
function cacheName(path: string, generation: number): string {
  return `${normalizeMenuPath(path)}#${generation}`;
}

/* 单例：布局层与 useTabs 的刷新动作必须操作同一份状态，
   否则"刷新时改了代号、渲染时用的还是另一份"，缓存清不掉。 */
const generations = ref<Record<string, number>>({});
const wrappers = new Map<string, Component>();

/** 每个包装组件持有"最近一次 RouterView 给出的 vnode"，供渲染时克隆 */
const heldNodes = new Map<string, Component | VNode>();

/** 递归收集菜单里声明了 keepAlive 的叶子路径 */
function collectKeepAlivePaths(
  list: { children?: undefined | { keepAlive?: boolean }[]; keepAlive?: boolean; path?: string }[],
  acc: Set<string> = new Set(),
): Set<string> {
  for (const item of list) {
    const path = normalizeMenuPath(item.path);
    if (path && item.keepAlive) acc.add(path);
    if (item.children?.length) collectKeepAlivePaths(item.children, acc);
  }
  return acc;
}

/**
 * 退出登录时清空缓存状态（不依赖 pinia，供 store / 拦截器直接调用）。
 * 不清的话，上一个账号打开过的页面实例会留给下一个账号。
 */
export function resetPageCache() {
  wrappers.clear();
  heldNodes.clear();
  generations.value = {};
}

export function usePageCache() {
  const routeStore = useRouteStore();
  const tabsStore = useTabsStore();

  /** 菜单里声明可缓存的页面路径集合 */
  const cacheablePaths = computed(() =>
    collectKeepAlivePaths(routeStore.menus as never),
  );

  function isCacheable(path?: string): boolean {
    if (!path) return false;
    return cacheablePaths.value.has(normalizeMenuPath(path));
  }

  function nameOf(path: string): string {
    const key = normalizeMenuPath(path);
    return cacheName(key, generations.value[key] ?? 0);
  }

  /** 直接喂给 `<KeepAlive :include>` */
  const include = computed(() => {
    const names = new Set<string>();
    for (const tab of tabsStore.tabs) {
      // 外链标签压根不渲染本站页面，谈不上缓存
      if (tab.href || !isCacheable(tab.path)) continue;
      names.add(nameOf(tab.path));
    }
    return [...names];
  });

  /**
   * 把 RouterView 给出的页面包装成"名字=缓存代号"的组件。
   * 不可缓存的页面原样返回，保持与改动前一致的渲染路径。
   */
  function wrap(path: string | undefined, node: Component | null | undefined | VNode) {
    if (!node) return null;
    if (!path || !isCacheable(path)) return markRaw(node);

    const name = nameOf(path);
    // 每次渲染都更新持有的是"最新 vnode"：包装组件可能刚从缓存里被复用，
    // 拿旧的会把页面停在第一次访问时的参数上。
    heldNodes.set(name, node);

    let wrapper = wrappers.get(name);
    if (!wrapper) {
      wrapper = markRaw(
        defineComponent({
          name,
          inheritAttrs: false,
          render() {
            const held = heldNodes.get(name);
            if (!held) return null;
            /**
             * 必须**新建** vnode，不能 `cloneVNode(held)`：
             * clone 会原样带走 `shapeFlag`，而 RouterView 那份 vnode 在别处
             * （不可缓存分支）曾作为 KeepAlive 的直接子节点被烙上
             * `COMPONENT_SHOULD_KEEP_ALIVE`。带着这个标记的节点一旦在包装组件
             * 内部被 patch/unmount，Vue 会去调用父实例 ctx 上的 `deactivate`，
             * 而包装组件不是 KeepAlive —— 现场就是
             * `parentComponent.ctx.deactivate is not a function`。
             */
            if (isVNode(held)) {
              return h(held.type as Component, { ...(held.props ?? {}) }, held.children as never);
            }
            return h(held as Component);
          },
        }),
      );
      wrappers.set(name, wrapper);
    }
    return wrapper;
  }

  /**
   * KeepAlive 的缓存槽按 vnode **key** 记账，所以可缓存页面的 key 必须和
   * 组件名同步换代：只改名字不改 key，回访时 Vue 会把"缓存里的旧组件"
   * 和"新的包装组件"当作同一槽位里的类型变更，走 activate → patch → unmount，
   * 而那个还带着 SHOULD_KEEP_ALIVE 标记的旧节点此时已经没有 KeepAlive 父级，
   * 现场就是 `parentComponent.ctx.deactivate is not a function`。
   */
  function keyOf(path?: string): string {
    const normalized = normalizeMenuPath(path ?? '');
    if (!normalized) return path ?? '';
    return isCacheable(normalized) ? nameOf(normalized) : normalized;
  }

  /**
   * 丢弃某个页面的缓存（"刷新当前标签"用）：
   * 换代后旧名字与旧 key 一起消失，缓存条目按常规 prune 路径被销毁，
   * 下次进入该页面即为全新挂载。
   */
  function invalidate(path?: string) {
    if (!path) return;
    const key = normalizeMenuPath(path);
    const oldName = cacheName(key, generations.value[key] ?? 0);
    wrappers.delete(oldName);
    heldNodes.delete(oldName);
    generations.value = { ...generations.value, [key]: (generations.value[key] ?? 0) + 1 };
  }

  /** 退出登录 / 重置会话时清空，避免把上一个账号的页面实例留给下一个账号 */
  function reset() {
    wrappers.clear();
    heldNodes.clear();
    generations.value = {};
  }

  return {
    include,
    isCacheable,
    invalidate,
    keyOf,
    nameOf,
    reset,
    wrap,
  };
}
