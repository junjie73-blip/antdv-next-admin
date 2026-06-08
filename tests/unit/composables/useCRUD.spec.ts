import { describe, expect, it, vi } from 'vitest'
import { useCRUD } from '@/composables/useCRUD'
import {
  createMockModalMethods,
  createMockFormMethods,
  createMockTableMethods,
  createMockUserRecord,
  waitFor,
} from '../../utils'

describe('useCRUD', () => {
  // Mock message
  const mockMessage = {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  }

  // 全局注入
  beforeEach(() => {
    vi.stubGlobal('message', mockMessage)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with correct default values', () => {
      const modalMethods = createMockModalMethods()
      const formMethods = createMockFormMethods()

      const crud = useCRUD({
        modalMethods,
        formMethods,
      })

      expect(crud.isEditing.value).toBe(false)
      expect(crud.currentRecord.value).toBeNull()
      expect(crud.loading.value).toBe(false)
    })
  })

  describe('handleAdd', () => {
    it('should set editing mode to false and open modal', async () => {
      const modalMethods = createMockModalMethods()
      const formMethods = createMockFormMethods()
      const getEmptyValues = () => ({ username: '', status: 1 })

      const crud = useCRUD({
        modalMethods,
        formMethods,
        getEmptyValues,
      })

      await crud.handleAdd()

      expect(crud.isEditing.value).toBe(false)
      expect(crud.currentRecord.value).toBeNull()
      expect(modalMethods.openModal).toHaveBeenCalled()
      expect(formMethods.setFieldsValue).toHaveBeenCalledWith({ username: '', status: 1 })
      expect(formMethods.clearValidate).toHaveBeenCalled()
    })

    it('should not proceed if beforeCreate returns false', async () => {
      const modalMethods = createMockModalMethods()
      const formMethods = createMockFormMethods()
      const beforeCreate = vi.fn().mockReturnValue(false)

      const crud = useCRUD({
        modalMethods,
        formMethods,
        beforeCreate,
      })

      await crud.handleAdd()

      expect(beforeCreate).toHaveBeenCalled()
      expect(modalMethods.openModal).not.toHaveBeenCalled()
    })
  })

  describe('handleEdit', () => {
    it('should set editing mode to true with record data', async () => {
      const modalMethods = createMockModalMethods()
      const formMethods = createMockFormMethods()
      const record = createMockUserRecord({ id: 123 })
      const getFormValues = (r: any) => ({ ...r })

      const crud = useCRUD({
        modalMethods,
        formMethods,
        getFormValues,
      })

      await crud.handleEdit(record as any)

      expect(crud.isEditing.value).toBe(true)
      expect(crud.currentRecord.value).toEqual(record)
      expect(modalMethods.openModal).toHaveBeenCalled()
      expect(formMethods.setFieldsValue).toHaveBeenCalled()
    })
  })

  describe('handleSave - Create', () => {
    it('should call onCreate and show success message', async () => {
      const modalMethods = createMockModalMethods()
      const formMethods = createMockFormMethods()
      const tableMethods = createMockTableMethods()
      const onCreate = vi.fn().mockResolvedValue({ id: 999 })
      const onSaved = vi.fn()

      const formData = { username: 'newuser', status: 1 }
      formMethods.validate.mockResolvedValue(formData)

      const crud = useCRUD({
        modalMethods,
        formMethods,
        tableMethods,
        onCreate,
        onSaved,
        messages: { createSuccess: '创建成功' },
      })

      // 先调用 handleAdd 设置为新增模式
      crud.isEditing.value = false

      await crud.handleSave()

      expect(onCreate).toHaveBeenCalledWith(formData)
      expect(mockMessage.success).toHaveBeenCalledWith('创建成功')
      expect(modalMethods.closeModal).toHaveBeenCalled()
      expect(onSaved).toHaveBeenCalledWith(false, formData)
      expect(tableMethods.value?.reload).toHaveBeenCalled()
    })

    it('should show error message when save fails', async () => {
      const modalMethods = createMockModalMethods()
      const formMethods = createMockFormMethods()
      const error = new Error('网络错误')
      formMethods.validate.mockRejectedValue(error)

      const crud = useCRUD({
        modalMethods,
        formMethods,
        messages: { saveFailed: '保存失败' },
      })

      crud.isEditing.value = false

      await crud.handleSave()

      // 当 validate 抛出异常时，会使用原始错误消息
      expect(mockMessage.error).toHaveBeenCalledWith('网络错误')
      expect(modalMethods.closeModal).not.toHaveBeenCalled()
    })
  })

  describe('handleSave - Update', () => {
    it('should call onUpdate when in edit mode', async () => {
      const modalMethods = createMockModalMethods()
      const formMethods = createMockFormMethods()
      const tableMethods = createMockTableMethods()
      const onUpdate = vi.fn().mockResolvedValue({})
      const onSaved = vi.fn()
      const record = createMockUserRecord({ id: 456 })

      const formData = { username: 'updateduser' }
      formMethods.validate.mockResolvedValue(formData)

      const crud = useCRUD({
        modalMethods,
        formMethods,
        tableMethods,
        onUpdate,
        onSaved,
        messages: { updateSuccess: '更新成功' },
      })

      // 设置为编辑模式
      crud.isEditing.value = true
      crud.currentRecord.value = record as any

      await crud.handleSave()

      expect(onUpdate).toHaveBeenCalledWith(456, formData)
      expect(mockMessage.success).toHaveBeenCalledWith('更新成功')
      expect(onSaved).toHaveBeenCalledWith(true, formData)
    })
  })

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      const crud = useCRUD({
        modalMethods: createMockModalMethods(),
        formMethods: createMockFormMethods(),
      })

      // 修改状态
      crud.isEditing.value = true
      crud.currentRecord.value = {} as any
      crud.loading.value = true

      // 重置
      crud.reset()

      expect(crud.isEditing.value).toBe(false)
      expect(crud.currentRecord.value).toBeNull()
      expect(crud.loading.value).toBe(false)
    })
  })
})
