import type { LayoutMode } from '../composables/useLayout'

import { cn } from '@/utils/cn'

interface LayoutIconProps {
  type: LayoutMode
  active?: boolean
  class?: string
}

function VerticalLayoutIcon({ active }: { active?: boolean }) {
  const primaryColor = 'var(--ant-primary-color)'
  const primaryHoverColor = 'var(--ant-primary-color-hover)'

  return (
    <svg viewBox="0 0 48 36" class="w-full h-auto">
      <rect
        x="0"
        y="0"
        width="48"
        height="6"
        rx="1"
        class="transition-colors duration-200"
        style={{ fill: active ? primaryColor : '#d9d9d9' }}
      />
      <rect
        x="0"
        y="6"
        width="10"
        height="30"
        rx="0"
        class="transition-colors duration-200"
        style={{ fill: active ? primaryHoverColor : '#f0f0f0' }}
      />
      <rect x="10" y="6" width="38" height="30" fill="#fafafa" />
      <rect
        x="13"
        y="10"
        width="12"
        height="2"
        rx="0.5"
        class="transition-colors duration-200"
        style={{ fill: active ? primaryColor : '#d9d9d9' }}
      />
      <rect x="13" y="14" width="8" height="2" rx="0.5" fill="#e0e0e0" />
      <rect x="13" y="18" width="10" height="2" rx="0.5" fill="#e0e0e0" />
    </svg>
  )
}

function HorizontalLayoutIcon({ active }: { active?: boolean }) {
  const primaryColor = 'var(--ant-primary-color)'

  return (
    <svg viewBox="0 0 48 36" class="w-full h-auto">
      <rect
        x="0"
        y="0"
        width="48"
        height="6"
        rx="1"
        class="transition-colors duration-200"
        style={{ fill: active ? primaryColor : '#d9d9d9' }}
      />
      <rect
        x="2"
        y="2"
        width="4"
        height="2"
        rx="0.5"
        class="transition-colors duration-200"
        style={{ fill: active ? 'rgba(255,255,255,0.8)' : '#fafafa' }}
      />
      <rect
        x="14"
        y="2"
        width="6"
        height="2"
        rx="0.5"
        class="transition-colors duration-200"
        style={{ fill: active ? 'rgba(255,255,255,0.3)' : '#e0e0e0' }}
      />
      <rect
        x="22"
        y="2"
        width="6"
        height="2"
        rx="0.5"
        class="transition-colors duration-200"
        style={{ fill: active ? 'rgba(255,255,255,0.3)' : '#e0e0e0' }}
      />
      <rect
        x="30"
        y="2"
        width="6"
        height="2"
        rx="0.5"
        class="transition-colors duration-200"
        style={{ fill: active ? 'rgba(255,255,255,0.3)' : '#e0e0e0' }}
      />
      <rect x="0" y="6" width="48" height="30" fill="#fafafa" />
      <rect
        x="3"
        y="10"
        width="12"
        height="2"
        rx="0.5"
        class="transition-colors duration-200"
        style={{ fill: active ? primaryColor : '#d9d9d9' }}
      />
      <rect x="3" y="14" width="8" height="2" rx="0.5" fill="#e0e0e0" />
      <rect x="3" y="18" width="10" height="2" rx="0.5" fill="#e0e0e0" />
    </svg>
  )
}

function MixedLayoutIcon({ active }: { active?: boolean }) {
  const primaryColor = 'var(--ant-primary-color)'
  const primaryHoverColor = 'var(--ant-primary-color-hover)'

  return (
    <svg viewBox="0 0 48 36" class="w-full h-auto">
      <rect
        x="0"
        y="0"
        width="48"
        height="6"
        rx="1"
        class="transition-colors duration-200"
        style={{ fill: active ? primaryColor : '#d9d9d9' }}
      />
      <rect
        x="2"
        y="2"
        width="4"
        height="2"
        rx="0.5"
        class="transition-colors duration-200"
        style={{ fill: active ? 'rgba(255,255,255,0.8)' : '#fafafa' }}
      />
      <rect
        x="14"
        y="2"
        width="6"
        height="2"
        rx="0.5"
        class="transition-colors duration-200"
        style={{ fill: active ? 'rgba(255,255,255,0.3)' : '#e0e0e0' }}
      />
      <rect
        x="22"
        y="2"
        width="6"
        height="2"
        rx="0.5"
        class="transition-colors duration-200"
        style={{ fill: active ? 'rgba(255,255,255,0.3)' : '#e0e0e0' }}
      />
      <rect
        x="0"
        y="6"
        width="10"
        height="30"
        class="transition-colors duration-200"
        style={{ fill: active ? primaryHoverColor : '#f0f0f0' }}
      />
      <rect
        x="2"
        y="10"
        width="6"
        height="1.5"
        rx="0.5"
        class="transition-colors duration-200"
        style={{ fill: active ? primaryColor : '#d9d9d9' }}
      />
      <rect x="2" y="13" width="5" height="1.5" rx="0.5" fill="#e0e0e0" />
      <rect x="2" y="16" width="6" height="1.5" rx="0.5" fill="#e0e0e0" />
      <rect x="10" y="6" width="38" height="30" fill="#fafafa" />
      <rect
        x="13"
        y="10"
        width="10"
        height="2"
        rx="0.5"
        class="transition-colors duration-200"
        style={{ fill: active ? primaryColor : '#d9d9d9' }}
      />
      <rect x="13" y="14" width="8" height="2" rx="0.5" fill="#e0e0e0" />
    </svg>
  )
}

export function LayoutIcon(props: LayoutIconProps) {
  const { type, active, class: className } = props

  const containerClassName = cn(
    'w-full aspect-[4/3]',
    className,
  )

  const renderIcon = () => {
    switch (type) {
      case 'vertical':
        return <VerticalLayoutIcon active={active} />
      case 'horizontal':
        return <HorizontalLayoutIcon active={active} />
      case 'mixed':
        return <MixedLayoutIcon active={active} />
      default:
        return null
    }
  }

  return (
    <div class={containerClassName}>
      {renderIcon()}
    </div>
  )
}

export const LAYOUT_OPTIONS: { value: LayoutMode, label: string }[] = [
  { value: 'vertical', label: '垂直' },
  { value: 'horizontal', label: '水平' },
  { value: 'mixed', label: '混合' },
]
