import type { Ref } from 'vue'

import { message } from 'antdv-next'

import { CHART_EXPORT_CONFIG } from '../constants'

interface ExportOptions {
  isDark: Ref<boolean>
  getChart: (name: string) => any
  chartCount: number
}

/**
 * 导出图表报告
 * 逐张渲染 ECharts 图表到 canvas，然后拼成一张大图
 */
export function useExportReport(options: ExportOptions) {
  const { isDark, getChart } = options

  function handleExport() {
    if (getChart('mainTrend') === undefined && getChart('trafficDist') === undefined) {
      message.warning('图表尚未加载完成，请稍后再试')
      return
    }

    const padding = 40
    const chartGap = 30
    const labelHeight = 36
    const headerHeight = 100

    let totalHeight = padding + headerHeight + padding
    for (const item of CHART_EXPORT_CONFIG) {
      totalHeight += labelHeight + chartGap
      const instance = getChart(item.key)
      if (instance) {
        const el = instance.getDom()
        totalHeight += Math.max(Number(el.offsetHeight) || 400, 400)
      } else {
        totalHeight += 400
      }
    }
    totalHeight += padding

    const canvas = document.createElement('canvas')
    canvas.width = 1400
    canvas.height = totalHeight * 2
    const ctx = canvas.getContext('2d')!
    ctx.scale(2, 2)

    ctx.fillStyle = isDark.value ? '#111827' : '#ffffff'
    ctx.fillRect(0, 0, canvas.width / 2, totalHeight)

    // 标题
    ctx.fillStyle = isDark.value ? '#f9fafb' : '#111827'
    ctx.font = 'bold 28px -apple-system, "SF Pro Text", sans-serif'
    ctx.fillText('数据可视化报告', padding, padding + 32)

    ctx.fillStyle = isDark.value ? '#9ca3af' : '#6b7280'
    ctx.font = '14px -apple-system, "SF Pro Text", sans-serif'
    ctx.fillText(`生成时间：${new Date().toLocaleString('zh-CN')}`, padding, padding + 58)

    ctx.fillStyle = isDark.value ? '#374151' : '#e5e7eb'
    ctx.fillRect(padding, padding + 70, canvas.width / 2 - padding * 2, 1)

    let offsetY = padding + headerHeight + padding
    let doneCount = 0

    function checkAllDone() {
      doneCount++
      if (doneCount >= CHART_EXPORT_CONFIG.length) triggerDownload()
    }

    function triggerDownload() {
      const link = document.createElement('a')
      link.download = `数据可视化报告_${new Date().toISOString().slice(0, 10)}.png`
      link.href = canvas.toDataURL('image/png', 1.0)
      link.click()
      message.success('报告导出成功！')
    }

    for (const item of CHART_EXPORT_CONFIG) {
      // 绘制图表标题
      ctx.fillStyle = isDark.value ? '#d1d5db' : '#374151'
      ctx.font = 'bold 16px -apple-system, "SF Pro Text", sans-serif'
      ctx.fillText(item.name, padding, offsetY + 24)
      offsetY += labelHeight

      const instance = getChart(item.key)
      if (instance) {
        try {
          const dataUrl = instance.getDataURL({
            type: 'png',
            pixelRatio: 2,
            backgroundColor: isDark.value ? '#1f2937' : '#ffffff',
          })
          const img = new Image()
          img.onload = () => {
            const ratio = (canvas.width / 2 - padding * 2) / img.width
            const drawH = img.height * ratio
            ctx.drawImage(img, padding, offsetY, canvas.width / 2 - padding * 2, drawH)
            offsetY += drawH + chartGap
            checkAllDone()
          }
          img.onerror = () => {
            offsetY += 300 + chartGap
            checkAllDone()
          }
          img.src = dataUrl
        } catch {
          offsetY += 300 + chartGap
          checkAllDone()
        }
      } else {
        offsetY += 300 + chartGap
        checkAllDone()
      }
    }
  }

  return { handleExport }
}
