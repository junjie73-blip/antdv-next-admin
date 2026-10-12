import type { MenuConfig } from '@antdv/types';

/** 查不到译文时返回 undefined，由调用方决定回退什么 */
export type MenuTranslator = (key: string) => string | undefined;

/**
 * 后端菜单的 `menuName` 是中文常量，不是 i18n key，所以按菜单 `name`
 * （= 路由 name，稳定英文标识）到文案表的 `menu.<Name>` 下找译文。
 *
 * 查不到就照原样显示后端标题：新增一个菜单、还没补译文时，导航里是一条
 * 能看懂的中文，而不是渲染出 `menu.NewPage` 这种 key。
 */
export function localizeMenus(
  menus: MenuConfig[],
  translate: MenuTranslator,
): MenuConfig[] {
  return menus.map((menu) => {
    const title = (menu.name && translate(`menu.${menu.name}`)) || menu.title;
    return {
      ...menu,
      children: menu.children
        ? localizeMenus(menu.children, translate)
        : menu.children,
      title,
    };
  });
}
