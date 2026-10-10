import { createApp } from 'vue';

import {
  createUiInstaller,
  IconifyIcon,
  IconPicker,
  Loading,
  SvgIcon,
  vLoading,
} from '../src';

/**
 * 安装器只验"注册表内容"，不真挂载：
 * 全局注册的意义就在于名字稳定，页面里裸写 `<IconifyIcon />` / `v-loading` 能命中。
 */
describe('createUiInstaller', () => {
  function installed(prefix?: string) {
    const app = createApp({ render: () => null });
    app.use(createUiInstaller(prefix === undefined ? undefined : { prefix }));
    return app;
  }

  it('默认不加前缀时，组件与指令用本名注册', () => {
    const app = installed();
    for (const [name, component] of [
      ['IconPicker', IconPicker],
      ['IconifyIcon', IconifyIcon],
      ['Loading', Loading],
      ['SvgIcon', SvgIcon],
    ] as const) {
      expect(app.component(name)).toBe(component);
    }
    expect(app.directive('loading')).toBe(vLoading);
  });

  it('prefix 会同时作用于组件与指令，便于避让既有项目的同名全局组件', () => {
    const app = installed('ui');
    expect(app.component('uiIconifyIcon')).toBe(IconifyIcon);
    expect(app.directive('uiloading')).toBe(vLoading);
    expect(app.component('IconifyIcon')).toBeUndefined();
  });
});
