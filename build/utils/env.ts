import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

function findConfigFile(confFile: string) {
  const filePath = join(process.cwd(), confFile)
  if (existsSync(filePath)) {
    return filePath
  }
  return null
}

function getConfFiles() {
  const mode
    = process.env.NODE_ENV
      || process.env.npm_lifecycle_script?.match(/--mode ([\d_a-z]+)/)?.[1]
      || 'production'
  return ['.env', `.env.${mode}`]
}

function parseValue(value: string): string | number | boolean {
  const trimmed = value.trim()

  if (trimmed === 'true' || trimmed === 'false') {
    return trimmed === 'true'
  }

  if (/^\d+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10)
  }

  if (/^\d+\.\d+$/.test(trimmed)) {
    return Number.parseFloat(trimmed)
  }

  return trimmed
}

export function loadEnv(): Record<string, any> {
  const env: Record<string, any> = {}
  const confFiles = getConfFiles()

  for (const confFile of confFiles) {
    try {
      const filePath = findConfigFile(confFile)
      if (filePath) {
        const content = readFileSync(filePath, 'utf-8')
        const lines = content.split('\n')

        for (const line of lines) {
          const trimmedLine = line.trim()
          if (!trimmedLine || trimmedLine.startsWith('#')) {
            continue
          }

          const [key, ...valueParts] = trimmedLine.split('=')
          const rawKey = key?.trim()
          const rawValue = valueParts.join('=').trim()

          if (rawKey && rawValue) {
            env[rawKey] = parseValue(rawValue)
          }
        }
      }
    }
    catch (error) {
      console.warn(`Failed to load env file: ${confFile}`, error)
    }
  }

  return env
}

export type AppEnv = ReturnType<typeof loadEnv>
