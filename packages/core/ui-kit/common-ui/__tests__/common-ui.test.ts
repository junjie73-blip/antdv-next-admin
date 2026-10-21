import { mount } from '@vue/test-utils';

import { describe, expect, it } from 'vitest';

import { Alert, Card, Divider, Space, Tag } from '../src';

describe('card', () => {
  it('标题与 extra 落在同一行，正文走默认插槽', () => {
    const wrapper = mount(Card, {
      props: { title: '任务列表' },
      slots: { default: '<p>正文</p>', extra: '<button>新增</button>' },
    });
    expect(wrapper.text()).toContain('任务列表');
    expect(wrapper.text()).toContain('正文');
    expect(wrapper.find('[data-slot="card-action"]').exists()).toBe(false);
    expect(wrapper.find('button').text()).toBe('新增');
  });

  it('borderless 去掉描边与投影', () => {
    const wrapper = mount(Card, { props: { variant: 'borderless' } });
    expect(wrapper.classes()).toContain('border-0');
    expect(wrapper.classes()).toContain('shadow-none');
  });

  it('没有标题也没有插槽时不画表头', () => {
    const wrapper = mount(Card, { slots: { default: '<p>正文</p>' } });
    expect(wrapper.find('[data-slot="card-header"]').exists()).toBe(false);
  });
});

describe('tag', () => {
  it('预设色名映射到对应色板', () => {
    const wrapper = mount(Tag, { props: { color: 'green' } });
    expect(wrapper.classes().join(' ')).toContain('text-emerald-600');
  });

  it('非预设色当作自定义底色', () => {
    const wrapper = mount(Tag, { props: { color: '#722ed1' } });
    expect(wrapper.attributes('style')).toContain(
      'background-color: rgb(114, 46, 209)',
    );
  });

  it('bordered=false 时不描边', () => {
    const wrapper = mount(Tag, { props: { bordered: false, color: 'red' } });
    expect(wrapper.classes()).toContain('border-transparent');
  });
});

describe('divider', () => {
  it('竖向走 separator 的 vertical 方向', () => {
    const wrapper = mount(Divider, { props: { type: 'vertical' } });
    expect(wrapper.attributes('data-orientation')).toBe('vertical');
  });

  it('带文字时文字夹在两段线中间', () => {
    const wrapper = mount(Divider, { slots: { default: '分组' } });
    expect(wrapper.text()).toBe('分组');
    expect(wrapper.findAll('span.h-px')).toHaveLength(2);
  });

  it('dashed 收成零高度改走边框', () => {
    const wrapper = mount(Divider, { props: { dashed: true } });
    expect(wrapper.classes().join(' ')).toContain('border-dashed');
  });
});

describe('space', () => {
  it('size 档位换成像素 gap', () => {
    expect(
      mount(Space, { props: { size: 'middle' } }).attributes('style'),
    ).toContain('gap: 16px');
    expect(mount(Space, { props: { size: 6 } }).attributes('style')).toContain(
      'gap: 6px',
    );
  });

  it('direction=vertical 换成列方向', () => {
    expect(
      mount(Space, { props: { direction: 'vertical' } }).classes(),
    ).toContain('flex-col');
  });
});

describe('alert', () => {
  it('error 用 destructive，其余按类型上色', () => {
    expect(
      mount(Alert, { props: { message: '失败', type: 'error' } })
        .classes()
        .join(' '),
    ).toContain('text-destructive');
    expect(
      mount(Alert, { props: { message: '提示', type: 'warning' } })
        .classes()
        .join(' '),
    ).toContain('border-amber-200');
  });

  it('message 与 description 分别落在标题与描述节点', () => {
    const wrapper = mount(Alert, {
      props: { description: '正文说明', message: '标题' },
    });
    expect(wrapper.find('[data-slot="alert-title"]').text()).toBe('标题');
    expect(wrapper.find('[data-slot="alert-description"]').text()).toBe(
      '正文说明',
    );
  });

  it('showIcon=false 时不留图标', () => {
    const wrapper = mount(Alert, {
      props: { message: '标题', showIcon: false },
    });
    expect(wrapper.find('svg').exists()).toBe(false);
  });
});
