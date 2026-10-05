import { readFileSync, existsSync } from 'node:fs'
import postcss from 'postcss'
import { glob } from 'tinyglobby'

export interface CssVariableScanOptions {
  root: string
  sources: string[]
  prefix?: string
  exclude?: RegExp[]
}

/**
 * 从项目中扫描 CSS 变量
 */
export async function scanCssVariables(opts: CssVariableScanOptions): Promise<Record<string, string>> {
  const files = await glob(opts.sources, {
    cwd: opts.root,
    absolute: true,
    ignore: ['**/node_modules/**', '**/dist/**', '**/*.min.css'],
  })

  const result: Record<string, string> = {}
  for (const file of files) {
    if (!existsSync(file)) continue
    const content = readFileSync(file, 'utf-8')
    const vars = parseCssVariables(content)
    for (const [k, v] of Object.entries(vars)) {
      if (opts.prefix && !k.startsWith(opts.prefix)) continue
      if (opts.exclude?.some((re) => re.test(k))) continue
      result[k] = v
    }
  }
  return result
}

/**
 * 解析单个 CSS 文件中的 CSS 变量声明
 * - 使用 postcss 保证解析健壮（处理注释、嵌套、url() 等）
 * - 解析失败时回退到正则
 */
function parseCssVariables(css: string): Record<string, string> {
  try {
    const root = postcss.parse(css)
    const vars: Record<string, string> = {}
    root.walkDecls((decl) => {
      if (decl.prop.startsWith('--')) {
        vars[decl.prop] = decl.value
      }
    })
    return vars
  } catch {
    // 回退到正则，兼容 SCSS/LESS 原始文本
    const vars: Record<string, string> = {}
    const regex = /(--[\w-]+)\s*:\s*([^;}\n]+?)\s*(?:;|(?=}))/g
    let match: RegExpExecArray | null
    while ((match = regex.exec(css)) !== null) {
      vars[match[1]] = match[2].trim()
    }
    return vars
  }
}
