import type { PluginOption } from 'vite'
import { createWriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import archiver from 'archiver'

async function zipFolder(
  folderPath: string,
  outputPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath)
    const archive = archiver('zip', {
      zlib: { level: 9 },
    })

    output.on('close', () => {
      console.log(
        `ZIP file created: ${outputPath} (${archive.pointer()} total bytes)`,
      )
      resolve()
    })

    archive.on('error', err => reject(err))
    archive.pipe(output)
    archive.directory(folderPath, false)
    archive.finalize()
  })
}

export function viteArchiverPlugin(
  options: Record<string, string>,
): PluginOption {
  return {
    name: 'vite:archiver',
    apply: 'build',
    enforce: 'post',
    closeBundle: {
      order: 'post',
      handler() {
        setTimeout(async () => {
          const { name = 'dist', outputDir = '.' } = options
          const zipOutputDir = join(process.cwd(), outputDir)
          const zipOutputPath = join(zipOutputDir, `${name}.zip`)

          try {
            await mkdir(zipOutputDir, { recursive: true })
            await zipFolder('dist', zipOutputPath)
            console.log(`✨ Folder has been zipped to: ${zipOutputPath}`)
          }
          catch (error) {
            console.error('Error zipping folder:', error)
          }
        }, 0)
      },
    },
  }
}
