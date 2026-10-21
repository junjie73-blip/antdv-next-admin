import type { InjectionKey } from 'vue';

/** 权限判定：入参沿用 `v-permission` 的绑定值形状（单码或任一命中的码表） */
export type PermissionChecker = (value: null | string | string[]) => boolean;

/**
 * 权限判定的注入键。
 *
 * 迁移前 `ImportExport` 的两个按钮直接写 `v-permission="permissions[0]"`：那条指令由应用
 * 全局注册，判定走 pinia 权限 store。公共组件包既不能注册指令也不能引 store，
 * 于是改成注入式 —— 宿主 `provide(PERMISSION_CHECK, (value) => 有没有权限)` 就恢复原行为。
 *
 * 未注入时一律放行，与迁移前「宿主没注册这条指令」时的表现一致
 * （Vue 解析不到指令只告警，元素照常渲染），不会因为换包就悄悄少掉按钮。
 */
export const PERMISSION_CHECK: InjectionKey<PermissionChecker> = Symbol(
  'common-ui-permission-check',
);
