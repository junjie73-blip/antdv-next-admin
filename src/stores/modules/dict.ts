import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getDictList } from '@/api/system'
import { CacheKey } from '@/enums/cache'
import { localStorageCacheStorage } from '@/utils/cache'

/** 单个字典项 */
export interface DictItem {
  id: number
  dictLabel: string
  dictValue: string | number
  cssClass?: string
  sort: number
  status: number
}

/** 字典类型（包含其所有项） */
export interface DictType {
  id: number
  typeName: string
  typeCode: string
  status: number
  items: DictItem[]
}

/** 存储中的字典数据格式 */
interface StoredDictData {
  dicts: Record<string, DictItem[]>
  loadedAt: number
}

function loadFromStorage(): Record<string, DictItem[]> {
  try {
    const raw = localStorageCacheStorage.getItem(CacheKey.DICT_DATA)
    if (!raw)
      return {}
    const data: StoredDictData = JSON.parse(raw)
    // 数据超过1小时视为过期
    if (Date.now() - data.loadedAt > 3600 * 1000)
      return {}
    return data.dicts
  }
  catch {
    return {}
  }
}

function saveToStorage(dicts: Record<string, DictItem[]>) {
  try {
    const data: StoredDictData = { dicts, loadedAt: Date.now() }
    localStorageCacheStorage.setItem(CacheKey.DICT_DATA, JSON.stringify(data))
  }
  catch {
    // 静默失败
  }
}

export const useDictStore = defineStore('dict', () => {
  const dictMap = ref<Record<string, DictItem[]>>(loadFromStorage())
  const loading = ref(false)

  /** 是否已加载 */
  const isLoaded = computed(() => Object.keys(dictMap.value).length > 0)

  /**
   * 从服务端获取所有字典数据并缓存到内存和 localStorage
   */
  async function fetchAllDicts() {
    if (loading.value)
      return
    loading.value = true
    try {
      const res = await getDictList({})
      const data = res?.data ?? res
      const list: DictType[] = data?.list || []

      const map: Record<string, DictItem[]> = {}
      for (const dict of list) {
        if (dict.status === 1 && dict.items) {
          map[dict.typeCode] = dict.items
            .filter(item => item.status === 1)
            .sort((a, b) => a.sort - b.sort)
        }
      }

      dictMap.value = map
      saveToStorage(map)
    }
    catch (e) {
      console.error('[Dict] 加载字典数据失败', e)
    }
    finally {
      loading.value = false
    }
  }

  /**
   * 根据 typeCode 获取下拉选项（label/value 格式）
   * @param typeCode 字典编码，如 'sys_user_sex'
   * @returns 下拉选项数组，格式为 [{ label, value }, ...]
   */
  function getOptions(typeCode: string): { label: string, value: string | number }[] {
    const items = dictMap.value[typeCode] || []
    return items.map(item => ({
      label: item.dictLabel,
      value: item.dictValue,
    }))
  }

  /**
   * 根据 typeCode 和 value 获取显示标签
   * @param typeCode 字典编码
   * @param value 字典值
   * @returns 显示文本，未找到返回原值
   */
  function getLabel(typeCode: string, value: string | number): string {
    const items = dictMap.value[typeCode] || []
    const found = items.find(item =>
      String(item.dictValue) === String(value),
    )
    return found?.dictLabel ?? String(value)
  }

  /**
   * 刷新指定字典（单个字典更新）
   */
  async function refreshDict(_typeCode: string) {
    // 暂时通过重新加载全部实现；后续可优化为单条刷新
    await fetchAllDicts()
  }

  /**
   * 清空字典缓存（登出时调用）
   */
  function clearDict() {
    dictMap.value = {}
    localStorageCacheStorage.removeItem(CacheKey.DICT_DATA)
  }

  return {
    dictMap,
    loading,
    isLoaded,
    fetchAllDicts,
    getOptions,
    getLabel,
    refreshDict,
    clearDict,
  }
})
