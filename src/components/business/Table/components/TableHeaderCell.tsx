import type { PropType } from 'vue'
import type { BasicColumn } from '../types'
import { computed, defineComponent } from 'vue'
import { IconifyIcon as Icon } from '@/components/common/Icon'

export default defineComponent({
  name: 'TableHeaderCell',
  props: {
    column: {
      type: Object as PropType<BasicColumn | any>,
      required: true,
    },
    editable: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['edit'],
  setup(props, { emit, slots }) {
    // 是否显示编辑图标
    const showEditIcon = computed(() => {
      return props.editable || props.column?.edit || props.column?.editRow
    })

    // 获取对齐方式
    const getAlignClass = computed(() => {
      const align = props.column?.align
      switch (align) {
        case 'left':
          return 'justify-start'
        case 'right':
          return 'justify-end'
        case 'center':
        default:
          return 'justify-center'
      }
    })

    // 处理编辑点击
    const handleEditClick = (e: Event) => {
      e.stopPropagation()
      emit('edit', props.column)
    }

    return () => {
      const { column } = props

      return (
        <div class={`flex items-center gap-1 ${getAlignClass.value}`}>
          {/* 列标题 */}
          <span>{column.title}</span>

          {/* 编辑图标 */}
          {showEditIcon.value && (
            <span
              class="cursor-pointer text-gray-400 hover:text-blue-500 transition-colors"
              onClick={handleEditClick}
              title="点击编辑"
            >
              <Icon icon="ant-design:edit-outlined" />
            </span>
          )}

          {/* 自定义插槽内容 */}
          {slots.default?.()}
        </div>
      )
    }
  },
})
