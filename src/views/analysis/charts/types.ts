import type { Ref } from 'vue'

/** 图表初始化共享上下文 */
export interface ChartContext {
  isDark: boolean
  /** 图表主趋势图当前选择的时间范围 */
  range?: string
  /** 主题状态 ref（用于给需要订阅主题变化的图表） */
  isDarkRef?: Ref<boolean>
}

/** 图表清理器 */
export type ChartCleanup = () => void

/** 图表初始化结果 */
export interface ChartInitResult {
  cleanup?: ChartCleanup
}
