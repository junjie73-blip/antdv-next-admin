import type { MenuConfig, TabItem } from '@antdv/types';

import { computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { findMenuByPath, normalizeMenuPath, visibleMenus } from '@antdv/shared/menu';
import { useRouteStore } from '~/stores/modules/route';
import { useTabsStore } from '~/stores/modules/tabs';

import { usePageCache } from './usePageCache';

/**
 * 标签页与路由之间的桥接层。
 *
 * 规则集中在这里，组件只负责渲染：
 * - **tab key 用归一化 path，不用 route name**。文件约定式路由生成的 name 带结尾斜杠
 *   （`/system/user/`），且与业务菜单 name（`SystemUser`）不同源；拿它当 key，
 *   「菜单 → 标签页」的标题/图标反查会全部落空，标签页只能显示一串路径。
 *   path 才是菜单、面包屑、守卫、标签页四方共用的连接键（见 `@antdv/shared/menu`）。
 * - 首页来自菜单树第一个叶子，异步菜单加载完成后回填；
 * - 关闭 / 跳转 / 刷新都要经过 router，所以 store 不持有路由实例。
 */
function findFirstLeaf(list: MenuConfig[]): MenuConfig | undefined {
  // 首页标签必须是"看得见"的叶子：菜单被精简后，排在最前面的很可能是隐藏项
  // （个人中心、系统工具），拿它当首页会得到一个导航里根本不存在的标签。
  for (const first of visibleMenus(list)) {
    if (!first.children?.length) return first;
    const leaf = findFirstLeaf(first.children);
    if (leaf) return leaf;
  }
  return undefined;
}

export function useTabs() {
  const route = useRoute();
  const router = useRouter();
  const tabsStore = useTabsStore();
  const routeStore = useRouteStore();
  /** 单例缓存状态：刷新时要用它推进缓存代号（见 `usePageCache`） */
  const pageCache = usePageCache();

  /**
   * 按 path 反查菜单元信息（标题 / 图标）；菜单还没加载时返回 undefined。
   *
   * `includeHidden` 是必须的：标签页反映的是"用户到过的页面"，
   * 隐藏菜单（部门管理、个人中心这类不在导航里的页面）也要有正常标题，
   * 否则标签栏会显示一串路径。
   */
  function menuOf(path: string) {
    return findMenuByPath(routeStore.menus, path, { includeHidden: true });
  }

  /** 路由表里能不能真的落到这个 path（避免把 /redirect、404 记成标签） */
  function routable(path: string) {
    try {
      return router.resolve({ path }).matched.length > 0;
    } catch {
      return false;
    }
  }

  /** 首页 tab：菜单还没到位时给一个稳定的兜底，避免首屏没有标签 */
  const homeTab = computed<TabItem>(() => {
    const leaf = findFirstLeaf(routeStore.menus);
    const path = normalizeMenuPath(leaf?.path ?? '');
    if (path) {
      return {
        affix: true,
        closable: false,
        icon: leaf?.icon,
        key: path,
        path,
        title: leaf?.title || path,
      };
    }
    return {
      affix: true,
      closable: false,
      icon: 'carbon:data-vis-4',
      key: '/dashboard/analysis',
      path: '/dashboard/analysis',
      title: '分析面板',
    };
  });

  /** 菜单异步到达后，首页的标题 / 图标需要回填 */
  watch(homeTab, (home) => tabsStore.ensureHome(home), { immediate: true });

  watch(
    () => route.path,
    (path) => {
      const key = normalizeMenuPath(path);
      if (!key) return;
      const menu = menuOf(path);
      const title = (route.meta?.title as string) ?? menu?.title;
      // 菜单之外、又没有标题的路由（404、/redirect 中转页、登录页）不进标签栏
      if (!menu && !title) return;

      tabsStore.add({
        closable: true,
        icon: (route.meta?.icon as string) ?? menu?.icon,
        key,
        // path 保留导航时的原值（query/斜杠由 router 决定），刷新与新窗口沿用
        path,
        title: title ?? key,
      });
      tabsStore.setActive(key);
    },
    { immediate: true },
  );

  const tabs = computed(() => tabsStore.tabs);
  const activeKey = computed(() => tabsStore.activeKey);

  /**
   * 点击 / 右键菜单跳转。
   *
   * key 现在就是归一化 path，但仍优先读 tab 上的 `path`：
   * 本地缓存里可能存着旧版本用路由 name 当 key 的标签，而 `path` 字段一直是对的，
   * 别让历史数据把点击导航打挂。
   */
  function activate(key: string) {
    const target = tabsStore.tabs.find((tab) => tab.key === key);
    const path = normalizeMenuPath(target?.path ?? key);
    if (!path || path === normalizeMenuPath(route.path)) return;
    if (!routable(path)) return;
    router.push({ path });
  }

  function close(key: string) {
    const next = tabsStore.remove(key);
    if (next) activate(next);
  }

  function closeOthers(key?: string) {
    const keep = tabsStore.closeOthers(key);
    if (keep) activate(keep);
  }

  function closeLeft(key: string) {
    tabsStore.closeLeft(key);
  }

  function closeRight(key: string) {
    tabsStore.closeRight(key);
  }

  function closeAll() {
    const home = tabsStore.closeAll();
    if (home) activate(home);
  }

  /**
   * 刷新：走 /redirect 中转页重建组件。
   * 光靠中转还不够——页面若被 KeepAlive 缓存住，回来时会被原样复活，
   * 所以先把该 path 的缓存代号推进一代，旧实例才会被真正丢弃。
   */
  function refresh(key?: string) {
    const target = key
      ? tabsStore.tabs.find((tab) => tab.key === key)
      : undefined;
    const path = target?.path ?? route.path;
    pageCache.invalidate(path);
    router.replace({ path: `/redirect${path}` });
  }

  function toggleMaximize(key?: string) {
    tabsStore.toggleMaximize(key);
  }

  /** 固定 / 取消固定：位置与不变量全在 store 里维护，这里只透传 */
  function toggleAffix(key: string) {
    return tabsStore.toggleAffix(key);
  }

  /**
   * 新窗口打开：外链标签直接用 href，内部页面经 router.resolve 还原完整 URL，
   * 与 activate 同源解析，避免手拼 path 时把 params / hash 拼丢。
   */
  function openInNewWindow(key: string) {
    const target = tabsStore.tabs.find((tab) => tab.key === key);
    if (!target) return;
    const url = target.href ?? router.resolve(target.path).href;
    window.open(url, '_blank', 'noopener');
  }

  /**
   * 拖拽排序：把拖拽库给出的完整新顺序写回 store。
   * store 会校验标签集合不变，校验失败时保持原顺序（不丢标签）。
   */
  function reorder(next: TabItem[]) {
    return tabsStore.syncOrder(next);
  }

  return {
    activate,
    activeKey,
    close,
    closeAll,
    closeLeft,
    closeOthers,
    closeRight,
    homeTab,
    openInNewWindow,
    refresh,
    reorder,
    tabs,
    tabsStore,
    toggleAffix,
    toggleMaximize,
  };
}
