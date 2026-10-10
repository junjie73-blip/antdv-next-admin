import type { BreadcrumbItem, LayoutRegionFlags, MenuTreeSource } from '@antdv/layouts';

import type { ComputedRef } from 'vue';

import { computed, onScopeDispose, ref } from 'vue';
import { useRoute } from 'vue-router';

import {
  createBreadcrumbSource,
  getBlueprint,
  LAYOUT_DRAWER_WIDTH,
  LAYOUT_SIDEBAR_COLLAPSED_WIDTH,
  LAYOUT_SIDEBAR_MAX_WIDTH,
  LAYOUT_SIDEBAR_MIN_WIDTH,
  MOBILE_BREAKPOINT,
  resolveContentStyle,
  useLayoutRegions,
} from '@antdv/layouts';
import { useAppStore } from '~/stores/modules/app';
import { useTabsStore } from '~/stores/modules/tabs';

import { useMenuTree } from './useMenuTree';

export {
  LAYOUT_SIDEBAR_COLLAPSED_WIDTH as COLLAPSED_WIDTH,
  LAYOUT_SIDEBAR_MAX_WIDTH,
  LAYOUT_SIDEBAR_MIN_WIDTH,
};

/* ============================================================
 * 视口断点
 * ============================================================ */

const MOBILE_MEDIA = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;
const isMobile = ref(false);
let listeners = 0;

function syncMobile(): void {
  /* Safari 无痕 / 老浏览器可能没有 matchMedia，退化到宽度比较 */
  if (typeof window.matchMedia === 'function') {
    isMobile.value = window.matchMedia(MOBILE_MEDIA).matches;
    return;
  }
  isMobile.value = window.innerWidth < MOBILE_BREAKPOINT;
}

/**
 * 响应式断点（全局共享一份监听）。
 *
 * 外壳、侧边栏、导航栏都会问"现在是不是手机尺寸"，
 * 每个组件各自 addEventListener 会挂出十几个同类监听；
 * 这里按引用计数注册一次，作用域销毁时释放。
 */
export function useMobile(): ComputedRef<boolean> {
  if (listeners === 0) {
    syncMobile();
    if (typeof window.matchMedia === 'function') {
      const mql = window.matchMedia(MOBILE_MEDIA);
      mql.addEventListener('change', syncMobile);
      onScopeDispose(() => mql.removeEventListener('change', syncMobile));
    } else {
      window.addEventListener('resize', syncMobile);
      onScopeDispose(() => window.removeEventListener('resize', syncMobile));
    }
  }
  listeners += 1;
  onScopeDispose(() => {
    listeners = Math.max(0, listeners - 1);
  });

  return computed(() => isMobile.value);
}

/* ============================================================
 * useLayout —— 折叠 / 宽度等零散状态（保留旧 API）
 * ============================================================ */
export function useLayout() {
  const appStore = useAppStore();
  const mobile = useMobile();

  const collapsed = computed({
    get: () => appStore.sidebarCollapsed,
    set: (value: boolean) => appStore.updateSetting({ sidebarCollapsed: value }),
  });

  const sidebarWidth = computed(() => appStore.sidebarWidth);

  function toggleCollapsed(): void {
    collapsed.value = !collapsed.value;
  }

  /** 移动端自动收起：旧代码在 mount 时手动调用，现在断点由 useMobile 负责 */
  function checkMobile(): void {
    syncMobile();
    if (isMobile.value && !appStore.sidebarCollapsed) {
      appStore.updateSetting({ sidebarCollapsed: true });
    }
  }

  return {
    collapsed,
    isMobile: mobile,
    sidebarWidth,
    toggleCollapsed,
    checkMobile,
  };
}

/* ============================================================
 * useBreadcrumb —— 面包屑
 * ============================================================ */
export function useBreadcrumb() {
  const route = useRoute();
  const source = useMenuTree();

  const breadcrumbs = createBreadcrumbSource({
    menus: () => source.menus.value,
    route: () => ({
      // vue-router 的路由记录字段远多于面包屑需要的，这里显式取用得到的一部分，
      // 让"包只认识 meta.title / meta.icon / path"这条约束在应用侧落地。
      matched: route.matched.map((record) => ({
        meta: {
          icon: record.meta?.icon as string | undefined,
          title: record.meta?.title as string | undefined,
        },
        path: record.path,
      })),
      name: route.name,
      path: route.path,
    }),
  });

  return { breadcrumbs };
}

export type { BreadcrumbItem };

/* ============================================================
 * useShell —— 布局外壳的唯一真相
 * ============================================================ */
export interface LayoutShell {
  /** 当前形态的区域开关（顶栏/导航/图标栏/侧栏/标签页/底栏） */
  regions: LayoutRegionFlags;
  /** 当前形态的蓝图原始值，组件需要细节时直接读 */
  blueprint: ComputedRef<ReturnType<typeof getBlueprint>>;
  /** 内容区行内样式（流式 / 定宽 / 放大态） */
  contentStyle: ComputedRef<ReturnType<typeof resolveContentStyle>>;
  /** 标签页「放大当前页」 */
  maximized: ComputedRef<boolean>;
  /** 主栏在该形态下以浮层抽屉呈现（用户设置或移动端尺寸触发） */
  overlaySidebar: ComputedRef<boolean>;
  source: MenuTreeSource;
}

/**
 * 把「偏好设置 + 菜单树 + 视口」折叠成外壳真正要用的开关。
 *
 * 组件里不再出现 `layout === 'xxx'`：形态差异全部来自 `@antdv/layouts` 的蓝图表，
 * 新增一种布局只改那张表，这里和所有组件都不用动。
 */
export function useShell(): LayoutShell {
  const appStore = useAppStore();
  const tabsStore = useTabsStore();
  const source = useMenuTree();
  const mobile = useMobile();

  const mode = computed(() => appStore.layout);
  const maximized = computed(() => tabsStore.isMaximized);
  const blueprint = computed(() => getBlueprint(mode.value));

  const regions = useLayoutRegions({
    maximized,
    mode,
    source,
  });

  const contentStyle = computed(() =>
    resolveContentStyle({
      maximized: maximized.value,
      mode: appStore.contentMode,
      width: appStore.contentWidth,
    }),
  );

  /**
   * 窄屏把常驻侧栏改成浮层：
   * 手机尺寸下再占掉 210px，内容区基本没法用了。
   *
   * 蓝图那条 `=== 'drawer'` 是给"天生就该浮层"的形态留的口子；
   * 目前七种形态都是常驻（侧边导航也曾被配成抽屉，结果选中后左列空无一物，
   * 用户以为菜单没实现——见 `@antdv/layouts` 的 modes 表注释）。
   */
  const overlaySidebar = computed(
    () => blueprint.value.sidebarPresentation === 'drawer' || mobile.value,
  );

  return {
    blueprint,
    contentStyle,
    maximized,
    overlaySidebar,
    regions,
    source,
  };
}

export { LAYOUT_DRAWER_WIDTH };
