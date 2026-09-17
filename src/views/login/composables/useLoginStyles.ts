import { computed } from "vue";

import { cn } from "@/utils/cn";


/**
 * 登录 / 注册页共享样式
 *
 * 设计：
 * - 背景：液态玻璃（多层流动光斑 + 细网格）
 * - 卡片：磨砂玻璃（40% 透明度）+ 边框发光 + 柔和阴影
 * - 布局：左右双栏，内容各自垂直水平居中
 * - 响应式：lg 以下隐藏左侧品牌区
 */
export function useLoginStyles() {
  // ============================================================
  // 页面容器
  // ============================================================
  const containerClassName = computed(() =>
    cn(
      "relative min-h-screen w-full overflow-hidden",
      "flex items-center justify-center",
      "px-4 py-8 sm:px-6 lg:px-8",
      "bg-slate-50 dark:bg-slate-950",
      "transition-colors duration-500",
    ),
  );

  // ============================================================
  // 液态玻璃背景层
  // ============================================================
  const bgLayerClassName = computed(() =>
    cn("absolute inset-0 -z-10 overflow-hidden pointer-events-none"),
  );

  /** 流动光斑 1（左上，蓝） */
  const blob1ClassName = computed(() =>
    cn(
      "absolute rounded-full blur-[120px]",
      "-top-40 -left-40 w-[640px] h-[640px]",
      "bg-blue-400/40 dark:bg-blue-500/[0.18]",
      "animate-pulse [animation-duration:12s]",
    ),
  );

  /** 流动光斑 2（右上，紫） */
  const blob2ClassName = computed(() =>
    cn(
      "absolute rounded-full blur-[120px]",
      "-top-32 -right-40 w-[560px] h-[560px]",
      "bg-violet-400/35 dark:bg-violet-500/[0.15]",
      "animate-pulse [animation-duration:14s] [animation-delay:2s]",
    ),
  );

  /** 流动光斑 3（左下，青） */
  const blob3ClassName = computed(() =>
    cn(
      "absolute rounded-full blur-[120px]",
      "-bottom-40 -left-32 w-[520px] h-[520px]",
      "bg-cyan-300/30 dark:bg-cyan-500/[0.12]",
      "animate-pulse [animation-duration:10s] [animation-delay:4s]",
    ),
  );

  /** 流动光斑 4（右下，靛） */
  const blob4ClassName = computed(() =>
    cn(
      "absolute rounded-full blur-[120px]",
      "-bottom-40 -right-40 w-[600px] h-[600px]",
      "bg-indigo-400/30 dark:bg-indigo-500/[0.15]",
      "animate-pulse [animation-duration:16s] [animation-delay:1s]",
    ),
  );

  /** 细网格（中间可见，边缘淡出） */
  const gridClassName = computed(() =>
    cn(
      "absolute inset-0",
      "opacity-30 dark:opacity-[0.12]",
      "bg-[linear-gradient(to_right,rgba(100,116,139,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(100,116,139,0.06)_1px,transparent_1px)]",
      "bg-[size:56px_56px]",
      "[mask-image:radial-gradient(ellipse_70%_70%_at_center,black_20%,transparent_90%)]",
      "[-webkit-mask-image:radial-gradient(ellipse_70%_70%_at_center,black_20%,transparent_90%)]",
    ),
  );

  // ============================================================
  // 主卡片（磨砂玻璃容器）
  // ============================================================
  const cardClassName = computed(() =>
    cn(
      "relative w-full max-w-[980px] border border-white/60 dark:border-white/[0.08] border-solid",
      "grid grid-cols-1 lg:grid-cols-5",
      "rounded-2xl overflow-hidden",
      // 磨砂玻璃：40% 不透明度
      "bg-white/40 dark:bg-slate-900/40",
      "backdrop-blur-2xl backdrop-saturate-150",
      // 边框发光
      "border border-white/60 dark:border-white/[0.08]",
      "ring-1 ring-white/40 dark:ring-white/[0.04]",
      // 指定阴影
      "shadow-[0_4px_20px_rgba(0,0,0,0.1)]",
      // 响应式最小高度
      "min-h-[560px]",
      // 主题切换平滑过渡
      "transition-colors duration-500",
    ),
  );

  // ============================================================
  // 左侧品牌面板（内部玻璃 + 蓝底）
  // ============================================================
  const brandPanelClassName = computed(() =>
    cn(
      "hidden lg:flex lg:col-span-2",
      "relative flex-col justify-center items-center",
      "px-10 py-12",
      "overflow-hidden",
      // 品牌色玻璃
      "bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900",
      "backdrop-blur-xl",
      "text-white",
    ),
  );

  /** 品牌面板内部白光斑 */
  const brandGlowClassName = computed(() =>
    cn(
      "absolute -top-20 -right-20 w-[320px] h-[320px] rounded-full",
      "bg-white/20 blur-[80px] pointer-events-none",
      "animate-pulse [animation-duration:12s]",
    ),
  );

  /** 品牌面板网格 */
  const brandGridClassName = computed(() =>
    cn(
      "absolute inset-0 opacity-15 pointer-events-none",
      "bg-[linear-gradient(to_right,rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.2)_1px,transparent_1px)]",
      "bg-[size:40px_40px]",
    ),
  );

  // ============================================================
  // 右侧表单面板
  // ============================================================
  const formPanelClassName = computed(() =>
    cn(
      "lg:col-span-3",
      "flex flex-col justify-center items-center",
      "px-6 py-10 sm:px-10 lg:px-14",
      // 右侧内部玻璃（更淡）
      "bg-white/30 dark:bg-slate-900/20",
      "backdrop-blur-xl",
    ),
  );

  /** 表单容器（居中 + 最大宽度） */
  const formWrapClassName = computed(() => cn("w-full max-w-[360px]", "mx-auto"));

  // ============================================================
  // 输入框统一风格
  // ============================================================
  const inputClassName = computed(() =>
    cn(
      "transition-all duration-200",
      // input
      "[&_.ant-input]:!bg-transparent",
      "[&_.ant-input-affix-wrapper]:!bg-white/50 dark:[&_.ant-input-affix-wrapper]:!bg-slate-800/40",
      "[&_.ant-input-affix-wrapper]:!border-white/60 dark:[&_.ant-input-affix-wrapper]:!border-white/[0.08]",
      "[&_.ant-input-affix-wrapper]:!rounded-lg",
      "[&_.ant-input-affix-wrapper]:!h-11",
      "[&_.ant-input-affix-wrapper]:!backdrop-blur-sm",
      "[&_.ant-input-affix-wrapper:hover]:!border-white/90",
      "dark:[&_.ant-input-affix-wrapper:hover]:!border-white/[0.15]",
      "[&_.ant-input-affix-wrapper-focused]:!border-[var(--ant-color-primary)]",
      "[&_.ant-input-affix-wrapper-focused]:!shadow-[0_0_0_3px_color-mix(in_srgb,var(--ant-color-primary)_14%,transparent)]",
      // select
      "[&_.ant-select-selector]:!bg-white/50 dark:[&_.ant-select-selector]:!bg-slate-800/40",
      "[&_.ant-select-selector]:!border-white/60 dark:[&_.ant-select-selector]:!border-white/[0.08]",
      "[&_.ant-select-selector]:!rounded-lg",
      "[&_.ant-select-selector]:!h-11",
      "[&_.ant-select-selector]:!flex [&_.ant-select-selector]:!items-center",
      "[&_.ant-select-selector]:!backdrop-blur-sm",
      "[&_.ant-select-focused_.ant-select-selector]:!border-[var(--ant-color-primary)]",
      "[&_.ant-select-focused_.ant-select-selector]:!shadow-[0_0_0_3px_color-mix(in_srgb,var(--ant-color-primary)_14%,transparent)]",
    ),
  );

  // ============================================================
  // 品牌区元素
  // ============================================================
  const brandLogoClassName = computed(() =>
    cn(
      "inline-flex items-center gap-3",
      "px-3.5 py-2 rounded-xl",
      "bg-white/15 backdrop-blur-md",
      "border border-white/25",
      "shadow-[0_2px_8px_rgba(0,0,0,0.06)]",
    ),
  );

  const brandLogoIconClassName = computed(() =>
    cn("w-9 h-9 rounded-lg flex items-center justify-center", "bg-white/20", "text-white"),
  );

  const brandFeatureClassName = computed(() =>
    cn(
      "inline-flex items-center gap-2",
      "px-3 py-1.5 rounded-full",
      "bg-white/10 backdrop-blur-sm",
      "border border-white/20",
      "text-xs text-white/90",
    ),
  );

  /** 品牌区内容容器（改为 justify-between 铺满上下） */
  const brandContentClassName = computed(() =>
    cn("relative z-10 w-full max-w-[340px] mx-auto", "flex flex-col gap-8"),
  );

  /** 产品预览卡（更精细的 dashboard 缩略图） */
  const brandPreviewClassName = computed(() =>
    cn(
      "relative rounded-xl overflow-hidden",
      "bg-white/[0.08] backdrop-blur-sm",
      "border border-white/[0.12]",
      "p-3",
    ),
  );

  /** 预览卡内部的"伪侧边栏" */
  const brandPreviewSidebarClassName = computed(() =>
    cn("w-[28px] shrink-0 rounded-md bg-white/[0.08]", "flex flex-col items-center gap-1.5 py-2"),
  );

  /** 预览卡内部的"伪顶部栏" */
  const brandPreviewTopbarClassName = computed(() =>
    cn("h-5 rounded-md bg-white/[0.06]", "flex items-center gap-1 px-2"),
  );

  /** 数据指标容器 */
  const brandStatsClassName = computed(() =>
    cn("grid grid-cols-3 gap-3", "pt-6", "border-t border-white/10"),
  );

  /** 单个数据指标 */
  const brandStatItemClassName = computed(() => cn("flex flex-col gap-0.5"));

  /** 数据数字 */
  const brandStatValueClassName = computed(() =>
    cn("text-lg font-semibold text-white tracking-tight"),
  );

  /** 数据标签 */
  const brandStatLabelClassName = computed(() =>
    cn("text-[10px] text-white/50 uppercase tracking-wider"),
  );
  return {
    containerClassName,
    bgLayerClassName,
    blob1ClassName,
    blob2ClassName,
    blob3ClassName,
    blob4ClassName,
    gridClassName,
    cardClassName,
    brandPanelClassName,
    brandGlowClassName,
    brandGridClassName,
    brandContentClassName,
    formPanelClassName,
    formWrapClassName,
    inputClassName,
    brandLogoClassName,
    brandLogoIconClassName,
    brandFeatureClassName,
    brandPreviewClassName,
    brandStatsClassName,
    brandStatItemClassName,
    brandStatValueClassName,
    brandStatLabelClassName,
    brandPreviewSidebarClassName,
    brandPreviewTopbarClassName,
  };
}
