import { configureLayout } from '@antdv/layout-ui';
import { configureMenu } from '@antdv/menu-ui';
import { configureTabs } from '@antdv/tabs-ui';
import i18n from '~/locales';

export function configureUiKitRuntimes(): void {
  const t = (key: string, named?: Record<string, number | string>) =>
    i18n.global.t(key, named ?? {}) as string;

  configureLayout({ t });
  configureMenu({ t });
  configureTabs({ t });
}
