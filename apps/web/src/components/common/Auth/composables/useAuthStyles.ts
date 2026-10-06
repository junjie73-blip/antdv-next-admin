import { computed } from 'vue';

import { cn } from '~/utils/cn';

export function useAuthStyles() {
  /* ============================================================
   * 页面容器
   * ============================================================ */
  const containerClassName = computed(() =>
    cn(
      'relative isolate min-h-screen w-full overflow-hidden',
      'flex items-center justify-center',
      'px-4 py-8 sm:px-6 lg:px-8',
      'bg-slate-50 dark:bg-slate-950',
      'transition-colors duration-500',
    ),
  );

  /* ============================================================
   * 背景层
   * ============================================================ */
  const bgLayerClassName = cn(
    'pointer-events-none absolute inset-0 z-0 overflow-hidden',
  );

  /* ---------- 1. 基础渐变底（新增） ---------- */
  const bgGradientClassName = cn(
    'absolute inset-0',
    // 亮色：顶部偏蓝紫，底部偏青
    'bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(59,130,246,0.18),transparent_60%),radial-gradient(ellipse_60%_50%_at_80%_110%,rgba(139,92,246,0.14),transparent_60%),radial-gradient(ellipse_70%_50%_at_10%_100%,rgba(6,182,212,0.12),transparent_60%)]',
    // 暗色：更克制的深色渐变
    'dark:bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(59,130,246,0.15),transparent_60%),radial-gradient(ellipse_60%_50%_at_80%_110%,rgba(139,92,246,0.12),transparent_60%),radial-gradient(ellipse_70%_50%_at_10%_100%,rgba(6,182,212,0.10),transparent_60%)]',
  );

  /* ---------- 2. 流动光斑（保留） ---------- */
  const blob1ClassName = cn(
    'absolute rounded-full blur-[120px]',
    '-top-40 -left-40 h-[640px] w-[640px]',
    'bg-blue-400/40 dark:bg-blue-500/18',
    'animate-pulse [animation-duration:12s]',
  );

  const blob2ClassName = cn(
    'absolute rounded-full blur-[120px]',
    '-top-32 -right-40 h-[560px] w-[560px]',
    'bg-violet-400/35 dark:bg-violet-500/15',
    'animate-pulse [animation-delay:2s] [animation-duration:14s]',
  );

  const blob3ClassName = cn(
    'absolute rounded-full blur-[120px]',
    '-bottom-40 -left-32 h-[520px] w-[520px]',
    'bg-cyan-300/30 dark:bg-cyan-500/12',
    'animate-pulse [animation-delay:4s] [animation-duration:10s]',
  );

  const blob4ClassName = cn(
    'absolute rounded-full blur-[120px]',
    '-right-40 -bottom-40 h-[600px] w-[600px]',
    'bg-indigo-400/30 dark:bg-indigo-500/15',
    'animate-pulse [animation-delay:1s] [animation-duration:16s]',
  );

  /* ---------- 3. 细网格（保留，微调透明度） ---------- */
  const gridClassName = cn(
    'absolute inset-0',
    'opacity-25 dark:opacity-[0.10]',
    'bg-[linear-gradient(to_right,rgba(100,116,139,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(100,116,139,0.08)_1px,transparent_1px)]',
    'bg-size-[56px_56px]',
    'mask-[radial-gradient(ellipse_70%_70%_at_center,black_20%,transparent_90%)]',
    '[-webkit-mask-image:radial-gradient(ellipse_70%_70%_at_center,black_20%,transparent_90%)]',
  );

  /* ---------- 4. 点阵图案（新增） ---------- */
  const dotsClassName = cn(
    'absolute inset-0',
    'opacity-40 dark:opacity-20',
    'bg-[radial-gradient(rgba(100,116,139,0.4)_1px,transparent_1px)]',
    'bg-size-[24px_24px]',
    // 只在中部区域显示，边缘淡出
    'mask-[radial-gradient(ellipse_60%_60%_at_50%_50%,black,transparent_70%)]',
    '[-webkit-mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black,transparent_70%)]',
  );

  /* ---------- 5. 装饰性同心圆环（新增） ---------- */
  const ring1ClassName = cn(
    'absolute rounded-full border',
    // 右上角
    '-top-32 -right-32 h-[420px] w-[420px]',
    'border-slate-300/40 dark:border-slate-600/20',
  );

  const ring2ClassName = cn(
    'absolute rounded-full border',
    // 右上角，更大
    '-top-52 -right-52 h-[620px] w-[620px]',
    'border-slate-300/30 dark:border-slate-600/15',
  );

  const ring3ClassName = cn(
    'absolute rounded-full border',
    // 左下角
    '-bottom-40 -left-40 h-[520px] w-[520px]',
    'border-slate-300/30 dark:border-slate-600/15',
  );

  /* ---------- 6. 对角光线（新增） ---------- */
  const raysClassName = cn(
    'absolute inset-0',
    'opacity-50 dark:opacity-30',
    // 用线性渐变画斜光束，配合 mask 在中部最亮
    'bg-[linear-gradient(115deg,transparent_0%,transparent_40%,rgba(59,130,246,0.08)_45%,rgba(59,130,246,0.12)_50%,rgba(59,130,246,0.08)_55%,transparent_60%,transparent_100%)]',
    'mask-[radial-gradient(ellipse_100%_80%_at_50%_50%,black_30%,transparent_80%)]',
    '[-webkit-mask-image:radial-gradient(ellipse_100%_80%_at_50%_50%,black_30%,transparent_80%)]',
  );

  /* ---------- 7. 顶部/底部角落光晕（新增） ---------- */
  const cornerGlowTopClassName = cn(
    'absolute -top-40 left-1/2 -translate-x-1/2',
    'h-[400px] w-[800px] rounded-full blur-[100px]',
    'bg-linear-to-b from-blue-300/40 to-transparent',
    'dark:from-blue-500/20 dark:to-transparent',
  );

  const cornerGlowBottomClassName = cn(
    'absolute -bottom-40 left-1/2 -translate-x-1/2',
    'h-[400px] w-[900px] rounded-full blur-[100px]',
    'bg-linear-to-t from-violet-300/30 to-transparent',
    'dark:from-violet-500/15 dark:to-transparent',
  );

  /* ---------- 8. 漂浮小点（新增） ---------- */
  const sparklesClassName = cn(
    'absolute inset-0',
    'opacity-60 dark:opacity-40',
    // 用 radial-gradient 画多个亮点
    'bg-[radial-gradient(circle_at_15%_20%,rgba(59,130,246,0.5)_2px,transparent_2px),radial-gradient(circle_at_85%_30%,rgba(139,92,246,0.5)_2px,transparent_2px),radial-gradient(circle_at_25%_80%,rgba(6,182,212,0.5)_2px,transparent_2px),radial-gradient(circle_at_75%_75%,rgba(59,130,246,0.4)_1.5px,transparent_1.5px),radial-gradient(circle_at_50%_15%,rgba(139,92,246,0.4)_1.5px,transparent_1.5px)]',
    'animate-pulse [animation-duration:6s]',
  );

  /* ---------- 9. 噪点纹理（新增，增加质感） ---------- */
  const noiseClassName = cn(
    'absolute inset-0',
    'opacity-[0.03] dark:opacity-[0.05]',
    'mix-blend-overlay',
    // 用 SVG data-uri 生成噪点
    "baseFrequency=%220.8%22 bg-[url('data:image/svg+xml;utf8,<svg filter=%22url(%23n)%22/></svg>')] height=%22100%22><filter height=%22100%25%22 id=%22n%22><feTurbulence numOctaves=%224%22 stitchTiles=%22stitch%22/></filter><rect type=%22fractalNoise%22 width=%22100%22 width=%22100%25%22 xmlns=%22http://www.w3.org/2000/svg%22",
  );

  /* ============================================================
   * 主卡片
   * ============================================================ */
  const cardClassName = cn(
    'relative w-full max-w-[980px]',
    'border border-solid border-white/60 dark:border-white/[0.08]',
    'grid grid-cols-1 lg:grid-cols-5',
    'overflow-hidden rounded-2xl',
    'bg-white/40 dark:bg-slate-900/40',
    'backdrop-blur-2xl backdrop-saturate-150',
    'ring-1 ring-white/40 dark:ring-white/4',
    // 阴影加光晕，让卡片从背景中"浮起"
    'shadow-[0_8px_40px_-8px_rgba(59,130,246,0.15),0_4px_20px_rgba(0,0,0,0.08)]',
    'dark:shadow-[0_8px_40px_-8px_rgba(59,130,246,0.25),0_4px_20px_rgba(0,0,0,0.3)]',
    'min-h-[560px]',
    'transition-colors duration-500',
  );

  /* ============================================================
   * 品牌面板
   * ============================================================ */
  const brandPanelClassName = cn(
    'hidden lg:col-span-2 lg:flex',
    'relative flex-col items-center justify-center',
    'overflow-hidden px-10 py-12',
    'bg-linear-to-br from-slate-700 via-slate-800 to-slate-900',
    'text-white backdrop-blur-xl',
  );

  const brandGlowClassName = cn(
    'absolute -top-20 -right-20 h-[320px] w-[320px] rounded-full',
    'pointer-events-none bg-white/20 blur-[80px]',
    'animate-pulse [animation-duration:12s]',
  );

  const brandGridClassName = cn(
    'pointer-events-none absolute inset-0 opacity-15',
    'bg-[linear-gradient(to_right,rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.2)_1px,transparent_1px)]',
    'bg-size-[40px_40px]',
  );

  const brandContentClassName = cn(
    'relative z-10 mx-auto w-full max-w-[340px]',
    'flex flex-col gap-8',
  );

  const brandLogoClassName = cn(
    'inline-flex items-center gap-3',
    'rounded-xl px-3.5 py-2',
    'bg-white/15 backdrop-blur-md',
    'border border-white/25',
    'shadow-[0_2px_8px_rgba(0,0,0,0.06)]',
    'self-start',
  );

  const brandLogoIconClassName = cn(
    'flex h-9 w-9 items-center justify-center rounded-lg',
    'bg-white/20 text-white',
  );

  const brandFeatureClassName = cn(
    'inline-flex items-center gap-2',
    'rounded-full px-3 py-1.5',
    'bg-white/10 backdrop-blur-sm',
    'border border-white/20',
    'text-xs text-white/90',
  );

  const brandPreviewClassName = cn(
    'relative overflow-hidden rounded-xl',
    'bg-white/8 backdrop-blur-sm',
    'border border-white/12',
    'p-3',
  );

  /* ============================================================
   * 表单面板
   * ============================================================ */
  const formPanelClassName = cn(
    'lg:col-span-3',
    'flex flex-col items-center justify-center',
    'px-6 py-10 sm:px-10 lg:px-14',
    'bg-white/30 dark:bg-slate-900/20',
    'backdrop-blur-xl',
  );

  const formWrapClassName = cn('w-full max-w-[360px]', 'mx-auto');

  const formHeaderBadgeClassName = cn(
    'inline-flex items-center gap-1.5 rounded-full',
    'border border-blue-100/60 bg-blue-50/80 px-3 py-1',
    'text-[11px] font-medium text-blue-600 backdrop-blur-sm',
    'dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400',
  );

  /* ============================================================
   * 输入框
   * ============================================================ */
  const inputClassName = cn(
    'transition-all duration-200',
    '[&_.ant-input]:bg-transparent!',
    '[&_.ant-input-affix-wrapper]:bg-white/50! dark:[&_.ant-input-affix-wrapper]:bg-slate-800/40!',
    '[&_.ant-input-affix-wrapper]:border-white/60! dark:[&_.ant-input-affix-wrapper]:border-white/8!',
    '[&_.ant-input-affix-wrapper]:rounded-lg!',
    '[&_.ant-input-affix-wrapper]:h-11!',
    '[&_.ant-input-affix-wrapper]:backdrop-blur-sm!',
    '[&_.ant-input-affix-wrapper:hover]:border-white/90!',
    'dark:[&_.ant-input-affix-wrapper:hover]:border-white/15!',
    '[&_.ant-input-affix-wrapper-focused]:border-(--ant-color-primary)!',
    '[&_.ant-input-affix-wrapper-focused]:shadow-[0_0_0_3px_color-mix(in_srgb,var(--ant-color-primary)_14%,transparent)]!',
    '[&_.ant-select-selector]:bg-white/50! dark:[&_.ant-select-selector]:bg-slate-800/40!',
    '[&_.ant-select-selector]:border-white/60! dark:[&_.ant-select-selector]:border-white/8!',
    '[&_.ant-select-selector]:rounded-lg!',
    '[&_.ant-select-selector]:h-11!',
    '[&_.ant-select-selector]:flex! [&_.ant-select-selector]:items-center!',
    '[&_.ant-select-selector]:backdrop-blur-sm!',
    '[&_.ant-select-focused_.ant-select-selector]:border-(--ant-color-primary)!',
    '[&_.ant-select-focused_.ant-select-selector]:shadow-[0_0_0_3px_color-mix(in_srgb,var(--ant-color-primary)_14%,transparent)]!',
  );

  const submitButtonClassName = cn('h-11! rounded-lg! text-sm! font-medium!');

  const socialButtonClassName = cn(
    'group flex h-10 cursor-pointer items-center justify-center rounded-lg',
    'border border-white/60 bg-white/40 backdrop-blur-sm',
    'transition-all duration-200',
    'hover:border-white/90 hover:bg-white/70',
    'dark:border-white/8 dark:bg-slate-800/40',
    'dark:hover:border-white/15 dark:hover:bg-slate-700/60',
  );

  const socialIconClassName = cn(
    'text-lg transition-transform duration-200 group-hover:scale-110',
  );

  const trustBadgeClassName = cn(
    'inline-flex items-center gap-1.5',
    'text-[11px] text-slate-400 dark:text-slate-500',
  );

  return {
    // 容器
    containerClassName,
    bgLayerClassName,

    // 背景层（新增 + 保留）
    bgGradientClassName,
    blob1ClassName,
    blob2ClassName,
    blob3ClassName,
    blob4ClassName,
    gridClassName,
    dotsClassName,
    ring1ClassName,
    ring2ClassName,
    ring3ClassName,
    raysClassName,
    cornerGlowTopClassName,
    cornerGlowBottomClassName,
    sparklesClassName,
    noiseClassName,

    // 卡片
    cardClassName,

    // 品牌
    brandPanelClassName,
    brandGlowClassName,
    brandGridClassName,
    brandContentClassName,
    brandLogoClassName,
    brandLogoIconClassName,
    brandFeatureClassName,
    brandPreviewClassName,

    // 表单
    formPanelClassName,
    formWrapClassName,
    formHeaderBadgeClassName,
    inputClassName,
    submitButtonClassName,

    // 第三方
    socialButtonClassName,
    socialIconClassName,
    trustBadgeClassName,
  };
}

export const useLoginStyles = useAuthStyles;
