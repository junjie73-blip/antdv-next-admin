import type { PropType } from 'vue'

import { computed, defineComponent } from 'vue'

import { IconifyIcon as Icon } from '~/components/common/Icon'

import type { BasicColumn } from '../types'

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
    const showEditIcon = computed(() => {
      return props.editable || props.column?.edit || props.column?.editRow
    })

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

    const handleEditClick = (e: Event) => {
      e.stopPropagation()
      emit('edit', props.column)
    }

    return () => {
      const { column } = props

      return (
        <div class={`flex items-center gap-1 ${getAlignClass.value}`}>
          <span>{column.title}</span>

          {showEditIcon.value && (
            <span
              class="hover:text-ant-primary-500 dark:hover:text-ant-primary-400 cursor-pointer text-gray-400 transition-colors dark:text-gray-500"
              onClick={handleEditClick}
              title="点击编辑"
            >
              <Icon icon="ant-design:edit-outlined" />
            </span>
          )}

          {slots.default?.()}
        </div>
      )
    }
  },
})
