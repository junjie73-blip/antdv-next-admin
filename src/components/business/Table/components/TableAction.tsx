import type { PropType, VNode } from 'vue'
import type { ActionItem } from '../types'

import { Button, Divider, Dropdown, Popconfirm } from 'antdv-next'
import { isFunction } from 'es-toolkit'
import { computed, defineComponent } from 'vue'
import { IconifyIcon as Icon } from '@/components/common/Icon'
import { cn } from '@/utils/cn'

/**
 * 按钮类型映射
 * 将 ghost 类型映射为 default，因为 antdv-next 不支持 ghost 类型
 */
type ButtonType = 'default' | 'link' | 'dashed' | 'text' | 'primary'

/**
 * TableAction 组件 Props 类型定义
 */
interface TableActionProps {
  /** 操作项列表 */
  actions?: ActionItem[]
  /** 最多显示的操作数量，超出部分放入下拉菜单 */
  maxShowCount?: number
  /** 当前行数据 */
  record?: Record<string, any>
}

/**
 * 获取按钮类型
 * @param action - 操作项配置
 * @returns 有效的按钮类型
 */
function getButtonType(action: ActionItem): ButtonType {
  const type = action.type || 'link'
  // 过滤掉 'ghost' 类型，因为它不被 antdv-next 支持
  if (type === 'ghost')
    return 'default'
  return type as ButtonType
}

/**
 * 获取按钮大小
 * @param action - 操作项配置
 * @returns 按钮大小或 undefined（使用系统默认）
 */
function getButtonSize(action: ActionItem): 'small' | 'middle' | 'large' | undefined {
  // 如果 action 明确设置了 size，则使用，否则返回 undefined 使用系统默认
  return action.size || undefined
}

/**
 * 判断是否有权限
 * @param auth - 权限配置
 * @returns 是否有权限
 */
function hasAuth(auth: ActionItem['auth']): boolean {
  if (!auth)
    return true
  // 这里可以根据实际权限系统调整
  return true
}

/**
 * 判断是否显示操作项
 * @param action - 操作项配置
 * @param record - 当前行数据
 * @returns 是否显示
 */
function isShow(action: ActionItem, record: Record<string, any>): boolean {
  if (action.ifShow === false)
    return false
  if (isFunction(action.ifShow))
    return action.ifShow(record)
  return true
}

/**
 * 判断是否禁用操作项
 * @param action - 操作项配置
 * @param record - 当前行数据
 * @returns 是否禁用
 */
function isDisabled(action: ActionItem, record: Record<string, any>): boolean {
  if (action.disabled === true)
    return true
  if (isFunction(action.disabled))
    return action.disabled(record)
  return false
}

/**
 * 获取操作项标签
 * @param label - 标签配置
 * @param record - 当前行数据
 * @returns 标签内容
 */
function getActionLabel(label: ActionItem['label'], record: Record<string, any>): string | VNode | undefined {
  if (!label)
    return undefined
  if (isFunction(label))
    return label(record)
  return label
}

/**
 * TableAction 组件
 * 表格操作列组件，支持普通按钮、Popconfirm、Dropdown 等多种操作类型
 */
export default defineComponent({
  name: 'TableAction',

  props: {
    actions: {
      type: Array as PropType<ActionItem[]>,
      default: () => [],
    },
    maxShowCount: {
      type: Number,
      default: 4,
    },
    record: {
      type: Object as PropType<Record<string, any>>,
      default: () => ({}),
    },
  },

  setup(props: TableActionProps) {
    // ============================
    // Computed
    // ============================

    /**
     * 获取当前行数据
     */
    const record = computed(() => props.record || {})

    /**
     * 获取操作列表
     */
    const actions = computed(() => props.actions || [])

    /**
     * 获取最大显示数量
     */
    const maxShowCount = computed(() => props.maxShowCount || 4)

    /**
     * 可见的操作项列表
     * 根据权限和 ifShow 条件过滤
     */
    const visibleActions = computed(() => {
      return actions.value.filter((action) => {
        if (!hasAuth(action.auth))
          return false
        if (!isShow(action, record.value))
          return false
        return true
      })
    })

    /**
     * 显示的操作项列表（不包含下拉菜单中的项）
     * 如果操作数量超过 maxShowCount，只显示前 maxShowCount - 1 个
     */
    const showActions = computed(() => {
      const visibleCount = visibleActions.value.length
      const displayCount = visibleCount > maxShowCount.value ? maxShowCount.value - 1 : maxShowCount.value
      return visibleActions.value.slice(0, displayCount)
    })

    /**
     * 下拉菜单中的操作项列表
     * 只有当操作数量超过 maxShowCount 时才显示
     */
    const dropdownActions = computed(() => {
      if (visibleActions.value.length <= maxShowCount.value) {
        return []
      }
      return visibleActions.value.slice(maxShowCount.value - 1)
    })

    /**
     * 是否有下拉菜单
     */
    const hasDropdown = computed(() => dropdownActions.value.length > 0)

    // ============================
    // Event Handlers
    // ============================

    /**
     * 处理操作项点击
     */
    function handleClick(action: ActionItem, e: MouseEvent) {
      if (action.onClick) {
        action.onClick(record, e)
      }
    }

    /**
     * 处理 Popconfirm 确认
     */
    function handleConfirm(action: ActionItem, e?: MouseEvent) {
      if (action.popConfirm?.confirm && e) {
        action.popConfirm.confirm(record, e)
      }
    }

    /**
     * 处理 Popconfirm 取消
     */
    function handleCancel(action: ActionItem, e?: MouseEvent) {
      if (action.popConfirm?.cancel && e) {
        action.popConfirm.cancel(record, e)
      }
    }

    /**
     * 处理 Dropdown 菜单点击
     */
    function handleDropdownMenuClick(actionList: ActionItem[], info: { key: string, domEvent?: Event }) {
      const index = Number(info.key)
      const action = actionList[index]
      if (action?.onClick) {
        info.domEvent?.stopPropagation?.()
        action.onClick(record, info.domEvent as MouseEvent)
      }
    }

    // ============================
    // Render Helpers
    // ============================

    /**
     * 渲染分割线
     */
    function renderDivider(index: number) {
      if (index === 0)
        return null
      return <Divider type="vertical" class={cn('mx-0')} />
    }

    /**
     * 渲染普通按钮 - 使用较小 padding
     */
    function renderButton(action: ActionItem, index: number) {
      const label = getActionLabel(action.label, record.value)

      return (
        <>
          {renderDivider(index)}
          <Button
            type={getButtonType(action)}
            size={getButtonSize(action)}
            disabled={isDisabled(action, record.value)}
            danger={action.danger}
            class={cn('!px-0.5')}
            onClick={(e: MouseEvent) => handleClick(action, e)}
          >
            {{
              icon: action.icon ? () => <Icon icon={action.icon!} /> : undefined,
              default: label ? () => <span>{label}</span> : undefined,
            }}
          </Button>
        </>
      )
    }

    /**
     * 渲染 Popconfirm 按钮
     * 与 Dropdown 使用相同的 getPopupContainer 模式确保弹窗不被表格 overflow 裁剪
     */
    function renderPopconfirmButton(action: ActionItem, index: number) {
      const label = getActionLabel(action.label, record.value)

      return (
        <>
          {renderDivider(index)}
          <Popconfirm
            title={action.popConfirm?.title}
            onConfirm={(e?: MouseEvent) => handleConfirm(action, e)}
            onCancel={(e?: MouseEvent) => handleCancel(action, e)}
            onOpenChange={(open: boolean) => {
              if (open) {
                // 关键修复：将 PopConfirm 移到 body，避免 TD(sticky) 层叠上下文遮挡
                // 使用递归重试确保 DOM 渲染完成后再移动
                const moveToEnd = (retry = 0) => {
                  setTimeout(() => {
                    const popEl = document.querySelector('.ant-popconfirm')
                    if (popEl && popEl.parentElement !== document.body) {
                      document.body.appendChild(popEl)
                    }
                    else if (!popEl && retry < 5) {
                      moveToEnd(retry + 1)
                    }
                  }, 20 * (retry + 1))
                }
                moveToEnd()
              }
            }}
            zIndex={999999}
            placement="bottomLeft"
          >
            <Button
              type={getButtonType(action)}
              size={getButtonSize(action)}
              disabled={isDisabled(action, record.value)}
              danger={action.danger}
              class={cn('!px-0.5')}
              onClick={(e: MouseEvent) => handleClick(action, e)}
            >
              {{
                icon: action.icon ? () => <Icon icon={action.icon!} /> : undefined,
                default: label ? () => <span>{label}</span> : undefined,
              }}
            </Button>
          </Popconfirm>
        </>
      )
    }

    /**
     * 渲染 Dropdown 按钮 - 使用较小 padding
     */
    function renderDropdownButton(action: ActionItem, index: number) {
      const label = getActionLabel(action.label, record.value)
      const dropdownItems = action.dropdown
        ?.filter(item => item.ifShow !== false)
        ?.map((item, i) => ({
          key: i,
          label: getActionLabel(item.label, record.value),
          danger: item.danger,
          disabled: isDisabled(item, record.value),
        })) ?? []

      return (
        <>
          {renderDivider(index)}
          <Dropdown
            menu={{ items: dropdownItems }}
            getPopupContainer={() => document.body}
            styles={{ popup: { zIndex: 999999 } }}
            onMenuClick={(info: { key: string, domEvent?: Event }) => {
              if (action.dropdown) {
                handleDropdownMenuClick(action.dropdown, info)
              }
            }}
          >
            <Button
              type={getButtonType(action)}
              size={getButtonSize(action)}
              disabled={isDisabled(action, record.value)}
              danger={action.danger}
              class={cn('!px-0.5')}
            >
              {{
                default: () => (
                  <span class={cn('flex items-center gap-1')}>
                    {action.icon ? <Icon icon={action.icon} /> : null}
                    {label ? <span>{label}</span> : null}
                    <Icon icon="ant-design:down-outlined" />
                  </span>
                ),
              }}
            </Button>
          </Dropdown>
        </>
      )
    }

    /**
     * 渲染操作项
     */
    function renderAction(action: ActionItem, index: number) {
      // Popconfirm 类型
      if (action.popConfirm) {
        return renderPopconfirmButton(action, index)
      }

      // Dropdown 类型
      if (action.dropdown && action.dropdown.length > 0) {
        return renderDropdownButton(action, index)
      }

      // 普通按钮类型
      return renderButton(action, index)
    }

    /**
     * 渲染"更多"下拉菜单
     */
    function renderMoreDropdown() {
      if (!hasDropdown.value)
        return null

      const items = dropdownActions.value.map((action, i) => ({
        key: i,
        label: getActionLabel(action.label, record.value) || '操作',
        danger: action.danger,
        disabled: isDisabled(action, record.value),
      }))

      return (
        <>
          <Divider type="vertical" class={cn('mx-0')} />
          <Dropdown
            menu={{ items }}
            classes={{ popup: 'table-action-dropdown' }}
            getPopupContainer={() => document.body}
            styles={{ popup: { zIndex: 999999 } }}
            onMenuClick={(info: { key: string, domEvent?: Event }) => {
              handleDropdownMenuClick(dropdownActions.value, info)
            }}
          >
            <Button type="link" class={cn('!px-0.5')}>
              {{
                default: () => (
                  <span class={cn('flex items-center gap-1')}>
                    <span>更多</span>
                    <Icon icon="ant-design:down-outlined" />
                  </span>
                ),
              }}
            </Button>
          </Dropdown>
        </>
      )
    }

    // ============================
    // Render
    // ============================

    return () => {
      return (
        <div class={cn('flex items-center')}>
          {showActions.value.map((action, index) => renderAction(action, index))}
          {renderMoreDropdown()}
        </div>
      )
    }
  },
})
