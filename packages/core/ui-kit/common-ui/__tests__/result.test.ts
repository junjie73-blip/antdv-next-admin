import { mount } from '@vue/test-utils';
import { h } from 'vue';

import { describe, expect, it } from 'vitest';

import Result from '../src/components/result/Result.vue';

type Status = '403' | '404' | '500' | 'error' | 'info' | 'success' | 'warning';

const CASES: { color: string; status: Status }[] = [
  { color: 'text-amber-500', status: '403' },
  { color: 'text-blue-500', status: '404' },
  { color: 'text-red-500', status: '500' },
  { color: 'text-red-500', status: 'error' },
  { color: 'text-blue-500', status: 'info' },
  { color: 'text-emerald-500', status: 'success' },
  { color: 'text-amber-500', status: 'warning' },
];

const icon = (wrapper: ReturnType<typeof mount>) =>
  wrapper.find(
    '[data-common-result] svg, [data-common-result] [class*="iconify"]',
  );

describe('Result', () => {
  it('默认是 info，整体居中', () => {
    const wrapper = mount(Result, { props: { title: '已提交' } });
    expect(wrapper.find('[data-common-result]').exists()).toBe(true);
    expect(wrapper.attributes('data-status')).toBe('info');
    expect(wrapper.classes().join(' ')).toContain('flex-col');
    expect(wrapper.text()).toContain('已提交');
  });

  it('success 画出 emerald 图标', () => {
    const wrapper = mount(Result, { props: { status: 'success' } });
    expect(wrapper.attributes('data-status')).toBe('success');
    expect(icon(wrapper).exists()).toBe(true);
    expect(wrapper.html()).toContain('text-emerald-500');
  });

  it('七个状态各自映射到预设配色', () => {
    for (const { color, status } of CASES) {
      const wrapper = mount(Result, { props: { status } });
      expect(wrapper.attributes('data-status')).toBe(status);
      expect(wrapper.html()).toContain(color);
    }
  });

  it('title 与 subTitle 分别渲染，副标题走 muted', () => {
    const wrapper = mount(Result, {
      props: { status: 'error', subTitle: '订单号不存在', title: '出错了' },
    });
    expect(wrapper.text()).toContain('出错了');
    expect(wrapper.find('.text-muted-foreground').text()).toBe(
      '订单号不存在',
    );
  });

  it('extra 插槽渲染成居中的操作行', () => {
    const wrapper = mount(Result, {
      props: { title: '完成' },
      slots: { extra: () => h('button', '返回列表') },
    });
    const row = wrapper.find('.mt-6');
    expect(row.classes()).toContain('justify-center');
    expect(row.find('button').text()).toBe('返回列表');
  });

  it('默认插槽渲染成整宽内容区', () => {
    const wrapper = mount(Result, {
      props: { title: '详情' },
      slots: { default: () => h('p', '补充信息') },
    });
    const area = wrapper.find('.mt-4.w-full');
    expect(area.classes()).toContain('w-full');
    expect(area.text()).toContain('补充信息');
  });

  it('没传的插槽不留空壳', () => {
    const wrapper = mount(Result, { props: { title: '详情' } });
    expect(wrapper.find('.mt-6').exists()).toBe(false);
    expect(wrapper.find('.w-full').exists()).toBe(false);
  });
});
