import type { VueWrapper } from '@vue/test-utils';

import { mount } from '@vue/test-utils';

import { Icon } from '@iconify/vue';

import { IconifyIcon, SvgIcon } from '../src/icon';

/**
 * 读取 `<use>` 的 symbol id。
 * 必须走原生 `getAttribute`：@vue/test-utils 的 `attributes()` 把命名空间属性的
 * 前缀吃掉了（`xlink:href` 变成 `href`），照它写断言会以为属性没生效。
 */
function symbolId(wrapper: VueWrapper) {
  return wrapper.element.querySelector('use')?.getAttribute('xlink:href');
}

/**
 * 图标组件的契约测试。
 *
 * 这两个组件在应用里以"裸标签"形式出现在几十个文件里，
 * 尺寸/翻转/雪碧图 id 的规则一旦改动，全站图标会一起歪，
 * 所以把这些规则钉死在这里，而不是靠肉眼回归。
 */

describe('SvgIcon —— 本地 SVG 雪碧图', () => {
  it('默认走 #icon-<name> 的 symbol id，16px 见方', () => {
    const wrapper = mount(SvgIcon, { props: { name: 'home' } });
    expect(symbolId(wrapper)).toBe('#icon-home');
    expect(wrapper.attributes('style')).toContain('width: 16px');
    expect(wrapper.attributes('style')).toContain('height: 16px');
    expect(wrapper.classes()).toContain('svg-icon');
  });

  it('prefix 可切换雪碧图分组，className 追加而不覆盖内置类', () => {
    const wrapper = mount(SvgIcon, {
      props: { className: 'text-red-500', name: 'logo', prefix: 'brand' },
    });
    expect(symbolId(wrapper)).toBe('#brand-logo');
    expect(wrapper.classes()).toEqual(['svg-icon', 'text-red-500']);
  });

  it('数字尺寸补 px，字符串尺寸原样透传（支持 2rem / 100%）', () => {
    expect(
      mount(SvgIcon, { props: { name: 'a', size: 24 } }).attributes('style'),
    ).toContain('width: 24px');

    expect(
      mount(SvgIcon, { props: { name: 'a', size: '2rem' } }).attributes('style'),
    ).toContain('width: 2rem');
  });

  it('color 落到行内样式，配合 currentColor 让 fill 跟随文本色', () => {
    const wrapper = mount(SvgIcon, { props: { color: '#08c', name: 'a' } });
    // #08c 是三值简写，等价于 #0088cc
    expect(wrapper.attributes('style')).toContain('color: rgb(0, 136, 204)');
    // 装饰性图标对读屏隐藏，避免出现"图标 + 文字"双份朗读
    expect(wrapper.attributes('aria-hidden')).toBe('true');
  });

  it('name 变化时 symbol id 跟着换，不需要重新挂载', async () => {
    const wrapper = mount(SvgIcon, { props: { name: 'one' } });
    await wrapper.setProps({ name: 'two' });
    expect(symbolId(wrapper)).toBe('#icon-two');
  });
});

describe('IconifyIcon —— Iconify 在线图标', () => {
  /**
   * 从组件自身推出 props 类型，改字段名时测试会先红，而不是静默传错属性。
   * @iconify/vue 在 jsdom 里不一定拉得到图标数据，所以断言只看透传下去的属性。
   */
  type IconProps = Partial<InstanceType<typeof IconifyIcon>['$props']> & {
    icon: string;
  };

  function forwardedProps(props: IconProps) {
    return mount(IconifyIcon, { props }).findComponent(Icon).props();
  }

  it('size 同时喂给宽高，保持 1:1', () => {
    const passed = forwardedProps({ icon: 'carbon:home', size: 20 });
    expect(passed.width).toBe(20);
    expect(passed.height).toBe(20);
  });

  it('宽高各自可覆盖，缺省的一边回退到 size', () => {
    const passed = forwardedProps({ height: 32, icon: 'carbon:home', size: 20 });
    expect(passed.width).toBe(20);
    expect(passed.height).toBe(32);
  });

  it('行内样式：color 直传，字号按最终尺寸换算', () => {
    const wrapper = mount(IconifyIcon, {
      props: { color: '#f00', icon: 'carbon:home', size: 18 },
    });
    const style = wrapper.findComponent(Icon).attributes('style') ?? '';
    expect(style).toContain('font-size: 18px');
    expect(style).toContain('color: rgb(255, 0, 0)');
  });

  it('翻转、旋转、模式、SSR 都按原样透传，不在中间层做取舍', () => {
    const passed = forwardedProps({
      horizontalFlip: true,
      icon: 'carbon:chevron-left',
      inline: true,
      mode: 'bg',
      rotate: 90,
      ssr: true,
      verticalFlip: true,
    });
    expect(passed).toMatchObject({
      horizontalFlip: true,
      icon: 'carbon:chevron-left',
      inline: true,
      mode: 'bg',
      rotate: 90,
      ssr: true,
      verticalFlip: true,
    });
  });

  it('className 落在渲染节点上，便于用 Tailwind 调大小与配色', () => {
    const wrapper = mount(IconifyIcon, {
      props: { className: 'text-lg', icon: 'carbon:home' },
    });
    expect(wrapper.findComponent(Icon).classes()).toContain('text-lg');
  });
});
