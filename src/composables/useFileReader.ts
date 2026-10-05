import { ref, readonly } from 'vue'

export function useFileReader() {
  const result = ref<string | ArrayBuffer | null>(null)
  const isLoading = ref(false)
  const error = ref<Error | null>(null)

  /**
   * 读取文件内容
   * @param file - 要读取的 File 对象
   * @param readAs - 读取方式，默认 'readAsDataURL'（适合图片预览）
   * @returns Promise<string | ArrayBuffer> - 读取结果
   */
  const read = (file: File, readAs: 'readAsDataURL' | 'readAsText' | 'readAsArrayBuffer' = 'readAsDataURL') => {
    return new Promise<string | ArrayBuffer>((resolve, reject) => {
      isLoading.value = true
      error.value = null

      const reader = new FileReader()

      reader.onload = (e) => {
        const content = e.target?.result ?? null
        result.value = content
        isLoading.value = false
        resolve(content as string | ArrayBuffer)
      }

      reader.onerror = () => {
        const err = new Error('文件读取失败')
        error.value = err
        isLoading.value = false
        reject(err)
      }

      reader[readAs](file)
    })
  }

  const reset = () => {
    result.value = null
    error.value = null
    isLoading.value = false
  }

  return {
    result: readonly(result),
    isLoading: readonly(isLoading),
    error: readonly(error),
    read,
    reset,
  }
}
