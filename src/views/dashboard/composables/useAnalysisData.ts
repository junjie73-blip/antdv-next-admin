import { ref, shallowRef, type Ref } from 'vue'

export interface UseAnalysisDataReturn<T> {
  data: Ref<T>
  loading: Ref<boolean>
  error: Ref<unknown>
  refresh: () => Promise<void>
}

export function useAnalysisData<T>(loader: () => Promise<T>, initial: T): UseAnalysisDataReturn<T> {
  const data = shallowRef<T>(initial)
  const loading = ref(false)
  const error = ref<unknown>(null)

  async function refresh() {
    loading.value = true
    error.value = null
    try {
      data.value = await loader()
    } catch (e) {
      error.value = e
      console.warn('[dashboard] load failed', e)
    } finally {
      loading.value = false
    }
  }

  return { data, loading, error, refresh }
}
