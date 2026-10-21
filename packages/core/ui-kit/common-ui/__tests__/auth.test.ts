import { mount } from '@vue/test-utils';
import { h } from 'vue';

import { describe, expect, it } from 'vitest';

import AuthColorPresets from '../src/components/auth/AuthColorPresets.vue';
import AuthFormPanel from '../src/components/auth/AuthFormPanel.vue';
import AuthPageLayout from '../src/components/auth/AuthPageLayout.vue';
import AuthSocialLogin from '../src/components/auth/AuthSocialLogin.vue';

/**
 * 弹层管线（reka 的开合、teleport 到 body）由 shadcn-ui 自己的用例负责；
 * 这里只关心色块的渲染与抛出，所以把 Content/Item 换成同结构的裸元素，
 * 让 `:class`、`data-auth` 和 `@click` 原样落到按钮上。
 */
const mountPresets = (props: Record<string, any>) =>
  mount(AuthColorPresets, {
    global: {
      stubs: {
        DropdownMenuContent: { template: '<div><slot /></div>' },
        DropdownMenuItem: {
          template: '<button type="button"><slot /></button>',
        },
      },
    },
    props,
  });

describe('authPageLayout', () => {
  it('三段式骨架：品牌栏、表单栏、logo 与工具条各有数据钩子', () => {
    const wrapper = mount(AuthPageLayout, { props: { appName: 'Antdv' } });
    expect(wrapper.find('[data-auth="page"]').exists()).toBe(true);
    expect(wrapper.find('[data-auth="brand"]').exists()).toBe(true);
    expect(wrapper.find('[data-auth="panel"]').exists()).toBe(true);
    expect(wrapper.find('[data-auth="logo"]').exists()).toBe(true);
    expect(wrapper.find('[data-auth="toolbar"]').exists()).toBe(true);
  });

  it('showSlogan / showToolbar 关掉对应区块', () => {
    const wrapper = mount(AuthPageLayout, {
      props: { showSlogan: false, showToolbar: false },
    });
    expect(wrapper.find('[data-auth="brand"]').exists()).toBe(false);
    expect(wrapper.find('[data-auth="toolbar"]').exists()).toBe(false);
  });

  it('默认插槽落在右栏，工具条插槽落在 toolbar', () => {
    const wrapper = mount(AuthPageLayout, {
      props: { appName: 'Antdv' },
      slots: {
        default: () => h('div', { 'data-hook': 'form' }, '表单'),
        toolbar: () => h('div', { 'data-hook': 'tool' }, '工具'),
      },
    });
    expect(
      wrapper.find('[data-auth="panel"] [data-hook="form"]').exists(),
    ).toBe(true);
    expect(
      wrapper.find('[data-auth="toolbar"] [data-hook="tool"]').exists(),
    ).toBe(true);
  });

  it('pageTitle / pageDescription 渲染进品牌栏，两者皆空时不留空容器', () => {
    const withCopy = mount(AuthPageLayout, {
      props: { pageDescription: '描述', pageTitle: '标题' },
    });
    expect(withCopy.find('[data-auth="brand"]').text()).toContain('标题');
    expect(withCopy.find('[data-auth="brand"]').text()).toContain('描述');

    const bare = mount(AuthPageLayout, { props: { sloganImage: '/a.png' } });
    expect(bare.find('h1').exists()).toBe(false);
  });

  it('sloganImage 换掉底部插画，缺省时退成纯 CSS 的界面示意', () => {
    const withImage = mount(AuthPageLayout, {
      props: { sloganImage: '/slogan.png' },
    });
    expect(withImage.find('[data-auth="slogan-image"]').attributes('src')).toBe(
      '/slogan.png',
    );
    expect(withImage.find('[data-auth="slogan-visual"]').exists()).toBe(false);

    const bare = mount(AuthPageLayout);
    expect(bare.find('[data-auth="slogan-visual"]').exists()).toBe(true);
  });

  it('sloganVisual 插槽只换插画，标题区照常', () => {
    const slotted = mount(AuthPageLayout, {
      props: { pageTitle: '标题' },
      slots: {
        sloganVisual: () => h('div', { 'data-hook': 'visual' }, '自定义'),
      },
    });
    expect(slotted.find('[data-hook="visual"]').exists()).toBe(true);
    expect(slotted.find('[data-auth="slogan-visual"]').exists()).toBe(false);
    expect(slotted.find('h1').text()).toBe('标题');
  });

  it('features 逐条渲染成胶囊，空数组时不留容器', () => {
    const wrapper = mount(AuthPageLayout, {
      props: {
        features: [
          { icon: 'carbon:flash', label: '极速开发体验' },
          { icon: 'carbon:security', label: '企业级安全保障' },
        ],
      },
    });
    const pills = wrapper.findAll('[data-auth="brand-feature"]');
    expect(pills).toHaveLength(2);
    expect(pills[0]!.text()).toBe('极速开发体验');

    const bare = mount(AuthPageLayout);
    expect(bare.find('[data-auth="brand-features"]').exists()).toBe(false);
  });

  it('品牌栏的主色铭牌挂在 slogan-mark 上（端到端拿它和主按钮比对色链路）', () => {
    const wrapper = mount(AuthPageLayout);
    expect(wrapper.find('[data-auth="slogan-mark"]').classes()).toContain(
      'bg-primary',
    );
  });

  it('版权与备案成页脚两行，icpLink 存在时备案变成外链', () => {
    const wrapper = mount(AuthPageLayout, {
      props: {
        copyright: 'Antdv 2026',
        icp: '京ICP备000号',
        icpLink: 'https://beian.miit.gov.cn',
      },
    });
    const footer = wrapper.find('[data-auth="footer"]');
    expect(footer.text()).toContain('Copyright ©');
    expect(footer.text()).toContain('Antdv 2026');
    expect(footer.find('a').attributes('href')).toBe(
      'https://beian.miit.gov.cn',
    );

    const plain = mount(AuthPageLayout, { props: { icp: '京ICP备000号' } });
    expect(plain.find('[data-auth="footer"] a').exists()).toBe(false);
  });

  it('三项页脚信息都为空时不渲染页脚', () => {
    const wrapper = mount(AuthPageLayout);
    expect(wrapper.find('[data-auth="footer"]').exists()).toBe(false);
  });

  it('appLogo 有值时左上用图片，否则用主色方块', () => {
    const withLogo = mount(AuthPageLayout, {
      props: { appLogo: '/logo.png', appName: 'Antdv' },
    });
    expect(withLogo.find('[data-auth="logo"] img').attributes('src')).toBe(
      '/logo.png',
    );

    const tile = mount(AuthPageLayout, { props: { appName: 'Antdv' } });
    expect(tile.find('[data-auth="logo"] img').exists()).toBe(false);
    expect(tile.find('[data-auth="logo"]').text()).toBe('Antdv');
  });
});

describe('authFormPanel', () => {
  it('标题与描述各自可选', () => {
    const full = mount(AuthFormPanel, {
      props: { description: '描述', title: '欢迎回来' },
    });
    expect(full.find('[data-auth="form-title"]').text()).toBe('欢迎回来');
    expect(full.find('[data-auth="form-desc"]').text()).toBe('描述');

    const titleOnly = mount(AuthFormPanel, { props: { title: '登录' } });
    expect(titleOnly.find('[data-auth="form-desc"]').exists()).toBe(false);

    const bare = mount(AuthFormPanel);
    expect(bare.find('[data-auth="form-title"]').exists()).toBe(false);
  });

  it('默认插槽落在标题区之后，extra 插槽落在标题区内', () => {
    const wrapper = mount(AuthFormPanel, {
      props: { title: '登录' },
      slots: {
        default: () => h('form'),
        extra: () => h('div', { 'data-hook': 'extra' }, '附加'),
      },
    });
    expect(wrapper.find('[data-hook="extra"]').exists()).toBe(true);
    expect(wrapper.find('form').exists()).toBe(true);
  });
});

describe('authSocialLogin', () => {
  const items = [
    { icon: 'mdi:github', label: 'GitHub', value: 'github' },
    { icon: 'mdi:wechat', label: 'WeChat', value: 'wechat' },
  ];

  it('没有条目时整块不渲染', () => {
    const wrapper = mount(AuthSocialLogin, { props: { items: [] } });
    expect(wrapper.find('[data-auth="social"]').exists()).toBe(false);
  });

  it('每个条目一个圆形按钮，dividerText 缺省时只留图标行', () => {
    const wrapper = mount(AuthSocialLogin, {
      props: { dividerText: '其他登录方式', items },
    });
    expect(wrapper.findAll('button')).toHaveLength(2);
    expect(wrapper.text()).toContain('其他登录方式');

    const noDivider = mount(AuthSocialLogin, { props: { items } });
    expect(noDivider.findAll('button')).toHaveLength(2);
    expect(noDivider.text()).toBe('');
  });

  it('点击条目抛出该条目本身', async () => {
    const wrapper = mount(AuthSocialLogin, { props: { items } });
    await wrapper.findAll('button')[1]!.trigger('click');
    expect(wrapper.emitted('select')).toEqual([[items[1]]]);
  });

  it('icon 给字符串走 iconify，给组件则原样渲染并带上同一个尺寸类', () => {
    const Sprite = () => h('svg', { 'data-sprite': 'wechat' });
    const wrapper = mount(AuthSocialLogin, {
      props: {
        items: [
          { icon: 'mdi:github', label: 'GitHub', value: 'github' },
          { icon: Sprite, label: 'WeChat', value: 'wechat' },
        ],
      },
    });
    const iconify = wrapper.findAll('button')[0]!;
    const component = wrapper.findAll('button')[1]!;
    expect(component.find('[data-sprite="wechat"]').exists()).toBe(true);
    expect(component.find('svg').classes()).toContain('size-[18px]');
    expect(iconify.find('[data-sprite]').exists()).toBe(false);
  });
});

describe('authColorPresets', async () => {
  const presets = [
    { color: '#1677ff', key: 'default' },
    { color: '#722ed1', key: 'purple' },
  ];

  it('触发点用 label 作无障碍名，并把当前色写成内联底色', async () => {
    const wrapper = mountPresets({
      current: '#722ed1',
      label: '主题色',
      presets,
    });
    const trigger = wrapper.find('[data-auth="color-presets-trigger"]');
    expect(trigger.attributes('aria-label')).toBe('主题色');
    expect(trigger.find('span').attributes('style')).toContain(
      'background: rgb(114, 46, 209)',
    );
  });

  it('每个预设一颗色块，点击抛出该预设', async () => {
    const wrapper = mountPresets({ presets });
    const swatches = wrapper.findAll('[data-auth^="color-preset-"]');
    expect(swatches).toHaveLength(2);

    await swatches[0]!.trigger('click');
    expect(wrapper.emitted('select')).toEqual([[presets[0]]]);
  });

  it('current 命中预设时只给那一颗加主色描边', async () => {
    const wrapper = mountPresets({ current: '#722ed1', presets });
    expect(
      wrapper.find('[data-auth="color-preset-purple"]').classes(),
    ).toContain('ring-primary');
    expect(
      wrapper.find('[data-auth="color-preset-default"]').classes(),
    ).not.toContain('ring-primary');
  });

  it('current 写成 rgb() 也能对上十六进制预设', async () => {
    const wrapper = mountPresets({ current: 'rgb(114, 46, 209)', presets });
    expect(
      wrapper.find('[data-auth="color-preset-purple"]').classes(),
    ).toContain('ring-primary');
  });

  it('对不上的色值（取色器自定义色）一颗都不高亮', async () => {
    const wrapper = mountPresets({ current: '#ff0000', presets });
    const ringed = wrapper
      .findAll('[data-auth^="color-preset-"]')
      .filter((swatch) => swatch.classes().includes('ring-primary'));
    expect(ringed).toHaveLength(0);
  });
});
