import { computed } from 'vue'
import { cn } from '@/utils/cn'

export function useLoginStyles() {
  const containerClassName = computed(() =>
    cn('min-h-screen flex', 'bg-gradient-to-br from-slate-50 via-stone-50 to-gray-100'),
  )

  const leftPanelClassName = computed(() =>
    cn('hidden lg:flex lg:w-[55%]', 'relative overflow-hidden'),
  )

  const leftGlassClassName = computed(() =>
    cn(
      'absolute inset-0',
      'bg-gradient-to-br from-white/70 via-slate-50/60 to-gray-100/60',
      'backdrop-blur-xl',
    ),
  )

  const rightPanelClassName = computed(() =>
    cn('w-full lg:w-[45%]', 'flex items-center justify-center', 'p-6 sm:p-8 lg:p-12', 'bg-white'),
  )

  const glassCardClassName = computed(() => cn('w-full max-w-[400px]', 'p-2'))

  // 输入框统一风格（去掉 Glass，改为简洁的 antd 风）
  const inputClassName = computed(() =>
    cn(
      '[&_.ant-input]:!bg-transparent',
      '[&_.ant-input-affix-wrapper]:!bg-gray-50',
      '[&_.ant-input-affix-wrapper]:!border-gray-200',
      '[&_.ant-input-affix-wrapper]:!rounded-lg',
      '[&_.ant-input-affix-wrapper]:!h-11',
      '[&_.ant-input-affix-wrapper:hover]:!border-slate-400',
      '[&_.ant-input-affix-wrapper-focused]:!border-[var(--ant-color-primary)]',
      '[&_.ant-input-affix-wrapper-focused]:!shadow-[0_0_0_3px_color-mix(in_srgb,var(--ant-color-primary)_12%,transparent)]',
    ),
  )

  const decorBlob1ClassName = computed(() =>
    cn('absolute top-1/4 left-1/4 w-[500px] h-[500px]', 'rounded-full blur-[100px]'),
  )
  const decorBlob1Style = computed(() => ({
    background: 'color-mix(in srgb, var(--ant-color-primary) 12%, transparent)',
  }))

  const decorBlob2ClassName = computed(() =>
    cn('absolute bottom-1/4 right-1/4 w-[400px] h-[400px]', 'rounded-full blur-[80px]'),
  )
  const decorBlob2Style = computed(() => ({
    background: 'color-mix(in srgb, var(--ant-color-primary) 8%, transparent)',
  }))

  const decorBlob3ClassName = computed(() =>
    cn('absolute top-1/2 left-1/2 w-[300px] h-[300px]', 'rounded-full blur-[60px]'),
  )
  const decorBlob3Style = computed(() => ({
    background: 'color-mix(in srgb, var(--ant-color-primary) 6%, transparent)',
  }))

  const gridBgClassName = computed(() =>
    cn(
      'absolute inset-0',
      'bg-[linear-gradient(rgba(100,100,100,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(100,100,100,0.025)_1px,transparent_1px)]',
      'bg-[size:48px_48px]',
    ),
  )

  const logoContainerClassName = computed(() =>
    cn(
      'inline-flex items-center gap-3 px-4 py-2',
      'bg-white/70 backdrop-blur-md rounded-xl',
      'border border-white/80 shadow-sm',
    ),
  )

  const logoIconClassName = computed(() =>
    cn('w-9 h-9 rounded-lg flex items-center justify-center shadow-md'),
  )

  const logoIconStyle = computed(() => ({
    background: 'var(--ant-color-primary)',
    boxShadow: '0 4px 12px color-mix(in srgb, var(--ant-color-primary) 30%, transparent)',
  }))

  const titleHighlightStyle = computed(() => ({
    color: 'var(--ant-color-primary)',
  }))

  const featureIconClassName = computed(() =>
    cn(
      'w-11 h-11 bg-white/70 backdrop-blur-md rounded-lg flex items-center justify-center',
      'border border-white/80 shadow-sm transition-all duration-300',
    ),
  )

  const featureIconStyle = computed(() => ({
    color: 'var(--ant-color-primary)',
  }))

  return {
    containerClassName,
    leftPanelClassName,
    leftGlassClassName,
    rightPanelClassName,
    glassCardClassName,
    inputClassName,
    decorBlob1ClassName,
    decorBlob1Style,
    decorBlob2ClassName,
    decorBlob2Style,
    decorBlob3ClassName,
    decorBlob3Style,
    gridBgClassName,
    logoContainerClassName,
    logoIconClassName,
    logoIconStyle,
    titleHighlightStyle,
    featureIconClassName,
    featureIconStyle,
  }
}
