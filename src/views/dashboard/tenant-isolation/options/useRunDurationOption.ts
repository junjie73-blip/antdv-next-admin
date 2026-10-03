import type { EChartsOption } from 'echarts'

import { PALETTE } from '~/composables/echarts/constants'
import { subTextColor, borderColor, gradient } from '~/composables/echarts/theme'

import type { IsolationRun } from '../api'

export function useRunDurationOption(data: Ref<IsolationRun[]>, isDark: Ref<boolean>): Ref<EChartsOption> {
  return computed<EChartsOption>(() => {
    // recent-runs 通常按时间倒序，画图时正序
    const runs = [...data.value].reverse()

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const p = params[0]
          const run = runs[p.dataIndex]
          return [
            `<b>${p.name}</b>`,
            `触发：${run?.trigger_type ?? '—'}`,
            `耗时：<b>${p.value}s</b>`,
            `Critical：${run?.critical_count ?? 0}`,
            `Warning：${run?.warning_count ?? 0}`,
          ].join('<br/>')
        },
      },
      grid: { left: 40, right: 20, top: 30, bottom: 30 },
      xAxis: {
        type: 'category',
        data: runs.map((r) => new Date(r.started_at).toISOString().slice(5, 16).replace('T', ' ')),
        axisLabel: { color: subTextColor(isDark.value), fontSize: 9, rotate: 30 },
        axisLine: { lineStyle: { color: borderColor(isDark.value) } },
      },
      yAxis: {
        type: 'value',
        name: '耗时(s)',
        nameTextStyle: { color: subTextColor(isDark.value), fontSize: 10 },
        axisLabel: { color: subTextColor(isDark.value), fontSize: 10 },
        splitLine: {
          lineStyle: {
            color: borderColor(isDark.value),
            type: 'dashed',
            opacity: 0.4,
          },
        },
      },
      series: [
        {
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          data: runs.map((r) => (r.duration_ms != null ? +(r.duration_ms / 1000).toFixed(2) : 0)),
          lineStyle: { color: PALETTE.primary, width: 2 },
          itemStyle: { color: PALETTE.primary },
          areaStyle: {
            color: gradient(['rgba(22,119,255,0.18)', 'rgba(22,119,255,0.01)']),
          },
        },
      ],
      animationDuration: 1000,
    }
  })
}
