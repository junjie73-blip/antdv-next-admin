import { onMounted, onUnmounted } from 'vue';

/**
 * 大屏自适应 Hook。
 *
 * 把设计稿（默认 1920x1080）等比缩放到**它实际拿到的那块区域**并居中。
 *
 * 关键口径：量的是**内容区**，不是 `window`。
 * 大屏不是单独打开的页面，它是管理后台内容区里的一页 —— 外面还有侧栏、标签页、
 * 面包屑和布局的内边距。以前按 `window.innerWidth/innerHeight` 算，1440 的视口下
 * scale=0.75、缩完正好 1440 宽，可内容区实际只有约 1210 宽，于是右侧
 * 「资源使用率 / 地区用户分布」整列被裁在视口外，还多出一条横向滚动条。
 *
 * 另一件必须一起处理的事：`transform: scale()` **不改变布局占位**。
 * `#screen-content` 的布局盒子始终是 1920x1080，所以外层必须有一个尺寸确定、
 * 且 `overflow: hidden` 的容器把它多余的部分裁掉，否则内容区会被撑出滚动条 ——
 * 这正是页面原来写 `h-screen w-screen` 的原因（用视口尺寸硬撑，代价就是溢出后台外壳）。
 * 现在改成：容器宽度走 `w-full`（块级布局下是确定值），高度由这里显式量出来再写死，
 * `#screen-container` 作为 `<Scrollbar>` 自带 `overflow-hidden`，裁掉未缩放的溢出盒子。
 *
 * 监听同理不能只挂 `window.resize`：侧栏折叠、标签页最大化、页脚/面包屑开关
 * 都只改内容区尺寸、不动视口。所以观察的是**外层滚动盒**（`<Scrollbar>` 的 wrap，
 * 它的高度由外壳 flex 布局确定），`window.resize` 只作兜底。
 */
export function useScreenAdapter(
  designWidth = 1920,
  designHeight = 1080,
  containerId = 'screen-container',
  contentId = 'screen-content',
) {
  let observer: null | ResizeObserver = null;
  let watched: HTMLElement | null = null;

  /**
   * 这块区域到底有多大。
   *
   * 宽度问容器自己（`w-full`，块级布局给的是确定值）；高度问外层滚动盒 ——
   * 容器的父级链上是 `height: auto` 的滚动内容容器，量不到"可见高度"，
   * 只有滚动盒（`.scrollbar__wrap`）的 `clientHeight` 是外壳布局算出来的确定值。
   * 再减掉布局挂在 view 上的那份内边距（见 `layouts/index.vue` 的 `view-class="p-4"`）。
   */
  function measure(container: HTMLElement) {
    const wrap = container.closest('.scrollbar__wrap') as HTMLElement | null;
    const view = container.closest('.scrollbar__view') as HTMLElement | null;
    const style = view ? getComputedStyle(view) : null;
    const padY = style
      ? Number.parseFloat(style.paddingTop) +
        Number.parseFloat(style.paddingBottom)
      : 0;
    const height = wrap ? wrap.clientHeight - padY : window.innerHeight;
    return { height: Math.max(0, height), width: container.clientWidth };
  }

  function adapt() {
    const container = document.querySelector(`#${containerId}`);
    const contentEl = document.querySelector(`#${contentId}`);
    if (!container || !contentEl) return;

    const { height, width } = measure(container);
    // 首帧还没布局好（0x0）时不做缩放，等观察器下一次回调再来
    if (width <= 0 || height <= 0) return;

    // 容器高度要写死，外层滚动盒才知道"这页就这么高"，不会被 1080 的布局盒子撑出滚动
    container.style.height = `${height}px`;

    // 取较小值保证内容完整显示，不溢出
    const scale = Math.min(width / designWidth, height / designHeight);
    const scaledWidth = designWidth * scale;
    const scaledHeight = designHeight * scale;

    contentEl.style.transform = `scale(${scale})`;
    contentEl.style.transformOrigin = 'left top';
    contentEl.style.width = `${designWidth}px`;
    contentEl.style.height = `${designHeight}px`;
    // 在容器里水平和垂直居中，避免单侧大片留白
    contentEl.style.marginLeft = `${Math.max(0, (width - scaledWidth) / 2)}px`;
    contentEl.style.marginTop = `${Math.max(0, (height - scaledHeight) / 2)}px`;
  }

  onMounted(() => {
    adapt();
    const container = document.querySelector(`#${containerId}`);
    watched = container?.closest('.scrollbar__wrap') ?? null;
    if (container && watched && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(adapt);
      observer.observe(watched);
    }
    window.addEventListener('resize', adapt);
  });

  onUnmounted(() => {
    window.removeEventListener('resize', adapt);
    observer?.disconnect();
    observer = null;
    watched = null;
    // 清理缩放样式，避免污染其他页面
    const container = document.querySelector(`#${containerId}`);
    if (container) container.style.height = '';
    const contentEl = document.querySelector(`#${contentId}`);
    if (contentEl) {
      contentEl.style.transform = '';
      contentEl.style.transformOrigin = '';
      contentEl.style.width = '';
      contentEl.style.height = '';
      contentEl.style.marginLeft = '';
      contentEl.style.marginTop = '';
    }
  });

  return { adapt };
}
