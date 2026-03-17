import type { ConfigEnv } from 'vite'
import { defineConfig } from 'vite'
import { userConfig } from './build/config'

export default defineConfig(async (conf: ConfigEnv) => {
  return await userConfig(conf)
})
