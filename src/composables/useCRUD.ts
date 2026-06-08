/**
 * useCRUD - 通用 CRUD 操作 composable
 *
 * 封装增删改查的通用逻辑，减少系统管理页面的重复代码。
 * 提供统一的：
 * - 状态管理（编辑模式、当前记录）
 * - 弹窗控制（打开/关闭）
 * - 表单处理（验证、提交）
 * - 成功/失败提示
 *
 * 使用示例：
 * ```typescript
 * const {
 *   isEditing,
 *   currentRecord,
 *   handleAdd,
 *   handleEdit,
 *   handleDelete,
 *   handleSave,
 * } = useCRUD<UserRecord>({
 *   modalMethods,
 *   formMethods,
 *   tableMethods,
 *   onCreate: (values) => api.addUser(values),
 *   onUpdate: (id, values) => api.updateUser(id, values),
 *   onDelete: (record) => api.deleteUser(record.id),
 *   getFormValues: (record) => ({ ...record }),
 *   getEmptyValues: () => ({ username: '', status: 1 }),
 *   messages: {
 *     createSuccess: '用户创建成功',
 *     updateSuccess: '用户更新成功',
 *     deleteSuccess: '用户删除成功',
 *     deleteConfirm: '确定要删除该用户吗？',
 *   },
 * })
 * ```
 */

import type { FormInstanceMethods, ModalInstanceMethods, TableInstanceMethods } from '@/components/business'
import { ref } from 'vue'

interface CRUDMessages {
  createSuccess?: string
  updateSuccess?: string
  deleteSuccess?: string
  deleteConfirm?: string
  saveFailed?: string
  deleteFailed?: string
}

interface UseCRUDOptions<T = Record<string, any>> {
  /** Modal 实例方法 */
  modalMethods: Pick<ModalInstanceMethods, 'openModal' | 'closeModal'>
  /** Form 实例方法 */
  formMethods: Pick<FormInstanceMethods, 'setFieldsValue' | 'clearValidate' | 'validate'>
  /** Table 实例方法（可选，用于刷新） */
  tableMethods?: { value: TableInstanceMethods | null }
  /** 创建 API */
  onCreate?: (values: Record<string, any>) => Promise<any>
  /** 更新 API */
  onUpdate?: (id: number | string, values: Record<string, any>) => Promise<any>
  /** 删除 API */
  onDelete?: (record: T) => Promise<any>
  /** 获取表单初始值（从记录） */
  getFormValues?: (record: T) => Record<string, any>
  /** 获取空表单值（新增时） */
  getEmptyValues?: () => Record<string, any>
  /** 自定义消息提示 */
  messages?: CRUDMessages
  /** 创建前的钩子（返回 false 可阻止操作） */
  beforeCreate?: () => boolean | Promise<boolean>
  /** 更新前的钩子 */
  beforeUpdate?: (record: T) => boolean | Promise<boolean>
  /** 删除前的钩子 */
  beforeDelete?: (record: T) => boolean | Promise<boolean>
  /** 保存成功后的回调 */
  onSaved?: (isEdit: boolean, values: Record<string, any>) => void
  /** 删除成功后的回调 */
  onDeleted?: (record: T) => void
}

const DEFAULT_MESSAGES: Required<CRUDMessages> = {
  createSuccess: '创建成功',
  updateSuccess: '更新成功',
  deleteSuccess: '删除成功',
  deleteConfirm: '确定要删除该条数据吗？',
  saveFailed: '保存失败',
  deleteFailed: '删除失败',
}

export function useCRUD<T = Record<string, any>>(options: UseCRUDOptions<T>) {
  const {
    modalMethods,
    formMethods,
    tableMethods,
    onCreate,
    onUpdate,
    onDelete,
    getFormValues,
    getEmptyValues,
    messages = {},
    beforeCreate,
    beforeUpdate,
    beforeDelete,
    onSaved,
    onDeleted,
  } = options

  // 合并默认消息
  const msgs = { ...DEFAULT_MESSAGES, ...messages }

  // ========== 状态 ==========
  const isEditing = ref(false)
  const currentRecord = ref<T | null>(null)
  const loading = ref(false)

  // ========== 新增操作 ==========
  async function handleAdd() {
    if (beforeCreate && !(await beforeCreate())) {
      return
    }

    isEditing.value = false
    currentRecord.value = null

    // 设置空表单值
    if (getEmptyValues) {
      formMethods.setFieldsValue(getEmptyValues())
    }

    formMethods.clearValidate()
    modalMethods.openModal()
  }

  // ========== 编辑操作 ==========
  async function handleEdit(record: T) {
    if (beforeUpdate && !(await beforeUpdate(record))) {
      return
    }

    isEditing.value = true
    currentRecord.value = record

    // 设置表单值为记录数据
    if (getFormValues) {
      formMethods.setFieldsValue(getFormValues(record))
    }

    formMethods.clearValidate()
    modalMethods.openModal()
  }

  // ========== 删除操作 ==========
  async function handleDelete(record: T) {
    if (beforeDelete && !(await beforeDelete(record))) {
      return
    }

    try {
      // 二次确认
      if (!onDelete || msgs.deleteConfirm) {
        // 使用 antdv-next 的 Modal.confirm（自动导入）
        const Modal = await import('antdv-next').then(m => m.Modal)
        await new Promise((resolve, reject) => {
          Modal.confirm({
            title: '确认删除',
            content: msgs.deleteConfirm,
            okText: '确定',
            cancelText: '取消',
            onOk: resolve,
            onCancel: reject,
          })
        })
      }

      loading.value = true

      if (onDelete) {
        await onDelete(record)
      }

      message.success(msgs.deleteSuccess)

      // 回调
      onDeleted?.(record)

      // 刷新表格
      tableMethods?.value?.reload()
    }
    catch (e: any) {
      // 用户取消或错误
      if (e !== false) {
        message.error(e?.message || msgs.deleteFailed)
      }
    }
    finally {
      loading.value = false
    }
  }

  // ========== 保存操作（新增/编辑） ==========
  async function handleSave() {
    try {
      // 表单验证
      const values = await formMethods.validate()
      if (!values) {
        return
      }

      loading.value = true

      if (isEditing.value && currentRecord.value) {
        // 更新操作
        if (onUpdate) {
          const id = (currentRecord.value as any).id ?? (currentRecord.value as any).key
          await onUpdate(id, values)
        }
        message.success(msgs.updateSuccess)
      }
      else {
        // 新增操作
        if (onCreate) {
          await onCreate(values)
        }
        message.success(msgs.createSuccess)
      }

      // 关闭弹窗
      modalMethods.closeModal()

      // 回调
      onSaved?.(isEditing.value, values)

      // 刷新表格
      tableMethods?.value?.reload()
    }
    catch (e: any) {
      message.error(e?.message || msgs.saveFailed)
    }
    finally {
      loading.value = false
    }
  }

  // ========== 批量删除 ==========
  async function handleBatchDelete(records: T[]) {
    if (records.length === 0) {
      message.warning('请先选择要删除的数据')
      return
    }

    try {
      const Modal = await import('antdv-next').then(m => m.Modal)
      await new Promise((resolve, reject) => {
        Modal.confirm({
          title: '批量删除',
          content: `确定要删除选中的 ${records.length} 条数据吗？`,
          okText: '确定',
          cancelText: '取消',
          onOk: resolve,
          onCancel: reject,
        })
      })

      loading.value = true

      // 逐个删除（或使用批量删除 API）
      if (onDelete) {
        await Promise.all(records.map(record => onDelete(record)))
      }

      message.success(`成功删除 ${records.length} 条数据`)
      tableMethods?.value?.reload()
    }
    catch (e: any) {
      if (e !== false) {
        message.error(e?.message || msgs.deleteFailed)
      }
    }
    finally {
      loading.value = false
    }
  }

  return {
    // 状态
    isEditing,
    currentRecord,
    loading,

    // 操作方法
    handleAdd,
    handleEdit,
    handleDelete,
    handleSave,
    handleBatchDelete,

    // 重置状态
    reset: () => {
      isEditing.value = false
      currentRecord.value = null
      loading.value = false
    },
  }
}
