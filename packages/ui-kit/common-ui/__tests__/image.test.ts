import { flushPromises, mount } from '@vue/test-utils';

import { describe, expect, it, vi } from 'vitest';

import Image from '../src/components/image/Image.vue';

const previewOverlay = () =>
  document.body.querySelector('[data-common-image-preview]');

describe('Image', () => {
  it('src / alt / 数字宽高落到 img', () => {
    const wrapper = mount(Image, {
      props: { alt: '头像', height: 60, src: 'a.png', width: 100 },
    });
    const img = wrapper.find('img');
    expect(img.attributes('src')).toBe('a.png');
    expect(img.attributes('alt')).toBe('头像');
    expect(img.attributes('style')).toContain('width: 100px');
    expect(img.attributes('style')).toContain('height: 60px');
  });

  it('preview=false 时不可点击预览也不挂弹层', async () => {
    const wrapper = mount(Image, { props: { preview: false, src: 'a.png' } });
    expect(wrapper.find('[data-common-image-trigger]').exists()).toBe(false);
    await wrapper.find('[data-common-image]').trigger('click');
    expect(wrapper.emitted('update:previewVisible')).toBeUndefined();
    expect(previewOverlay()).toBeNull();
  });

  it('preview={{ visible: false }} 静态用法同样没有触发器', () => {
    const wrapper = mount(Image, {
      props: { preview: { visible: false }, src: 'a.png' },
    });
    expect(wrapper.find('[data-common-image-trigger]').exists()).toBe(false);
  });

  it('默认预览：点图片打开弹层', async () => {
    const wrapper = mount(Image, {
      attachTo: document.body,
      props: { src: 'a.png' },
    });
    expect(wrapper.find('[data-common-image-trigger]').exists()).toBe(true);
    expect(previewOverlay()).toBeNull();
    await wrapper.find('[data-common-image]').trigger('click');
    expect(previewOverlay()).not.toBeNull();
    wrapper.unmount();
  });

  it('受控 visible=true 直接挂载预览弹层', async () => {
    const wrapper = mount(Image, {
      attachTo: document.body,
      props: { preview: { onVisibleChange: vi.fn(), visible: true }, src: 'a.png' },
    });
    await flushPromises();
    expect(previewOverlay()).not.toBeNull();
    wrapper.unmount();
  });

  it('受控模式点击触发回调 onVisibleChange 与 update:previewVisible', async () => {
    const onVisibleChange = vi.fn();
    const wrapper = mount(Image, {
      props: { preview: { onVisibleChange, visible: false }, src: 'a.png' },
    });
    expect(wrapper.find('[data-common-image-trigger]').exists()).toBe(true);
    await wrapper.find('[data-common-image]').trigger('click');
    expect(onVisibleChange).toHaveBeenCalledWith(true);
    expect(wrapper.emitted('update:previewVisible')?.[0]).toEqual([true]);
  });

  it('加载失败时换成 fallback', async () => {
    const wrapper = mount(Image, {
      props: { fallback: 'b.png', src: 'a.png' },
    });
    await wrapper.find('img').trigger('error');
    expect(wrapper.find('img').attributes('src')).toBe('b.png');
  });

  it('img 被内联样式隐藏时弹层仍挂载', async () => {
    const wrapper = mount(Image, {
      attachTo: document.body,
      props: {
        preview: { onVisibleChange: vi.fn(), visible: true },
        src: 'a.png',
        style: { display: 'none' },
      },
    });
    await flushPromises();
    expect(wrapper.find('img').attributes('style')).toContain('display: none');
    expect(previewOverlay()).not.toBeNull();
    wrapper.unmount();
  });
});
