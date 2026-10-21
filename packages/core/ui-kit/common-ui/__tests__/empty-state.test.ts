import { mount } from '@vue/test-utils';
import { h } from 'vue';

import { describe, expect, it } from 'vitest';

import EmptyState from '../src/components/empty-state/EmptyState.vue';

describe('emptyState', () => {
  it('默认标题为「暂无数据」，无 description 时不渲染副标题段', () => {
    const wrapper = mount(EmptyState);
    expect(wrapper.text()).toContain('暂无数据');
    // 只有 title 一个 <p>
    expect(wrapper.findAll('p')).toHaveLength(1);
  });

  it('传入 description 后渲染第二段', () => {
    const wrapper = mount(EmptyState, { props: { description: '再等等' } });
    expect(wrapper.text()).toContain('再等等');
    expect(wrapper.findAll('p')).toHaveLength(2);
  });

  it('自定义 title 覆盖默认文案', () => {
    const wrapper = mount(EmptyState, { props: { title: '空空如也' } });
    expect(wrapper.text()).toContain('空空如也');
    expect(wrapper.text()).not.toContain('暂无数据');
  });

  it('渲染图标（IconifyIcon 输出 svg）', () => {
    const wrapper = mount(EmptyState);
    expect(wrapper.find('svg').exists()).toBe(true);
  });

  it('default 插槽内容渲染在文案之后', () => {
    const wrapper = mount(EmptyState, {
      slots: { default: () => h('button', { class: 'cta' }, '去创建') },
    });
    expect(wrapper.find('.cta').exists()).toBe(true);
    expect(wrapper.text()).toContain('去创建');
  });
});
