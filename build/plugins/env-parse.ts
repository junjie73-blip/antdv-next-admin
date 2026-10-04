import { envParse } from 'vite-plugin-env-parse'

export function createEnvParsePlugin(): PluginOption {
  return envParse({
    dtsPath: join(process.cwd(), 'types/env.d.ts'),
    parseJson: true,
    exclude: ['VITE_APP_TITLE'],
  })
}
