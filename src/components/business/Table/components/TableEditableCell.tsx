import type { PropType } from 'vue'
import type { BasicColumn, ComponentType, Recordable } from '../types'

import { Button, DatePicker, Input, InputNumber, Select, Switch } from 'antdv-next'
import { computed, defineComponent, nextTick, ref, watch } from 'vue'
import { IconifyIcon as Icon } from '@/components/common/Icon'

export default defineComponent({
  name: 'TableEditableCell',
  props: {
    column: {
      type: Object as PropType<BasicColumn | any>,
      required: true,
    },
    record: {
      type: Object as PropType<Recordable>,
      required: true,
    },
    value: {
      type: [String, Number, Boolean, Array, Object] as PropType<any>,
      default: undefined,
    },
    dataIndex: {
      type: [String, Array] as PropType<string | string[] | any>,
      required: true,
    },
  },
  emits: ['save', 'cancel', 'change'],
  setup(props, { emit }) {
    // 是否处于编辑状态
    const isEditing = ref(false)
    // 编辑值
    const editValue = ref<any>(props.value)
    // 组件引用
    const inputRef = ref<any>(null)

    // 监听值变化
    watch(() => props.value, (newVal) => {
      editValue.value = newVal
    })

    // 获取编辑组件类型
    const getEditComponent = computed(() => {
      const editComponent = props.column?.editComponent
      if (editComponent)
        return editComponent

      // 根据值类型推断组件
      const val = props.value
      if (typeof val === 'boolean')
        return 'Switch'
      if (typeof val === 'number')
        return 'InputNumber'
      return 'Input'
    })

    // 开始编辑
    const startEdit = () => {
      isEditing.value = true
      editValue.value = props.value
      nextTick(() => {
        inputRef.value?.focus?.()
      })
    }

    // 保存编辑
    const handleSave = () => {
      isEditing.value = false
      emit('save', {
        record: props.record,
        dataIndex: props.dataIndex,
        value: editValue.value,
        column: props.column,
      })
    }

    // 取消编辑
    const handleCancel = () => {
      isEditing.value = false
      editValue.value = props.value
      emit('cancel', {
        record: props.record,
        dataIndex: props.dataIndex,
        column: props.column,
      })
    }

    // 处理值变化
    const handleChange = (val: any) => {
      editValue.value = val
      emit('change', {
        record: props.record,
        dataIndex: props.dataIndex,
        value: val,
        column: props.column,
      })

      // 如果不是 Input 组件，保存时自动触发
      const component = getEditComponent.value
      if (component !== 'Input' && component !== 'InputNumber') {
        handleSave()
      }
    }

    // 渲染编辑组件
    const renderEditComponent = () => {
      const component = getEditComponent.value as ComponentType
      const componentProps = props.column?.editComponentProps || {}

      switch (component) {
        case 'Input':
          return (
            <Input
              ref={inputRef}
              value={editValue.value}
              onChange={(e: any) => handleChange(e.target.value)}
              onPressEnter={handleSave}
              {...componentProps}
            />
          )
        case 'InputNumber':
          return (
            <InputNumber
              ref={inputRef}
              value={editValue.value}
              onChange={handleChange}
              onPressEnter={handleSave}
              {...componentProps}
            />
          )
        case 'Select':
          return (
            <Select
              ref={inputRef}
              value={editValue.value}
              onChange={handleChange}
              {...componentProps}
            />
          )
        case 'DatePicker':
          return (
            <DatePicker
              ref={inputRef}
              value={editValue.value}
              onChange={handleChange}
              {...componentProps}
            />
          )
        case 'Switch':
          return (
            <Switch
              ref={inputRef}
              checked={editValue.value}
              onChange={handleChange}
              {...componentProps}
            />
          )
        default:
          return (
            <Input
              ref={inputRef}
              value={editValue.value}
              onChange={(e: any) => handleChange(e.target.value)}
              onPressEnter={handleSave}
              {...componentProps}
            />
          )
      }
    }

    return () => {
      // 检查是否可编辑
      const isEditable = props.column?.edit || props.column?.editRow

      if (!isEditable) {
        // 不可编辑，显示值
        return <span>{props.value}</span>
      }

      if (isEditing.value) {
        // 编辑状态
        return (
          <div class="flex items-center gap-2">
            <div class="flex-1">{renderEditComponent()}</div>
            <div class="flex gap-1">
              <Button
                type="text"
                onClick={handleSave}
              >
                <Icon icon="ant-design:check-outlined" />
              </Button>
              <Button
                type="text"
                onClick={handleCancel}
              >
                <Icon icon="ant-design:close-outlined" />
              </Button>
            </div>
          </div>
        )
      }

      // 显示状态，点击可编辑
      return (
        <div
          class="editable-cell flex items-center gap-1 cursor-pointer hover:text-blue-500 group"
          onClick={startEdit}
          title="点击编辑"
        >
          <span>{props.value}</span>
          <Icon
            icon="ant-design:edit-outlined"
            class="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400"
          />
        </div>
      )
    }
  },
})
