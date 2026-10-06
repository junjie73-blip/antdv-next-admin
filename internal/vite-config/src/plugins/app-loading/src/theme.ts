export interface ThemeStyleOptions {
  selector: string
  important: boolean
}

/**
 * 将变量表生成 CSS 样式块
 * 使用 :root 作为默认选择器
 * 保持与用户运行时定义的同名变量的覆盖关系：
 * - 内联注入的 <style> 位于应用 CSS 之前
 * - 应用 CSS 后加载，同名变量会覆盖内联声明
 */
export function generateThemeStyle(vars: Record<string, string>, opts: ThemeStyleOptions): string {
  const entries = Object.entries(vars)
  if (entries.length === 0) return ''

  const body = entries.map(([k, v]) => `  ${k}: ${v}${opts.important ? ' !important' : ''};`).join('\n')

  return `${opts.selector} {\n${body}\n}`
}
