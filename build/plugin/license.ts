import type { Plugin } from 'vite'
import { join } from 'node:path'

interface LicenseOptions {
  version?: string
  description?: string
  name?: string
}

export async function viteLicensePlugin(
  root = process.cwd(),
): Promise<Plugin> {
  const packageJson = await import(join(root, 'package.json'))
  const { version = '', description = '', name = '' } = packageJson as LicenseOptions

  const copyrightText = `/*!
 * ${name}
 * v${version}
 * ${description}
 * Licensed under MIT
 * Build time: ${new Date().toISOString()}
 */\n`

  return {
    name: 'vite:license',
    enforce: 'post',
    apply: 'build',
    generateBundle(_options, bundle) {
      for (const [, fileContent] of Object.entries(bundle)) {
        if (fileContent.type === 'chunk' && fileContent.isEntry) {
          fileContent.code = copyrightText + fileContent.code
        }
      }
    },
  }
}
