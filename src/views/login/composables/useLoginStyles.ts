import { computed } from 'vue'
import { cn } from '@/utils/cn'

export function useLoginStyles() {
  const containerClassName = computed(() =>
    cn('min-h-screen flex', 'bg-gradient-to-br from-stone-100 via-slate-50 to-gray-50'),
  )

  const leftPanelClassName = computed(() =>
    cn('hidden lg:flex lg:w-1/2 xl:w-3/5', 'relative overflow-hidden'),
  )

  const leftGlassClassName = computed(() =>
    cn('absolute inset-0', 'bg-gradient-to-br from-white/60 via-slate-100/40 to-gray-100/50', 'backdrop-blur-xl'),
  )

  const rightPanelClassName = computed(() =>
    cn(
      'w-full lg:w-1/2 xl:w-2/5',
      'flex items-center justify-center',
      'p-8 lg:p-12',
      'bg-gradient-to-br from-white/80 to-slate-50/60',
    ),
  )

  const glassCardClassName = computed(() =>
    cn(
      'w-full max-w-md',
      'bg-white/70 backdrop-blur-2xl',
      'border border-white/80',
      'rounded-2xl shadow-xl shadow-slate-900/5',
      'p-8 lg:p-10',
    ),
  )

  const inputClassName = computed(() =>
    cn(
      '[&_.ant-input]:!bg-white/80',
      '[&_.ant-input]:!border-slate-200',
      '[&_.ant-input]:!text-stone-700',
      '[&_.ant-input]:placeholder:text-stone-400',
      '[&_.ant-input]:hover:!border-slate-400',
      '[&_.ant-input]:focus:!border-[var(--ant-color-primary)]',
      '[&_.ant-input]:focus:!shadow-[0_0_0_2px_color-mix(in_srgb,var(--ant-color-primary)_20%,transparent)]',
      '[&_.ant-input-affix-wrapper]:!bg-white/80',
      '[&_.ant-input-affix-wrapper]:!border-slate-200',
      '[&_.ant-input-affix-wrapper]:hover:!border-slate-400',
      '[&_.ant-input-affix-wrapper-focused]:!border-[var(--ant-color-primary)]',
      '[&_.ant-input-affix-wrapper-focused]:!shadow-[0_0_0_2px_color-mix(in_srgb,var(--ant-color-primary)_20%,transparent)]',
      '[&_.ant-input-affix-wrapper_input]:!bg-transparent',
      '[&_.ant-input-affix-wrapper_input]:!text-stone-700',
    ),
  )

  const decorBlob1ClassName = computed(() =>
    cn('absolute top-1/4 left-1/4 w-[500px] h-[500px]', 'rounded-full blur-[100px]'),
  )

  const decorBlob1Style = computed(() => ({
    background: 'color-mix(in srgb, var(--ant-color-primary) 15%, transparent)',
  }))

  const decorBlob2ClassName = computed(() =>
    cn('absolute bottom-1/4 right-1/4 w-[400px] h-[400px]', 'rounded-full blur-[80px]'),
  )

  const decorBlob2Style = computed(() => ({
    background: 'color-mix(in srgb, var(--ant-color-primary) 10%, transparent)',
  }))

  const decorBlob3ClassName = computed(() =>
    cn('absolute top-1/2 left-1/2 w-[300px] h-[300px]', 'rounded-full blur-[60px]'),
  )

  const decorBlob3Style = computed(() => ({
    background: 'color-mix(in srgb, var(--ant-color-primary) 8%, transparent)',
  }))

  const gridBgClassName = computed(() =>
    cn(
      'absolute inset-0',
      'bg-[linear-gradient(rgba(100,100,100,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(100,100,100,0.03)_1px,transparent_1px)]',
      'bg-[size:48px_48px]',
    ),
  )

  const logoContainerClassName = computed(() =>
    cn(
      'inline-flex items-center gap-3 px-5 py-2.5',
      'bg-white/60 backdrop-blur-md rounded-xl',
      'border border-white/80 shadow-lg shadow-slate-900/5',
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
      'w-11 h-11 bg-white/60 backdrop-blur-md rounded-lg flex items-center justify-center',
      'border border-white/80 shadow-md shadow-slate-900/5 transition-all duration-300',
    ),
  )

  const featureIconStyle = computed(() => ({
    color: 'var(--ant-color-primary)',
  }))

  const loginTypeContainerClassName = computed(() =>
    cn('flex bg-stone-100/80 rounded-lg p-1'),
  )

  const loginTypeBtnBaseClassName = computed(() =>
    cn('flex-1 py-2 rounded-md text-sm font-medium transition-all duration-200'),
  )

  const loginTypeActiveBtnStyle = computed(() => ({ color: 'var(--ant-color-primary)' }))

  const sendCodeBtnStyle = computed(() => ({
    color: 'var(--ant-color-primary)',
  }))

  const registerLinkStyle = computed(() => ({
    color: 'var(--ant-color-primary)',
  }))

  const thirdPartyBtnClassName = computed(() =>
    cn(
      'w-11 h-11 bg-white/80 backdrop-blur-sm rounded-lg flex items-center justify-center',
      'border border-stone-200 hover:border-stone-300 transition-all duration-200 shadow-sm',
    ),
  )

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
    loginTypeContainerClassName,
    loginTypeBtnBaseClassName,
    loginTypeActiveBtnStyle,
    sendCodeBtnStyle,
    registerLinkStyle,
    thirdPartyBtnClassName,
  }
}
