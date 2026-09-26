import { defineStore } from 'pinia'
import { ref } from 'vue'

import { getTenantOptions } from '~/api'

/** 租户下拉选项 */
export interface TenantOption {
  tenantId: string
  tenantCode: string
  tenantName: string
}

export const useTenantStore = defineStore('tenant', () => {
  const options = ref<TenantOption[]>([])
  const loading = ref(false)

  /**
   * 加载租户下拉选项
   * @param force 是否忽略已有数据强制重新拉取
   */
  async function load(force = false) {
    if (loading.value || (!force && options.value.length > 0)) return
    loading.value = true
    try {
      options.value = await getTenantOptions()
    } finally {
      loading.value = false
    }
  }

  return { options, loading, load }
})
