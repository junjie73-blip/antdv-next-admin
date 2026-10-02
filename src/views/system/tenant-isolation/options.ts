import type { EChartsOption } from 'echarts'

import * as echarts from 'echarts'

import type { IsolationTrend, RuleDistribution, TableHeat } from './types'

import { SEVERITY_COLOR_MAP } from './constants'

export function buildTrendOption(t: IsolationTrend): EChartsOption {
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['新增', '修复', 'Critical', 'Warning'], top: 0 },
    grid: { left: 40, right: 20, top: 40, bottom: 30, containLabel: true },
    xAxis: {
      type: 'category',
      data: t.dates.map((d) => d.slice(5)),
      boundaryGap: false,
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { type: 'dashed', color: '#e5e7eb' } },
    },
    series: [
      {
        name: '新增',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        data: t.newCounts,
        itemStyle: { color: '#ef4444' },
        lineStyle: { width: 2 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(239,68,68,0.25)' },
            { offset: 1, color: 'rgba(239,68,68,0.02)' },
          ]),
        },
      },
      {
        name: '修复',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        data: t.resolvedCounts,
        itemStyle: { color: '#10b981' },
        lineStyle: { width: 2 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(16,185,129,0.25)' },
            { offset: 1, color: 'rgba(16,185,129,0.02)' },
          ]),
        },
      },
      {
        name: 'Critical',
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: t.criticalSeries,
        itemStyle: { color: '#dc2626' },
        lineStyle: { width: 1.5, type: 'dashed' },
      },
      {
        name: 'Warning',
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: t.warningSeries,
        itemStyle: { color: '#f59e0b' },
        lineStyle: { width: 1.5, type: 'dashed' },
      },
    ],
  }
}

export function buildPieOption(list: RuleDistribution[]): EChartsOption {
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, type: 'scroll' },
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
        data: list.map((r) => ({
          name: r.ruleCode,
          value: r.count,
          itemStyle: { color: SEVERITY_COLOR_MAP[r.severity] ?? '#6b7280' },
        })),
      },
    ],
  }
}

export function buildBarOption(list: TableHeat[]): EChartsOption {
  const reversed = [...list].reverse()
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 20, right: 40, top: 10, bottom: 20, containLabel: true },
    xAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed' } } },
    yAxis: {
      type: 'category',
      data: reversed.map((h) => h.tableName),
      axisLabel: { fontSize: 11 },
    },
    series: [
      {
        type: 'bar',
        data: reversed.map((h) => h.issueCount),
        itemStyle: {
          borderRadius: [0, 4, 4, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#93c5fd' },
            { offset: 1, color: '#3b82f6' },
          ]),
        },
        barMaxWidth: 20,
        label: { show: true, position: 'right', fontSize: 11 },
      },
    ],
  }
}
