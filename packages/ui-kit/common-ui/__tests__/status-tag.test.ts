import { mount } from '@vue/test-utils';

import { describe, expect, it } from 'vitest';

import StatusTag from '../src/components/status-tag/StatusTag.vue';

const tagClasses = (wrapper: ReturnType<typeof mount>) =>
  wrapper
    .find('[data-common-tag]')
    .attributes('class')
    ?.split(' ');

describe('StatusTag', () => {
  it('已知状态映射到语义标签与预设色（1→已完成/green）', () => {
    const wrapper = mount(StatusTag, { props: { status: '1' } });
    expect(wrapper.text()).toBe('已完成');
    // success → green 预设，落到 emerald 色板
    expect(tagClasses(wrapper)).toContain('bg-emerald-50');
  });

  it('processing 走 blue、warning 走 gold、error 走 red', () => {
    expect(tagClasses(mount(StatusTag, { props: { status: 'processing' } }))).toContain(
      'bg-blue-50',
    );
    expect(tagClasses(mount(StatusTag, { props: { status: '3' } }))).toContain(
      'bg-amber-50',
    );
    expect(tagClasses(mount(StatusTag, { props: { status: 'failed' } }))).toContain(
      'bg-red-50',
    );
  });

  it('未知状态回退：label 原样显示、颜色走 default', () => {
    const wrapper = mount(StatusTag, { props: { status: 'weird' } });
    expect(wrapper.text()).toBe('weird');
    expect(tagClasses(wrapper)).toContain('bg-gray-50');
  });

  it('空串 status 也命中兜底分支（isNil 守卫，label 为空）', () => {
    const wrapper = mount(StatusTag, { props: { status: '' } });
    expect(wrapper.text()).toBe('');
    expect(wrapper.find('[data-common-tag]').exists()).toBe(true);
  });

  it('type 属性透传不改变渲染（迁移前即为未使用的保留 prop）', () => {
    const a = mount(StatusTag, { props: { status: '1' } }).text();
    const b = mount(StatusTag, {
      props: { status: '1', type: 'workflow' },
    }).text();
    expect(a).toBe(b);
  });
});
