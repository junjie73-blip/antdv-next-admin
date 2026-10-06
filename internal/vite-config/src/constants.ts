import { join } from 'node:path'

export const ROOT_DIR = process.cwd()
export const SRC_DIR = join(ROOT_DIR, 'src')
export const TYPES_DIR = join(ROOT_DIR, 'types')
export const DIST_DIR = join(ROOT_DIR, 'dist')

export const DEFAULT_PORT = 5173
export const APP_TITLE = 'Antdv Next Admin'
