/**
 * v-log-click 指令 — 自动记录按钮点击操作日志
 *
 * 使用方式：
 * <button v-log-click="'保存用户'">保存</button>
 * <button v-log-click:submit="'提交表单'">提交</button>
 * <button v-log-click:delete="'删除记录'">删除</button>
 *
 * 支持的操作类型修饰符：
 * - 默认: click
 * - :submit, :edit, :create, :delete, :search, :export, :import, :download, :upload
 */

import type { Directive, DirectiveBinding } from 'vue'
import { useLogger } from '@/composables/useLogger'

/** 支持的修饰符到操作类型的映射 */
const MODIFIER_MAP: Record<string, string> = {
  submit: 'submit',
  edit: 'edit',
  create: 'create',
  delete: 'delete',
  search: 'search',
  export: 'export',
  import: 'import',
  download: 'download',
  upload: 'upload',
  login: 'login',
  logout: 'logout',
  navigate: 'navigate',
}

export const vLogClick: Directive<HTMLElement, string> = {
  mounted(el: HTMLElement, binding: DirectiveBinding<string>) {
    const description = binding.value || el.textContent?.trim() || '未知操作'
    // 从修饰符获取操作类型，默认为 click
    const operationType = (Object.keys(binding.modifiers).find(m => MODIFIER_MAP[m]) && Object.keys(binding.modifiers).find(m => MODIFIER_MAP[m])) || (binding.arg && MODIFIER_MAP[binding.arg]) || 'click'

    el.addEventListener('click', () => {
      const logger = useLogger()
      logger.logOperation(operationType as any, description)
    })
  },
}
