import { mount } from '@vue/test-utils';
import { h, nextTick } from 'vue';
import { toast } from 'vue-sonner';

import { afterEach, describe, expect, it } from 'vitest';

import Toaster from '../src/components/toast/Toaster.vue';

/**
 * 这一层只做一件事：把主题变量、部件类名和四枚状态徽标盖到 vue-sonner 上。
 * 弹层的堆叠/滑出/暂停计时是 vue-sonner 自己的事，不在这里测。
 *
 * jsdom 不跑 CSS，所以能测的是"样式声明有没有落到正确的宿主元素上"
 * （变量写在 `[data-sonner-toaster]` 的 style 上、徽标包在 `[data-icon]` 里），
 * 真实像素与明暗对比交给浏览器端的 e2e 兜。
 */
const flush = async () => {
  await nextTick();
  await nextTick();
};

afterEach(() => {
  // ToastState 是模块级单例：不清掉，上一条用例的 toast 会混进下一条里
  toast.dismiss();
});

describe('Toaster —— 主题覆写层', () => {
  it('钩子类与主题变量落在容器上，底色只有一套中性值', async () => {
    const wrapper = mount(Toaster);
    const toaster = wrapper.find('[data-sonner-toaster]');
    expect(toaster.classes()).toContain('antdv-toaster');

    const { style } = toaster.element as HTMLElement;
    expect(style.getPropertyValue('--normal-bg')).toBe('var(--app-popover)');
    expect(style.getPropertyValue('--normal-border')).toBe('var(--app-border)');
    expect(style.getPropertyValue('--border-radius')).toBe(
      'var(--app-border-radius)',
    );

    /*
     * 富色必须关着：打开后 sonner 会把整块底色染成 `--{type}-bg`，
     * 并把描述的颜色改成 inherit，正文跟着变彩、对比度掉下来。
     */
    toast.success('内容');
    await flush();
    expect(
      wrapper.find('[data-sonner-toast]').attributes('data-rich-colors'),
    ).toBe('false');
  });

  it('宿主给的 style 排在默认变量之后，同名变量能覆盖', () => {
    const wrapper = mount(Toaster, {
      props: { style: { '--normal-bg': 'green' } },
    });
    const { style } = wrapper
      .find('[data-sonner-toaster]')
      .element as HTMLElement;
    expect(style.getPropertyValue('--normal-bg')).toBe('green');
  });

  it('props 原样透传，容器不吞任何既有配置', async () => {
    const wrapper = mount(Toaster, {
      props: { position: 'bottom-left', visibleToasts: 2, gap: 12 },
    });
    toast.info('内容');
    await flush();

    const toaster = wrapper.find('[data-sonner-toaster]');
    expect(toaster.attributes('data-y-position')).toBe('bottom');
    expect(toaster.attributes('data-x-position')).toBe('left');
    /*
     * `gap` / `visibleToasts` 是内部状态用的，DOM 上只能看到它换算出的
     * `--gap`；堆叠上限不体现在标记上，所以这里只验证值进了组件而不是被丢掉。
     */
    expect(toaster.element.getAttribute('style')).toContain('--gap: 12px');
    expect(wrapper.findAll('[data-sonner-toast]')).toHaveLength(1);
  });

  it('宿主的 toast-options 与默认部件类逐档合并，宿主优先', async () => {
    const wrapper = mount(Toaster, {
      props: {
        toastOptions: { classes: { title: 'host-title' } },
      },
    });
    toast.error('标题', { description: '描述' });
    await flush();

    // 宿主只配了 title，icon/description/closeButton 三档默认值不能被整体替换掉
    expect(wrapper.find('[data-icon]').classes()).toContain('size-5!');
    expect(wrapper.find('[data-description]').classes()).toContain(
      'text-muted-foreground!',
    );
    expect(wrapper.find('[data-title]').classes()).toContain('host-title');
  });

  it('四枚状态徽标是实色圆底，感叹号与信息符不带外框', async () => {
    const wrapper = mount(Toaster);
    for (const type of ['success', 'info', 'warning', 'error'] as const) {
      toast[type](`内容-${type}`);
    }
    await flush();

    const badgeClass = {
      error: 'bg-destructive',
      info: 'bg-info',
      success: 'bg-success',
      warning: 'bg-warning',
    } as const;

    for (const type of ['success', 'info', 'warning', 'error'] as const) {
      const badge = wrapper.find(
        `[data-type='${type}'] [data-icon] > span`,
      ).element as HTMLElement;
      expect(badge.className, `${type} 少了徽标容器`).toContain('rounded-full');
      expect(badge.className).toContain(badgeClass[type]);
      expect(badge.className).toContain('text-white');
    }

    /*
     * lucide 的 `Info` / `CircleAlert` 自带一圈，画进圆底就是框中框，
     * 所以这两枚是手写的"竖笔 + 端点"两段 path，且不含任何闭合外形。
     */
    for (const type of ['info', 'warning'] as const) {
      const svg = wrapper.find(`[data-type='${type}'] [data-icon] svg`);
      expect(svg.findAll('path')).toHaveLength(2);
      expect(svg.find('circle').exists()).toBe(false);
      expect(svg.attributes('stroke-linecap')).toBe('round');
    }
  });

  it('加载中是转圈而不是圆徽，关闭按钮按朝向挂属性', async () => {
    const wrapper = mount(Toaster, {
      props: { closeButton: true, closeButtonPosition: 'top-right' },
    });
    toast.loading('处理中');
    await flush();

    const spinner = wrapper.find('[data-type=loading] [data-icon] svg');
    expect(spinner.classes()).toContain('animate-spin');
    expect(
      wrapper.find('[data-type=loading] [data-icon] > span').exists(),
    ).toBe(false);

    toast.dismiss();
    await flush();
    toast.info('带关闭按钮');
    await flush();
    const closeButton = wrapper.find('[data-close-button]');
    expect(closeButton.exists()).toBe(true);
    // Toaster.vue 样式块里的四条规则按这个属性分朝向，属性没了位移就失效
    expect(closeButton.attributes('data-close-button-position')).toBe(
      'top-right',
    );
  });

  it('宿主传同名插槽可以替换徽标，不必改这层源码', async () => {
    const wrapper = mount(Toaster, {
      slots: { 'success-icon': () => h('i', { 'data-custom-badge': '' }) },
    });
    toast.success('内容');
    await flush();

    expect(wrapper.find('[data-custom-badge]').exists()).toBe(true);
    expect(wrapper.find('[data-type=success] [data-icon] > span').exists()).toBe(
      false,
    );
  });
});
