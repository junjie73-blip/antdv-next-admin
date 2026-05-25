import type { Ref } from 'vue'
import type {
  BasicTableProps,
  TableActionType,
} from './types'
import { ref } from 'vue'

/**
 * useTable Hook
 * 为什么需要：提供命令式调用表格方法的能力，支持在组件外部控制表格
 *
 * 使用方式：
 * const [register, methods] = useTable({
 *   api: fetchApi,
 *   columns: [...],
 * })
 *
 * // 在模板中使用
 * <BasicTable @register="register" />
 *
 * // 调用方法
 * methods.reload()
 * methods.setColumns([...])
 */
export function useTable(props?: Partial<BasicTableProps>): [(instance: TableActionType) => void, Ref<TableActionType | null>] {
  // 表格实例引用
  const tableRef = ref<TableActionType | null>(null)

  // 注册方法
  function register(instance: TableActionType) {
    tableRef.value = instance

    // 如果传入了初始 props，设置到表格实例
    if (props) {
      instance.setProps(props)
    }
  }

  return [register, tableRef]
}
