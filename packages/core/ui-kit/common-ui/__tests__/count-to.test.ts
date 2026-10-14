import { mount } from '@vue/test-utils';

import { describe, expect, it } from 'vitest';

import CountTo from '../src/components/count-to/CountTo.vue';

// autoplay=false：不触发 useRafFn，displayValue 恒等于 startVal 的格式化结果，
// 便于对 props/格式化/暴露方法做确定性断言。
const mountStatic = (props: Record<string, unknown>) =>
  mount(CountTo, { props: { autoplay: false, ...props } });

describe('CountTo', () => {
  it('默认渲染起始值 0', () => {
    const wrapper = mountStatic({});
    expect(wrapper.text()).toBe('0');
    expect(wrapper.find('span.count-to').exists()).toBe(true);
  });

  it('千分位分隔符', () => {
    expect(mountStatic({ startVal: 1_000_000 }).text()).toBe('1,000,000');
  });

  it('前缀/后缀/小数位组合', () => {
    const wrapper = mountStatic({
      decimals: 2,
      prefix: '$',
      startVal: 0,
      suffix: '!',
    });
    expect(wrapper.text()).toBe('$0.00!');
  });

  it('自定义 separator 与 decimal 符号', () => {
    const wrapper = mountStatic({
      decimal: ',',
      decimals: 1,
      separator: '.',
      startVal: 1234.5,
    });
    // 1234.5 → "1.234,5"
    expect(wrapper.text()).toBe('1.234,5');
  });

  it('className / style 透传到根 span', () => {
    const wrapper = mountStatic({
      className: 'my-count',
      style: { color: 'red' },
    });
    const span = wrapper.find('span.count-to');
    expect(span.classes()).toContain('my-count');
    expect(span.attributes('style')).toContain('color');
  });

  it('暴露 start/pause/reset/getCurrentValue 实例方法', () => {
    const wrapper = mountStatic({ endVal: 100, startVal: 5 });
    const vm = wrapper.vm as unknown as {
      getCurrentValue: () => number;
      pause: () => void;
      reset: () => void;
      start: () => void;
    };
    expect(typeof vm.start).toBe('function');
    expect(typeof vm.pause).toBe('function');
    expect(typeof vm.reset).toBe('function');
    expect(vm.getCurrentValue()).toBe(5);
    vm.reset();
    expect(vm.getCurrentValue()).toBe(5);
  });

  it('autoplay=true 挂载后不抛错（raf 正常调度）', () => {
    expect(() => mount(CountTo, { props: { autoplay: true, endVal: 10 } })).not.toThrow();
  });
});
