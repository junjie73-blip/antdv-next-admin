<script setup lang="ts">
import type { ConfigProviderProps } from 'reka-ui';

import type { CSSProperties } from 'vue';

import type { GlobalConfig, GlobalTheme, ResolvedGlobalConfig } from './types';

import { computed, inject, provide, reactive, useAttrs, watch } from 'vue';

import { convertToHslCssVar } from '@antdv/shared/color';
import { CSS_VAR_PRIMARY, CSS_VAR_RADIUS } from '@antdv/shared/constants';
import { cn } from '@antdv/shared/utils/cn';
import { radiusToRem } from '@antdv/shared/utils/radius';
import { usePreferredDark } from '@vueuse/core';
import { ConfigProvider as RekaConfigProvider } from 'reka-ui';

import {
  DEFAULT_GLOBAL_CONFIG,
  GLOBAL_CONFIG_KEY,
  normalizeComponentSize,
  textsByLocale,
} from './types';

defineOptions({ name: 'ConfigProvider', inheritAttrs: false });

const props = withDefaults(defineProps<GlobalConfig>(), {
  cancelText: undefined,
  componentSize: undefined,
  cssVars: undefined,
  dir: undefined,
  emptyText: undefined,
  locale: undefined,
  nonce: undefined,
  okText: undefined,
  placeholder: undefined,
  scrollBody: undefined,
  teleportTo: undefined,
  theme: undefined,
  useId: undefined,
});

/**
 * 嵌套语义：内层只覆盖自己显式给出的字段，其余继承外层。
 *
 * 继承的是外层的**成品文案**，所以外层写死 `okText: 'Confirm'` 时内层不会退回
 * "确定/OK"；但内层自己改了 `locale` 就按新语言重新展开词条 —— 换语言的人
 * 要的是那种语言的说法，不是祖先的自定义词。
 * `theme` / `cssVars` 是浅合并：内层只换 `radius` 时，外层的主色与明暗仍在。
 */
const outer = inject(GLOBAL_CONFIG_KEY, null);

/**
 * 提供 reactive 对象而不是 computed 的快照：注入值是"引用"，
 * 给 `.value` 会让外层改配置时内层与消费方都收不到更新。
 */
const config = reactive<ResolvedGlobalConfig>({
  ...DEFAULT_GLOBAL_CONFIG,
  ...outer,
});

watch(
  () => [
    props.cancelText,
    props.componentSize,
    props.cssVars,
    props.dir,
    props.emptyText,
    props.locale,
    props.nonce,
    props.okText,
    props.placeholder,
    props.scrollBody,
    props.teleportTo,
    props.theme,
    props.useId,
  ],
  () => {
    const base = outer ?? DEFAULT_GLOBAL_CONFIG;
    const locale = props.locale ?? base.locale;
    const texts =
      outer && props.locale === undefined ? outer : textsByLocale(locale);
    config.cancelText = props.cancelText ?? texts.cancelText;
    config.componentSize = normalizeComponentSize(
      props.componentSize ?? base.componentSize,
    );
    config.cssVars = { ...base.cssVars, ...props.cssVars };
    config.dir = props.dir ?? base.dir;
    config.emptyText = props.emptyText ?? texts.emptyText;
    config.locale = locale;
    config.nonce = props.nonce ?? base.nonce;
    config.okText = props.okText ?? texts.okText;
    config.placeholder = props.placeholder ?? base.placeholder;
    config.scrollBody = props.scrollBody ?? base.scrollBody;
    config.teleportTo = props.teleportTo ?? base.teleportTo;
    config.theme = { ...base.theme, ...props.theme };
    config.useId = props.useId ?? base.useId;
  },
  { immediate: true },
);

/* ------------------------------------------------------------------ *
 * reka-ui 底座：把同一份配置交给所有 reka 原语
 * ------------------------------------------------------------------ */

/**
 * `locale` 交给 reka 是有实际读取点的：各 Root（`CalendarRoot` /
 * `RangeCalendarRoot` / `DateField` / `DatePicker` / `MonthPicker` / `YearPicker`
 * 与 `NumberField` / `TimeField` / `ColorField`）先经 `useLocale(propLocale)` 取到
 * "显式 prop 优先、否则用注入、再兜底 en"，再把结果交给 `useDateFormatter` 做 `Intl`
 * 排版并 watch 语言变化。注意 `useDateFormatter` 自己**不读注入**（参数是普通字符串），
 * 所以绕过 Root 直接 new formatter 的组件不受这层桥接影响。
 * `dir` 决定弹层定位与排版方向，`teleportTo` 是所有 portal 的默认容器，
 * `scrollBody`/`nonce`/`useId` 同理。不做这层桥接，"换了 locale 只改了按钮文案、
 * 日期还是英文月份"。
 */
const rekaLocale = computed<string>(() => config.locale);
const rekaTeleportTo = computed(
  () => config.teleportTo as ConfigProviderProps['teleportTo'],
);

/* ------------------------------------------------------------------ *
 * 子树主题与尺寸落到 DOM
 * ------------------------------------------------------------------ */

const preferredDark = usePreferredDark();

/** 留空 = 不加 class，子树沿用 `<html>` 上的档位；`system` 跟随系统 */
const resolvedMode = computed<'dark' | 'light' | undefined>(() => {
  const { mode } = config.theme;
  if (mode === 'system') return preferredDark.value ? 'dark' : 'light';
  return mode;
});

/** 数值按 px 语义给出，统一换算成 rem 落进 CSS（字符串原样，详见 `GlobalTheme.radius`） */
function toRadiusValue(radius: NonNullable<GlobalTheme['radius']>): string {
  return radiusToRem(radius);
}

/**
 * 写在容器上的 CSS 变量。
 *
 * 只写"这次覆盖里给了的"那几条：写成 `undefined` 会让 Vue 删掉这条声明，
 * 于是子树重新继承 `<html>` 的值 —— 这正是"留空 = 不覆盖"要的语义。
 * 规范名之所以能在子树生效，靠的是 `@antdv/design` 用 `@theme inline`
 * 把工具类编译成 `hsl(var(--x))` 本身（而不是在 `:root` 求过一次值）。
 */
const themeVars = computed<Record<string, string>>(() => {
  const vars: Record<string, string> = {};
  const { primary, radius } = config.theme;
  // 主色存 HSL 通道串：读侧是 `hsl(var(--primary))`，把 `#ff5c5c` 原样写进去
  // 会让这条声明在子树里把所有用到主色的地方变成非法值。
  if (primary) vars[CSS_VAR_PRIMARY] = convertToHslCssVar(primary);
  if (radius !== undefined) vars[CSS_VAR_RADIUS] = toRadiusValue(radius);
  return vars;
});

/** `cssVars` 是"任意规范名 / `--radius-*` 覆盖"的出口，排在 `themeVars` 之后 */
const cssVarsStyle = computed<Record<string, string>>(() => {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(config.cssVars)) {
    out[name] = String(value);
  }
  return out;
});

/** 宿主自定义的 class / style 与内部那些合到同一个元素上 */
const attrs = useAttrs();

const wrapperClass = computed(() =>
  cn(
    // `display: contents`：不生成盒子，布局与"没有这层"完全一致，
    // 而 CSS 变量按 DOM 树继承，照样能下发给子节点。
    // 宿主用内联 `style="display:flex"` 覆盖它也不会破坏变量传递（继承看 DOM 树）。
    'contents',
    // 明暗档位落在这个元素上：token 的 `.dark` / `.light` 块就是按 class 选择器
    // 给整套色板，所以子树换明暗不需要额外作用域类 —— 规范名本身即变量本体，
    // 内联覆盖的那几条沿 DOM 树继承下去即可。
    resolvedMode.value,
    attrs.class as string | undefined,
  ),
);

/** class / style 已经单独合并过，其余 attrs（含事件监听）原样落到同一个元素 */
const wrapperAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs;
  return rest;
});

const wrapperStyle = computed(
  () =>
    ({
      ...(attrs.style as Record<string, string> | undefined),
      ...themeVars.value,
      ...cssVarsStyle.value,
    }) as CSSProperties,
);

provide(GLOBAL_CONFIG_KEY, config);
</script>

<template>
  <RekaConfigProvider
    :dir="config.dir"
    :locale="rekaLocale"
    :nonce="config.nonce"
    :scroll-body="config.scrollBody"
    :teleport-to="rekaTeleportTo"
    :use-id="config.useId"
  >
    <div
      v-bind="wrapperAttrs"
      :class="wrapperClass"
      :style="wrapperStyle"
      :data-theme="config.theme.preset"
      data-common-config-provider
      :data-config-locale="config.locale"
      :data-config-size="config.componentSize"
      :dir="config.dir"
    >
      <slot></slot>
    </div>
  </RekaConfigProvider>
</template>
