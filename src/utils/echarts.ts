/**
 * ECharts 按需加载工具（ECharts 6.x 兼容版）
 *
 * 优化策略：
 * 1. 按需引入组件（Tree-shaking 友好）
 * 2. 动态 import（不阻塞首屏）
 * 3. 单例模式（避免重复加载）
 * 4. 类型安全（完整的 TypeScript 支持）
 *
 * 注意：ECharts 6.x 的包结构与 5.x 不同！
 * - 5.x: echarts/charts/line
 * - 6.x: echarts/lib/chart/line/install
 */

// ECharts 核心类型
export interface EChartsInstance {
  init: (dom: HTMLElement, theme?: string | object) => any
  dispose: (instance: any) => void
  connect: (group: string | any[]) => void
  disconnect: (group: string) => void
  registerMap: (mapName: string, geoJSON: object, specialAreas?: object) => void
  getMap: (mapName: string) => object
}

// ECharts 库实例类型
export interface EChartsLib extends EChartsInstance {
  version: string
  graphic: {
    LinearGradient: new (
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      stops: Array<{ offset: number, color: string }>
    ) => any
  }
}

// 已加载的实例缓存
let cachedEcharts: EChartsLib | null = null
let loadPromise: Promise<EChartsLib> | null = null

/**
 * 按需加载 ECharts（带缓存）
 *
 * 只导入 Dashboard 页面实际使用的组件：
 * - 图表：LineChart, BarChart, PieChart, GaugeChart, RadarChart, HeatmapChart, FunnelChart
 * - 组件：GridComponent, TooltipComponent, LegendComponent, TitleComponent, VisualMapComponent
 * - 工具：GraphicComponent（用于渐变色）
 *
 * 注意：Canvas 渲染器已内置在 echarts/core 中，无需单独导入！
 */
export async function loadEcharts(): Promise<EChartsLib> {
  // 返回缓存的实例
  if (cachedEcharts) {
    return cachedEcharts
  }

  // 如果正在加载，返回同一个 Promise（防止重复加载）
  if (loadPromise) {
    return loadPromise
  }

  // 开始加载
  loadPromise = _loadEchartsInternal()
    .then((echarts) => {
      cachedEcharts = echarts
      return echarts
    })
    .finally(() => {
      loadPromise = null
    })

  return loadPromise
}

/**
 * 内部加载函数 — 使用 ECharts 6.x 兼容的动态导入路径
 */
async function _loadEchartsInternal(): Promise<EChartsLib> {
  // 并行加载所有需要的模块（优化加载速度）
  const [
    echartsCore,
    // 图表类型 — 使用 ECharts 6.x 正确的导入路径
    LineChart,
    BarChart,
    PieChart,
    GaugeChart,
    RadarChart,
    HeatmapChart,
    FunnelChart,
    // 组件 — ECharts 6.x 路径：lib/component/{name}/install
    GridComponent,
    TooltipComponent,
    LegendComponent,
    TitleComponent,
    VisualMapComponent,
    GraphicComponent,
    // Canvas 渲染器 — 必须单独导入并通过 install() 注册
    installCanvasRenderer,
  ] = await Promise.all([
    // 核心（包含 init 函数，但不包含渲染器）
    import('echarts/core').then(m => m.default || m),
    // 图表 — ECharts 6.x 路径：lib/chart/{type}/install
    import('echarts/lib/chart/line/install'),
    import('echarts/lib/chart/bar/install'),
    import('echarts/lib/chart/pie/install'),
    import('echarts/lib/chart/gauge/install'),
    import('echarts/lib/chart/radar/install'),
    import('echarts/lib/chart/heatmap/install'),
    import('echarts/lib/chart/funnel/install'),
    // 组件 — ECharts 6.x 路径：lib/component/{name}/install
    import('echarts/lib/component/grid/install'),
    import('echarts/lib/component/tooltip/install'),
    import('echarts/lib/component/legend/install'),
    import('echarts/lib/component/title/install'),
    import('echarts/lib/component/visualMap/install'),
    import('echarts/lib/component/graphic/install'),
    // Canvas 渲染器 — ECharts 6.x 需要显式导入并注册
    import('echarts/lib/renderer/installCanvasRenderer'),
  ])

  // 第一步：注册图表和组件
  const init = echartsCore.init
  init([
    LineChart,
    BarChart,
    PieChart,
    GaugeChart,
    RadarChart,
    HeatmapChart,
    FunnelChart,
    GridComponent,
    TooltipComponent,
    LegendComponent,
    TitleComponent,
    VisualMapComponent,
    GraphicComponent,
  ])

  // 第二步：注册 Canvas 渲染器（ECharts 6.x 要求显式注册）
  // installCanvasRenderer 接收 echarts 实例作为参数，内部调用 registerPainter('canvas', ...)
  installCanvasRenderer(init)

  console.log('[ECharts] 按需加载完成，版本:', (init as any).version)

  return init as unknown as EChartsLib
}

/**
 * 预加载 ECharts（在空闲时提前加载）
 * 用于路由预判或用户鼠标悬停菜单时触发
 */
export function preloadEcharts(): void {
  if (cachedEcharts || loadPromise)
    return

  // 使用 requestIdleCallback 在浏览器空闲时加载
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(() => {
      loadEcharts().catch(console.error)
    }, { timeout: 3000 })
  }
  else {
    // 降级方案：延迟加载
    setTimeout(() => {
      loadEcharts().catch(console.error)
    }, 2000)
  }
}

/**
 * 清除缓存（用于测试或内存管理）
 */
export function clearEchartsCache(): void {
  cachedEcharts = null
  loadPromise = null
}
