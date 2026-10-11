import { computed } from 'vue';

import { cn } from '@antdv/shared/cn';

/**
 * 登录页样式表。三条约束都是踩过坑定下来的：
 * 1. 强调色只用 `*-ant-primary`（值是 `var(--ant-color-primary)`，由
 *    `@antdv/preferences` 在偏好变化时重写到 `<html>`），写死 `blue-500` 的话
 *    设置面板换主色，登录页不动。
 * 2. 中性色必须成对写 `dark:`。明暗开关是 `html.dark` 这个 class，漏一处就出现
 *    "整站深色、登录页还是白的"。
 * 3. antd 已经从 colorPrimary / darkAlgorithm 派生出输入框边框、复选框选中色和
 *    主按钮底色，模板里再加 `!bg-white!`、`!border-slate-300!` 只会把这条派生链
 *    掐断 —— 旧版那几处强制白底正是深色模式下复选框变成一块白的原因。
 */
export function useLoginStyles() {
  /* ---------- 外壳 ---------- */
  const containerClassName = computed(() =>
    cn(
      'relative flex min-h-dvh w-full flex-col overflow-hidden',
      'bg-slate-50 dark:bg-slate-950',
      'transition-colors duration-300',
      'lg:flex-row',
    ),
  );

  const decorClassName = computed(() =>
    cn('pointer-events-none absolute inset-0', 'hidden lg:block'),
  );

  const blobClassName = computed(() =>
    cn('absolute rounded-full blur-[90px] will-change-transform'),
  );

  const blob1ClassName = computed(() =>
    cn(blobClassName.value, '-top-24 -left-24 h-[380px] w-[380px] bg-ant-primary/20'),
  );

  const blob2ClassName = computed(() =>
    cn(blobClassName.value, 'top-1/2 -left-16 h-[300px] w-[300px] bg-ant-primary/12'),
  );

  const blob3ClassName = computed(() =>
    cn(blobClassName.value, '-bottom-24 left-1/3 h-[320px] w-[320px] bg-ant-primary/8'),
  );

  const gridClassName = computed(() =>
    cn(
      'absolute inset-0 opacity-60 dark:opacity-30',
      'bg-[linear-gradient(to_right,rgba(148,163,184,0.14)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.14)_1px,transparent_1px)]',
      'bg-size-[48px_48px]',
    ),
  );

  /* ---------- 品牌区 ---------- */
  const brandClassName = computed(() =>
    cn(
      'relative z-10 hidden w-[46%] flex-col justify-center',
      'px-14 py-16 xl:px-20',
      'lg:flex',
    ),
  );

  const brandLogoRowClassName = computed(() =>
    cn('mb-10 inline-flex w-fit items-center gap-3'),
  );

  const brandLogoIconClassName = computed(() =>
    cn(
      'flex h-10 w-10 items-center justify-center rounded-xl',
      'bg-ant-primary text-white shadow-lg shadow-ant-primary/30',
    ),
  );

  const brandLogoTextClassName = computed(() =>
    cn('text-lg font-semibold text-slate-900 dark:text-white'),
  );

  const brandTitleClassName = computed(() =>
    cn(
      'mb-5 text-3xl leading-tight font-bold text-slate-900',
      'xl:text-4xl dark:text-white',
    ),
  );

  const brandDescClassName = computed(() =>
    cn('mb-10 max-w-md text-[15px] leading-relaxed text-slate-500 dark:text-slate-400'),
  );

  const featureIconClassName = computed(() =>
    cn(
      'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
      'bg-ant-primary/10 text-ant-primary ring-1 ring-ant-primary/20',
      'transition-transform duration-200 group-hover:scale-110',
    ),
  );

  const featureTitleClassName = computed(() =>
    cn('text-sm font-medium text-slate-800 dark:text-slate-100'),
  );

  const featureDescClassName = computed(() =>
    cn('text-xs text-slate-500 dark:text-slate-400'),
  );

  /* ---------- 表单区 ---------- */
  const panelClassName = computed(() =>
    cn(
      'relative z-10 flex w-full flex-1 items-center justify-center',
      'px-4 py-10 sm:px-6 lg:py-16',
    ),
  );

  const cardClassName = computed(() =>
    cn(
      'w-full max-w-[400px] rounded-2xl',
      'border border-slate-200 bg-white',
      'px-5 py-7 sm:px-8 sm:py-9',
      'dark:border-slate-700/70 dark:bg-slate-900',
      'shadow-[0_18px_50px_-24px_rgba(15,23,42,0.25)]',
      'dark:shadow-[0_18px_50px_-24px_rgba(0,0,0,0.7)]',
    ),
  );

  const mobileLogoRowClassName = computed(() =>
    cn('mb-6 flex items-center justify-center gap-2.5 lg:hidden'),
  );

  const segContainerClassName = computed(() =>
    cn('mb-6 flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800'),
  );

  const segBtnClassName = computed(() =>
    cn(
      'flex-1 rounded-md py-2 text-sm font-medium transition-colors duration-200',
    ),
  );

  const segActiveClassName = computed(() =>
    cn(
      'bg-white text-ant-primary shadow-sm',
      'dark:bg-slate-700 dark:text-ant-primary',
    ),
  );

  const segIdleClassName = computed(() =>
    cn(
      'text-slate-500 hover:text-slate-800',
      'dark:text-slate-400 dark:hover:text-slate-200',
    ),
  );

  /** 只改尺寸与圆角；边框、底色和 focus 光环交给 antd 从主色派生 */
  const inputClassName = computed(() =>
    cn(
      '[&_.ant-input-affix-wrapper]:h-11!',
      '[&_.ant-input-affix-wrapper]:rounded-lg!',
    ),
  );

  const submitButtonClassName = computed(() =>
    cn('!h-11 !rounded-lg !font-medium'),
  );

  const hintClassName = computed(() =>
    cn('mt-6 text-center text-xs text-slate-400 dark:text-slate-500'),
  );

  return {
    containerClassName,
    decorClassName,
    blob1ClassName,
    blob2ClassName,
    blob3ClassName,
    gridClassName,

    brandClassName,
    brandLogoRowClassName,
    brandLogoIconClassName,
    brandLogoTextClassName,
    brandTitleClassName,
    brandDescClassName,
    featureIconClassName,
    featureTitleClassName,
    featureDescClassName,

    panelClassName,
    cardClassName,
    mobileLogoRowClassName,
    segContainerClassName,
    segBtnClassName,
    segActiveClassName,
    segIdleClassName,
    inputClassName,
    submitButtonClassName,
    hintClassName,
  };
}
