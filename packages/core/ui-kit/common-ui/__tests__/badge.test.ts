import { mount } from '@vue/test-utils';
import { h } from 'vue';

import { describe, expect, it } from 'vitest';

import Badge from '../src/components/badge/Badge.vue';

const bubble = (wrapper: ReturnType<typeof mount>) =>
  wrapper.find('[data-common-badge-dot]');

describe('badge', () => {
  it('count 直接渲染进气泡', () => {
    const wrapper = mount(Badge, { props: { count: 3 } });
    expect(wrapper.find('[data-common-badge]').exists()).toBe(true);
    expect(bubble(wrapper).text()).toBe('3');
  });

  it('超过 max 折叠成 `${max}+`，等于 max 时不折叠', () => {
    expect(bubble(mount(Badge, { props: { count: 100 } })).text()).toBe('99+');
    expect(
      bubble(mount(Badge, { props: { count: 100, max: 10 } })).text(),
    ).toBe('10+');
    expect(bubble(mount(Badge, { props: { count: 99 } })).text()).toBe('99');
  });

  it('count=0 时不画气泡，与迁移前一致', () => {
    const wrapper = mount(Badge, { props: { count: 0 } });
    expect(bubble(wrapper).exists()).toBe(false);
  });

  it('show=false 隐藏气泡', () => {
    const wrapper = mount(Badge, { props: { count: 5, show: false } });
    expect(bubble(wrapper).exists()).toBe(false);
  });

  it('dot 模式只画小圆点不带文字', () => {
    const wrapper = mount(Badge, { props: { dot: true } });
    expect(bubble(wrapper).exists()).toBe(true);
    expect(bubble(wrapper).text()).toBe('');
    expect(bubble(wrapper).classes()).toContain('size-2');
  });

  it('status 模式渲染状态点与 text', () => {
    const wrapper = mount(Badge, {
      props: { status: 'processing', text: '进行中' },
    });
    expect(wrapper.text()).toContain('进行中');
    expect(bubble(wrapper).classes().join(' ')).toContain('animate-pulse');
  });

  it('offset 换成气泡的 margin', () => {
    const wrapper = mount(Badge, {
      props: { count: 1, offset: [12, 4] },
    });
    const style = bubble(wrapper).attributes('style') ?? '';
    expect(style).toContain('margin-left: 12px');
    expect(style).toContain('margin-top: 4px');
  });

  it('numberStyle 原样透传到气泡内联样式', () => {
    const wrapper = mount(Badge, {
      props: { count: 2, numberStyle: { fontSize: '10px' } },
    });
    expect(bubble(wrapper).attributes('style')).toContain('font-size: 10px');
  });

  it('color 覆盖气泡底色', () => {
    const wrapper = mount(Badge, { props: { count: 2, color: '#722ed1' } });
    expect(bubble(wrapper).attributes('style')).toContain(
      'background-color: rgb(114, 46, 209)',
    );
  });

  it('有默认插槽时贴角定位，没有时独立行内', () => {
    const hugged = mount(Badge, {
      props: { count: 1 },
      slots: { default: () => h('span', '消息') },
    });
    expect(hugged.text()).toContain('消息');
    expect(hugged.classes()).toContain('relative');
    expect(bubble(hugged).classes()).toContain('absolute');

    const alone = mount(Badge, { props: { count: 1 } });
    expect(bubble(alone).classes()).not.toContain('absolute');
    expect(bubble(alone).classes()).toContain('inline-flex');
  });
});
