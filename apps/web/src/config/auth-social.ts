import type { AuthSocialItem } from '@antdv/common-ui';

import { h } from 'vue';

import { SvgIcon } from '@antdv/icons';

/**
 * 登录 / 注册页共用的第三方入口列表。
 *
 * 四枚图标是宿主自带的 SVG（`src/assets/icons/`，由 `vite-plugin-svg-icons` 打成
 * `#icon-<文件名>` 雪碧图，注册脚本在 `main.ts` 的 `virtual:svg-icons-register`），
 * 不在 iconify 的离线集里，所以走 `AuthSocialItem.icon` 的组件形态。
 *
 * `size: 18` 必须给：`SvgIcon` 的宽高写在内联 style 上，`AuthSocialLogin` 外层给的
 * `size-[18px]` 类名压不过它，只给类名会退成默认的 16px。
 */
function spriteIcon(name: string) {
  return () => h(SvgIcon, { name, size: 18 });
}

export const AUTH_SOCIAL_ITEMS: AuthSocialItem[] = [
  { icon: spriteIcon('github'), label: 'GitHub', value: 'github' },
  { icon: spriteIcon('wechat'), label: 'WeChat', value: 'wechat' },
  { icon: spriteIcon('qq'), label: 'QQ', value: 'qq' },
  { icon: spriteIcon('google'), label: 'Google', value: 'google' },
];
