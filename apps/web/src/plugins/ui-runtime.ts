import { configureLayout } from '@antdv/layout-ui';
import { configureMenu } from '@antdv/menu-ui';
import { configureTabs } from '@antdv/tabs-ui';
import i18n from '~/locales';

/**
 * 只注入文案。
 *
 * 这里刻意不碰 `~/composables` / `~/stores`：`test/setup.ts` 会调用本函数，而 setup 比用例里的
 * `vi.mock` 先执行——被它摸过的模块之后 mock 不掉，那些替换 `~/composables` 的用例会集体变红。
 * 需要权限与请求层的表格局见 `plugins/table-runtime.ts`。
 */
export function configureUiKitRuntimes(): void {
  const t = (key: string, named?: Record<string, number | string>) =>
    i18n.global.t(key, named ?? {}) as string;

  configureLayout({ t });
  configureMenu({ t });
  configureTabs({ t });
}
