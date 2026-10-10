import { escapeHtml } from '@antdv/shared/xss';
import { message } from 'antdv-next';

/**
 * 调用方传入的样式片段会被原样塞进 `<style>` 里。
 * 只要把 `</style>` 转义掉就足够——正文仍是 CSS，不能整体 HTML 转义，
 * 否则 `>` 之类选择器字符会被写坏。
 */
function sanitizeCssText(styles?: string): string {
  if (!styles) return '';
  return styles.replaceAll(/<\/style/gi, '&lt;/style');
}

export interface PrintOptions {
  /** 打印标题 */
  title?: string;
  /** 要打印的 DOM 元素或选择器 */
  target: HTMLElement | string;
  /** 打印前回调（用于隐藏不需要打印的元素） */
  onBeforePrint?: () => void;
  /** 打印后回调（用于恢复隐藏的元素） */
  onAfterPrint?: () => void;
  /** 是否显示页眉（标题），默认 true */
  showHeader?: boolean;
  /**
   * 是否显示页脚（打印时间），默认 true。
   * 不做「第 X 页 / 共 Y 页」：页码只有浏览器打印引擎知道，
   * 文档里静态写死的数字必然是错的，真需要页码请在打印对话框里勾选页眉页脚。
   */
  showFooter?: boolean;
  /** 样式覆盖 */
  styles?: string;
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
  } = options;

  // 获取目标元素
  const el =
    typeof target === 'string' ? document.querySelector(target) : target;

  if (!el) {
    message.error('未找到打印目标元素');
    return;
  }

  // 执行打印前回调
  onBeforePrint?.();

  // 创建打印框架
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  iframe.style.left = '-9999px';
  document.body.append(iframe);

  /** 从页面移除打印 iframe；重复调用安全 */
  const removeIframe = () => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  };

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    removeIframe();
    message.error('创建打印窗口失败');
    return;
  }

  // 构建打印内容
  const printContent = el.innerHTML;

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
  `;

  const printDate = new Date().toLocaleString();

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>${defaultStyles} ${sanitizeCssText(styles)}</style>
      </head>
      <body>
        ${
          showHeader
            ? `<div class="print-header"><h1>${escapeHtml(title)}</h1></div>`
            : ''
        }
        <div class="print-content">${printContent}</div>
        ${
          showFooter
            ? `<div class="print-footer">打印时间：${escapeHtml(printDate)}</div>`
            : ''
        }
      </body>
    </html>
  `);
  doc.close();

  // 等待内容渲染完成后触发打印
  const contentWindow = iframe.contentWindow;
  if (!contentWindow) {
    removeIframe();
    message.error('创建打印窗口失败');
    return;
  }

  /**
   * 打印结束（确认或取消）后的收尾。
   * 必须幂等：`onload` 的兜底定时器和 `afterprint` 事件在同一次打印里都会到达，
   * 早期实现让 onAfterPrint 跑了两次，调用方「恢复被隐藏的按钮」这类回调就重复执行；
   * 而且第二次 removeChild 会因为节点已经不在 body 上而抛 NotFoundError。
   */
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    removeIframe();
    onAfterPrint?.();
  };

  contentWindow.onload = () => {
    contentWindow.focus();
    contentWindow.print();
    // 兜底：部分浏览器不触发 afterprint
    setTimeout(finish, 1000);
  };

  contentWindow.addEventListener('afterprint', () => {
    setTimeout(finish, 100);
  });
}
