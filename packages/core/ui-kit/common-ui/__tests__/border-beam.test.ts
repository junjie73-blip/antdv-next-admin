import { mount } from '@vue/test-utils';

import { describe, expect, it } from 'vitest';

import BorderBeam from '../src/components/border-beam/BorderBeam.vue';

/** 组件把可配项写成根节点上的 CSS 变量，断言直接读内联样式串 */
function styleOf(target: { attributes: (name: string) => string | undefined }) {
  return target.attributes('style') ?? '';
}

const mountBeam = (props: Record<string, unknown> = {}) =>
  mount(BorderBeam, { props, slots: { default: '<p class="body">内容</p>' } });

describe('BorderBeam', () => {
  it('默认值：主色光带、25% 弧长、6 秒一圈、2px 粗细、半径跟随全局 token', () => {
    const wrapper = mountBeam();
    expect(styleOf(wrapper)).toContain('--bb-color: var(--app-primary)');
    expect(styleOf(wrapper)).toContain('--bb-size: 25%');
    expect(styleOf(wrapper)).toContain('--bb-tail: transparent');
    expect(styleOf(wrapper)).toContain('border-radius: var(--app-border-radius)');
    expect(styleOf(wrapper.find('.border-beam__ring'))).toContain('padding: 2px');
    expect(styleOf(wrapper.find('.border-beam__spin'))).toContain(
      'animation-duration: 6s',
    );
  });

  it('颜色、时长、边框宽度都可配', () => {
    const wrapper = mountBeam({
      borderWidth: 6,
      color: '#ff0000',
      duration: 12,
      size: 40,
      tailColor: '#00ff00',
    });
    expect(styleOf(wrapper)).toContain('--bb-color: #ff0000');
    expect(styleOf(wrapper)).toContain('--bb-tail: #00ff00');
    expect(styleOf(wrapper)).toContain('--bb-size: 40%');
    expect(styleOf(wrapper.find('.border-beam__ring'))).toContain('padding: 6px');
    expect(styleOf(wrapper.find('.border-beam__spin'))).toContain(
      'animation-duration: 12s',
    );
  });

  it('delay 落到动画延迟上，负值同样原样写入', () => {
    const wrapper = mountBeam({ delay: -3 });
    expect(styleOf(wrapper.find('.border-beam__spin'))).toContain(
      'animation-delay: -3s',
    );
  });

  it('radius：数字按 px，字符串交给 CSS 自己解释', () => {
    expect(styleOf(mountBeam({ radius: 16 }))).toContain('border-radius: 16px');
    expect(styleOf(mountBeam({ radius: '999px' }))).toContain(
      'border-radius: 999px',
    );
  });

  it('默认插槽渲染正文，光带层不带无障碍语义', () => {
    const wrapper = mountBeam();
    expect(wrapper.find('p.body').text()).toBe('内容');
    expect(wrapper.find('.border-beam__ring').attributes('aria-hidden')).toBe(
      'true',
    );
  });

  it('class 与 style 合到根节点，不覆盖组件自己的圆角与变量', () => {
    const wrapper = mount(BorderBeam, {
      props: { class: 'w-64', style: { color: 'rgb(1, 2, 3)' } },
    });
    expect(wrapper.classes()).toContain('w-64');
    expect(wrapper.classes()).toContain('relative');
    expect(styleOf(wrapper)).toContain('color: rgb(1, 2, 3)');
    expect(styleOf(wrapper)).toContain('border-radius: var(--app-border-radius)');
  });

  it('调用方传 border 工具类时，钩子类不会被 tailwind-merge 吃掉', () => {
    const wrapper = mountBeam({ class: 'border border-border bg-card' });
    expect(wrapper.classes()).toContain('border-beam');
  });
});
