import { message } from 'antdv-next'

export interface PrintOptions {
  /** 打印标题 */
  title?: string
  /** 要打印的 DOM 元素或选择器 */
  target: string | HTMLElement
  /** 打印前回调（用于隐藏不需要打印的元素） */
  onBeforePrint?: () => void
  /** 打印后回调（用于恢复隐藏的元素） */
  onAfterPrint?: () => void
  /** 是否显示页眉，默认 true */
  showHeader?: boolean
  /** 是否显示页脚（日期），默认 true */
  showFooter?: boolean
  /** 样式覆盖 */
  styles?: string
}

/**
 * 浏览器打印功能
 *
 * @example
 * ```ts
 * // 打印指定区域
 * usePrint({
 *   title: '用户列表',
 *   target: '#print-table',
 * })
 * ```
 */
export function usePrint(options: PrintOptions) {
  const {
    title = document.title,
    target,
    onBeforePrint,
    onAfterPrint,
    showHeader = true,
    showFooter = true,
    styles,
  } = options

  // 获取目标元素
  let el: HTMLElement | null = null
  if (typeof target === 'string') {
    el = document.querySelector(target)
  }
  else {
    el = target
  }

  if (!el) {
    message.error('未找到打印目标元素')
    return
  }

  // 执行打印前回调
  onBeforePrint?.()

  // 创建打印框架
  const iframe = document.createElement('iframe')
  iframe.style.position = 'absolute'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = 'none'
  iframe.style.left = '-9999px'
  document.body.appendChild(iframe)

  const doc = iframe.contentWindow?.document
  if (!doc) {
    document.body.removeChild(iframe)
    message.error('创建打印窗口失败')
    return
  }

  // 构建打印内容
  const printContent = el.innerHTML

  // 默认打印样式
  const defaultStyles = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 12px; color: #333; line-height: 1.5; padding: 20px; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background-color: #f5f5f5; font-weight: 600; }
    tr:nth-child(even) { background-color: #fafafa; }
    .no-print { display: none !important; }
    .print-header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
    .print-header h1 { font-size: 18px; margin-bottom: 5px; }
    .print-header p { font-size: 12px; color: #666; }
    .print-footer { text-align: right; margin-top: 20px; font-size: 10px; color: #999; border-top: 1px solid #ddd; padding-top: 10px; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  `

  doc.open()
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>${defaultStyles} ${styles || ''}</style>
      </head>
      <body>
        ${showHeader ? `<div class="print-header"><h1>${title}</h1><p>打印时间：${new Date().toLocaleString()}</p></div>` : ''}
        <div class="print-content">${printContent}</div>
        ${showFooter ? '<div class="print-footer">第 &nbsp;/&nbsp; 页</div>' : ''}
      </body>
    </html>
  `)
  doc.close()

  // 等待内容渲染完成后触发打印
  const contentWindow = iframe.contentWindow
  if (contentWindow) {
    contentWindow.onload = () => {
      contentWindow.focus()
      contentWindow.print()

      // 清理
      setTimeout(() => {
        document.body.removeChild(iframe)
        onAfterPrint?.()
      }, 1000)
    }

    // 处理取消打印的情况
    contentWindow.addEventListener('afterprint', () => {
      setTimeout(() => {
        if (iframe.parentNode) {
          document.body.removeChild(iframe)
        }
        onAfterPrint?.()
      }, 100)
    })
  }
}
