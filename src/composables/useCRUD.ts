import { message, Modal } from 'antdv-next'
import { nextTick, ref } from 'vue'

import type { DrawerMethods, ModalMethods } from '~/components'
import type { FormActionType } from '~/components/business/Form'
import type { TableActionType } from '~/components/business/Table'

type ContainerType = 'modal' | 'drawer'

interface CRUDMessages {
  createSuccess?: string
  updateSuccess?: string
  deleteSuccess?: string
  batchDeleteSuccess?: string
  deleteConfirm?: string
  batchDeleteConfirm?: string
  saveFailed?: string
  deleteFailed?: string
  exportSuccess?: string
  importSuccess?: string
  exportFailed?: string
  importFailed?: string
}

interface UseCRUDOptions<RecordType = Record<string, any>, FormValues = Record<string, any>> {
  /** 容器类型 */
  containerType?: ContainerType
  /** Modal 方法（containerType 为 modal 时使用） */
  modalMethods?: Pick<ModalMethods, 'openModal' | 'closeModal'>
  /** Drawer 方法（containerType 为 drawer 时使用） */
  drawerMethods?: Pick<DrawerMethods, 'openDrawer' | 'closeDrawer'>
  /** Form 方法 */
  formMethods: Pick<FormActionType, 'setFieldsValue' | 'clearValidate' | 'validate' | 'resetFields'>
  /** Table 方法 */
  tableMethods?: { value: TableActionType | null }
  /** 主键字段名（用于编辑和删除） */
  idKey?: string
  /** 创建 API */
  onCreate?: (values: FormValues) => Promise<any>
  /** 更新 API */
  onUpdate?: (id: string, values: FormValues) => Promise<any>
  /** 删除 API */
  onDelete?: (record: RecordType) => Promise<any>
  /** 批量删除 API（若不提供则逐个调用 onDelete） */
  onBatchDelete?: (records: RecordType[]) => Promise<any>
  /** 导出 API（可选） */
  onExport?: (params?: { selectedRows?: RecordType[]; queryParams?: Record<string, any> }) => Promise<any>
  /** 导入 API（可选），接收上传的 File 对象 */
  onImport?: (file: File) => Promise<any>
  /** 从记录提取表单值（编辑时） */
  getFormValues?: (record: RecordType) => FormValues
  /** 获取空表单值（新增时） */
  getEmptyValues?: () => FormValues
  /** 自定义消息 */
  messages?: CRUDMessages
  /** 新增前钩子 */
  beforeCreate?: (values: FormValues) => boolean | Promise<boolean>
  /** 编辑前钩子 */
  beforeUpdate?: (record: RecordType, values: FormValues) => boolean | Promise<boolean>
  /**
   * 删除前钩子
   * 说明：确认逻辑（如 Modal.confirm）请在此钩子内自行处理，
   * 返回 false 可中断删除流程。
   */
  beforeDelete?: (record: RecordType) => boolean | Promise<boolean>
  /** 保存后回调 */
  onSaved?: (isEdit: boolean, values: FormValues) => void
  /** 删除后回调 */
  onDeleted?: (record: RecordType) => void
  /** 编辑时获取详情的函数，返回完整记录 */
  onFetchDetail?: (id: string) => Promise<RecordType>
}

const DEFAULT_MESSAGES = {
  createSuccess: '创建成功',
  updateSuccess: '更新成功',
  deleteSuccess: '删除成功',
  batchDeleteSuccess: '批量删除成功',
  saveFailed: '保存失败',
  deleteFailed: '删除失败',
  exportSuccess: '导出成功',
  importSuccess: '导入成功',
  exportFailed: '导出失败',
  importFailed: '导入失败',
} satisfies CRUDMessages

export function useCRUD<RecordType = Record<string, any>, FormValues = Record<string, any>>(
  options: UseCRUDOptions<RecordType, FormValues>,
) {
  const {
    containerType = 'modal',
    modalMethods,
    drawerMethods,
    formMethods,
    tableMethods,
    idKey = 'id',
    onCreate,
    onUpdate,
    onDelete,
    onBatchDelete,
    onExport,
    onImport,
    getFormValues,
    getEmptyValues,
    messages = {},
    beforeCreate,
    beforeUpdate,
    beforeDelete,
    onSaved,
    onDeleted,
    onFetchDetail,
  } = options

  const msgs = { ...DEFAULT_MESSAGES, ...messages }

  // ========== 状态 ==========
  const isEditing = ref(false)
  const currentRecord = ref<RecordType | null>(null)
  const loading = ref(false)

  // 统一容器操作
  async function openContainer() {
    if (containerType === 'modal') {
      await modalMethods?.openModal()
    } else {
      await drawerMethods?.openDrawer()
    }
  }

  async function closeContainer() {
    formMethods.resetFields()
    if (containerType === 'modal') {
      await modalMethods?.closeModal()
    } else {
      await drawerMethods?.closeDrawer()
    }
  }

  // 刷新表格
  function refreshTable() {
    tableMethods?.value?.reload()
  }

  // ========== 新增 ==========
  async function handleAdd(initialValues?: Partial<FormValues>) {
    if (beforeCreate && !(await beforeCreate(initialValues as FormValues))) return
    isEditing.value = false
    currentRecord.value = null
    const empty = getEmptyValues ? getEmptyValues() : {}
    await openContainer()
    nextTick(async () => {
      await formMethods.resetFields()
      await formMethods.setFieldsValue({ ...empty, ...initialValues })
    })
  }

  // ========== 编辑 ==========
  async function handleEdit(record: RecordType, initialValues?: Partial<FormValues>) {
    if (beforeUpdate && !(await beforeUpdate(record, initialValues as FormValues))) return
    currentRecord.value = record
    isEditing.value = true
    await openContainer()
    await formMethods.resetFields()
    await nextTick()
    let detailRecord = record
    if (onFetchDetail) {
      try {
        detailRecord = await onFetchDetail((record as any)[idKey])
      } catch (e) {
        console.warn('获取详情失败，使用行数据', e)
      }
    }

    currentRecord.value = detailRecord

    await formMethods.setFieldsValue(getFormValues ? getFormValues(detailRecord) : (detailRecord as any))
  }

  // ========== 删除 ==========
  async function handleDelete(record: RecordType) {
    if (beforeDelete && !(await beforeDelete(record))) return

    loading.value = true
    try {
      if (onDelete) {
        await onDelete(record)
      }
      message.success(msgs.deleteSuccess)
      onDeleted?.(record)
      refreshTable()
    } catch (e: any) {
      message.error(e?.message || msgs.deleteFailed)
    } finally {
      loading.value = false
    }
  }

  // ========== 批量删除 ==========
  async function handleBatchDelete(records?: RecordType[]) {
    const selected = records ?? (tableMethods?.value?.getSelectRows?.() as RecordType[])
    if (!selected || selected.length === 0) {
      message.warning('请先选择要删除的数据')
      return
    }

    // 逐个调用 beforeDelete 钩子，任一返回 false 则中断
    if (beforeDelete) {
      for (const record of selected) {
        if (!(await beforeDelete(record))) return
      }
    }

    loading.value = true
    try {
      Modal.confirm({
        title: '批量删除',
        content: `确定删除选中的 ${selected.length} 项吗？`,
        okType: 'danger',
        async onOk() {
          if (onBatchDelete) {
            await onBatchDelete(selected)
          } else if (onDelete) {
            await Promise.all(selected.map((r) => onDelete(r)))
          } else {
            throw new Error('未配置删除 API')
          }
          message.success(`${msgs.batchDeleteSuccess}（${selected.length} 条）`)
          refreshTable()
        },
      })
    } catch (e: any) {
      message.error(e?.message || msgs.deleteFailed)
    } finally {
      loading.value = false
    }
  }

  // ========== 保存 ==========
  async function handleSave() {
    try {
      const values = await formMethods.validate()
      if (!values) return

      loading.value = true
      if (isEditing.value && currentRecord.value) {
        if (!onUpdate) throw new Error('未配置更新 API')
        const id = (currentRecord.value as any)[idKey]
        await onUpdate(id, values)
        message.success(msgs.updateSuccess)
      } else {
        if (!onCreate) throw new Error('未配置创建 API')
        await onCreate(values)
        message.success(msgs.createSuccess)
      }

      closeContainer()
      onSaved?.(isEditing.value, values)
      refreshTable()
    } catch (e: any) {
      message.error(e?.message || msgs.saveFailed)
    } finally {
      loading.value = false
    }
  }

  // ========== 导出（可选） ==========
  async function handleExport(exportSelected = false) {
    if (!onExport) {
      message.warning('未配置导出功能')
      return
    }
    loading.value = true
    try {
      const selectedRows = exportSelected ? (tableMethods?.value?.getSelectRows?.() as RecordType[]) : undefined
      await onExport({ selectedRows })
      message.success(msgs.exportSuccess)
    } catch (e: any) {
      message.error(e?.message || msgs.exportFailed)
    } finally {
      loading.value = false
    }
  }

  // ========== 导入（可选） ==========
  async function handleImport(file: File) {
    if (!onImport) {
      message.warning('未配置导入功能')
      return
    }
    loading.value = true
    try {
      await onImport(file)
      message.success(msgs.importSuccess)
      refreshTable()
    } catch (e: any) {
      message.error(e?.message || msgs.importFailed)
    } finally {
      loading.value = false
    }
  }

  return {
    isEditing,
    currentRecord,
    loading,
    handleAdd,
    handleEdit,
    handleDelete,
    handleSave,
    handleBatchDelete,
    handleExport,
    handleImport,
    reset: () => {
      isEditing.value = false
      currentRecord.value = null
      loading.value = false
    },
  }
}
