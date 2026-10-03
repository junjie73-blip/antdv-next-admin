import type { EChartsOption } from 'echarts'

import { computed, type Ref } from 'vue'

type OptionFactory<T> = (data: T, isDark: boolean) => EChartsOption

export function useChartOption<T>(data: Ref<T>, isDark: Ref<boolean>, factory: OptionFactory<T>): Ref<EChartsOption> {
  return computed(() => factory(data.value, isDark.value))
}
