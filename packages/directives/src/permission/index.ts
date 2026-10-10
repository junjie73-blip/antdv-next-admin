import type {
  DirectiveBinding,
  ObjectDirective,
} from 'vue';

import type {
  PermissionBindingLike,
  PermissionDirectiveOptions,
  PermissionDirectiveValue,
} from './types';
import type { PermissionElementState } from './utils';

import {
  applyPermissionState,
  DEFAULT_PERMISSION_CLASS,
  isBindingChanged,
  isDomInSync,
  resolveAccess,
} from './utils';

/**
 * 元素状态用 WeakMap 挂，不往 DOM 元素上塞 `_permission` 这种魔法字段：
 * 属性名会和别的库撞，而且 JSON 序列化 / 结构化克隆时会把函数一起炸出来。
 */
const stateMap = new WeakMap<HTMLElement, PermissionElementState>();

function snapshot(
  binding: DirectiveBinding<PermissionDirectiveValue>,
): PermissionBindingLike {
  return {
    arg: binding.arg,
    modifiers: { ...binding.modifiers },
    value: binding.value,
  };
}

/**
 * 创建 v-permission 指令。
 *
 * 用法（应用侧）：
 * ```ts
 * const permission = createPermissionDirective({
 *   checkers: () => usePermission(),           // 惰性取 store
 *   onCheck: (ctx) => import.meta.env.DEV && console.log('[v-permission]', ctx),
 *   subscribe: (notify) => watch(() => useUserStore().permissions, notify, { deep: true }),
 * });
 * app.directive('permission', permission);
 * ```
 *
 * 模板：
 * - `v-permission="'user:add'"` 单权限
 * - `v-permission="['a','b']"` 任一命中；`v-permission.all="['a','b']"` 全部命中
 * - `v-permission.role="'admin'"` / `v-permission.admin` 走角色与管理员通道
 * - `v-permission.disabled="'user:add'"` 无权限时置灰而不是隐藏
 */
export function createPermissionDirective(
  options: PermissionDirectiveOptions,
): ObjectDirective<HTMLElement, PermissionDirectiveValue> {
  const className = options.className ?? DEFAULT_PERMISSION_CLASS;

  const getCheckers = () =>
    typeof options.checkers === 'function' ? options.checkers() : options.checkers;

  function evaluate(
    el: HTMLElement,
    state: PermissionElementState,
    force = false,
  ): void {
    const hasAccess = resolveAccess(state.binding, getCheckers());

    // 幂等短路：声明没变且 DOM 已经是对的，就不必再写 style/class
    if (
      !force &&
      !isBindingChanged(state.prev, state.binding) &&
      isDomInSync(el, hasAccess, state, className)
    ) {
      return;
    }

    options.onCheck?.({
      arg: state.binding.arg,
      hasAccess,
      modifiers: state.binding.modifiers ?? {},
      value: state.binding.value,
    });

    applyPermissionState(el, hasAccess, state, className);
    state.prev = { arg: state.binding.arg, value: state.binding.value };
  }

  return {
    mounted(el, binding) {
      const state: PermissionElementState = {
        binding: snapshot(binding),
        disabledMode: binding.modifiers?.disabled === true,
        originalDisplay: el.style.display,
        prev: null,
        stop: null,
      };
      stateMap.set(el, state);

      // 首次无条件应用
      evaluate(el, state, true);

      /**
       * ⭐ 订阅权限数据源。
       * 原来这里硬编码 `watch(() => useUserStore().permissions)`：
       * 包因此绑死了一个 store，且 mounted 时机早于登录态回填时，
       * 按钮会永远停在「无权限」。现在由应用注入自己的数据源变化通知。
       */
      state.stop = options.subscribe?.(() => evaluate(el, state, true)) ?? null;
    },

    updated(el, binding) {
      const state = stateMap.get(el);
      if (!state) return;

      // 永远保留最新 binding：订阅回调要按当下的声明判定
      state.binding = snapshot(binding);
      state.disabledMode = binding.modifiers?.disabled === true;
      evaluate(el, state);
    },

    unmounted(el) {
      const state = stateMap.get(el);
      state?.stop?.();
      stateMap.delete(el);
    },
  };
}

export * from './types';
export * from './utils';
