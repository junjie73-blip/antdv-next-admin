// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import AvatarUploader from '../src/components/avatar-uploader/AvatarUploader.vue';

const mocks = vi.hoisted(() => ({
  changeOkLoading: vi.fn(),
  error: vi.fn(),
  /** 裁剪器被 `refresh()` 调到的次数：验证"选完图 -> 打开弹窗 -> 复位裁剪"这条时序 */
  refresh: vi.fn(),
  success: vi.fn(),
  /** `useFileDialog().open()`：点按钮应当只拉起系统选择框 */
  open: vi.fn(),
}));

/** `useFileDialog().onChange(cb)` 注册的那个回调，测试拿它模拟"用户选了某个文件" */
const picker = vi.hoisted(() => ({
  onChange: null as ((files: File[] | FileList | null) => void) | null,
  open: vi.fn(),
}));

/** 上传出口与弹窗壳：桩件要能被测试主动"点确认" */
const stubs = vi.hoisted(() => ({
  cropBlob: { size: 1024, type: 'image/png' } as { size: number; type: string },
  posted: undefined as Record<string, unknown> | undefined,
}));

// Button 那一层还会用到 `@vueuse/core` 的其它导出（shadcn-ui 的 carousel 用
// `createInjectionState`），整包替掉会连坐；只改 `useFileDialog` 这一个。
vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>();
  return {
    ...actual,
    useFileDialog: () => ({
      onChange: (cb: (files: File[] | FileList | null) => void) => {
        picker.onChange = cb;
      },
      open: mocks.open,
    }),
  };
});

vi.mock('@antdv/request', () => ({
  request: { post: vi.fn(async () => stubs.posted) },
}));

vi.mock('@antdv/popup-ui', async () => {
  const { defineComponent, h } =
    await vi.importActual<typeof import('vue')>('vue');
  const BasicModal = defineComponent({
    name: 'BasicModalStub',
    props: {
      okButtonProps: { default: undefined, type: Object },
      open: { default: false, type: Boolean },
      title: { default: '', type: String },
    },
    emits: ['ok', 'register', 'update:open'],
    setup(_props, { emit, slots }) {
      // BasicModal 真身是在挂载时通过 `@register` 把命令式 API 交回调用方的，
      // 组件收尾要调 `api.changeOkLoading(false)`；桩件不给这个句柄，
      // 那条复位就成了永远为真的空断言。
      queueMicrotask(() =>
        emit('register', { changeOkLoading: mocks.changeOkLoading }),
      );
      // 裁剪器挂在默认插槽里，桩件不把插槽渲出来就等于"弹窗是空的"，
      // 后面所有依赖 cropperRef 的用例都会静默走早退分支
      return () => h('div', { class: 'modal-stub' }, slots.default?.());
    },
  });
  return {
    BasicModal,
    message: { error: mocks.error, success: mocks.success },
  };
});

vi.mock('vue-cropper', async () => {
  const { defineComponent, h } =
    await vi.importActual<typeof import('vue')>('vue');
  const VueCropper = defineComponent({
    name: 'VueCropperStub',
    props: { img: { default: '', type: String } },
    setup(props, { expose }) {
      expose({
        getCropBlob: (cb: (data: Blob) => void) => {
          cb(
            new Blob(['x'.repeat(stubs.cropBlob.size)], {
              type: stubs.cropBlob.type,
            }),
          );
        },
        refresh: mocks.refresh,
      });
      return () => h('div', { class: 'cropper-stub', 'data-img': props.img });
    },
  });
  return { VueCropper };
});

/**
 * 把 FileReader 换成"读到什么由测试决定"：happy-dom 的实现是异步的且不保证
 * 在所有环境里都给出 dataURL，而这里要钉的是**校验与状态机**，不是浏览器 API。
 */
function stubFileReader(dataUrl = 'data:image/png;base64,AAAA') {
  class FakeFileReader {
    onerror: (() => void) | null = null;
    onload: (() => void) | null = null;
    result = '';

    readAsDataURL() {
      this.result = dataUrl;
      queueMicrotask(() => this.onload?.());
    }
  }
  vi.stubGlobal('FileReader', FakeFileReader);
}

function pickFile(file: File) {
  if (!picker.onChange) throw new Error('组件没注册选文件回调');
  picker.onChange([file]);
}

const mountUploader = (props: Record<string, unknown> = {}) =>
  mount(AvatarUploader, { props });

/** 弹窗壳上的 `open` 就是组件内部的 `visible`（模板用的是 v-model:open） */
function modalOpen(wrapper: ReturnType<typeof mountUploader>) {
  const modal = wrapper.findComponent({ name: 'BasicModalStub' });
  if (!modal.exists()) throw new Error('找不到裁剪弹窗');
  return modal.props('open') === true;
}

beforeEach(() => {
  mocks.changeOkLoading.mockClear();
  mocks.error.mockClear();
  mocks.open.mockClear();
  mocks.refresh.mockClear();
  mocks.success.mockClear();
  stubs.cropBlob = { size: 1024, type: 'image/png' };
  stubs.posted = { code: 0, data: { url: 'https://cdn.test/avatar.png' } };
  stubFileReader();
});

describe('avatarUploader 的预览与入口', () => {
  it('默认 80px 圆形；size / round 可配，非圆角退回 8px', () => {
    const round = mountUploader();
    const box = round.find('div[style*="border-radius"]');
    expect(box.attributes('style')).toContain('width: 80px');
    expect(box.attributes('style')).toContain('border-radius: 50%');
    expect(round.text()).toContain('上传头像');

    const square = mountUploader({ round: false, size: 64 });
    const squareBox = square.find('div[style*="border-radius"]');
    expect(squareBox.attributes('style')).toContain('width: 64px');
    expect(squareBox.attributes('style')).toContain('border-radius: 8px');
    expect(square.text()).toContain('上传头像');
  });

  it('已有 modelValue 时显示原图并换成「更换头像」', () => {
    const wrapper = mountUploader({ modelValue: 'https://cdn.test/a.png' });
    expect(wrapper.find('img').attributes('src')).toBe(
      'https://cdn.test/a.png',
    );
    expect(wrapper.text()).toContain('更换头像');
  });

  it('点按钮只负责拉起系统文件选择框', async () => {
    const wrapper = mountUploader();
    await wrapper.find('button').trigger('click');
    expect(mocks.open).toHaveBeenCalledTimes(1);
    expect(modalOpen(wrapper)).toBe(false);
  });
});

describe('avatarUploader 的选图校验', () => {
  it('非图片类型直接拒，且不打开弹窗', async () => {
    const wrapper = mountUploader();
    pickFile(new File(['x'], 'a.txt', { type: 'text/plain' }));
    await flushPromises();
    expect(mocks.error).toHaveBeenCalledWith('仅支持 JPG / PNG / WebP / GIF');
    expect(modalOpen(wrapper)).toBe(false);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('超出 maxSizeMb 拒掉，提示里带上当前的上限', async () => {
    const wrapper = mountUploader({ maxSizeMb: 2 });
    const big = new File(['x'.repeat(3 * 1024 * 1024)], 'big.png', {
      type: 'image/png',
    });
    pickFile(big);
    await flushPromises();
    expect(mocks.error).toHaveBeenCalledWith('图片大小不能超过 2MB');
    expect(modalOpen(wrapper)).toBe(false);
  });

  it('合格图片才走「读成 DataURL → 开弹窗 → 复位裁剪」这条时序', async () => {
    const wrapper = mountUploader();
    pickFile(new File(['x'], 'a.png', { type: 'image/png' }));
    await flushPromises();

    expect(modalOpen(wrapper)).toBe(true);
    expect(wrapper.find('.cropper-stub').attributes('data-img')).toBe(
      'data:image/png;base64,AAAA',
    );
    // refresh 挂在 nextTick 之后：弹窗内容此时才真的挂载出裁剪器
    await flushPromises();
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it('读取失败时按 FileReader 的错误文案提示，不开弹窗', async () => {
    class BoomReader {
      onerror: (() => void) | null = null;
      onload: (() => void) | null = null;

      readAsDataURL() {
        queueMicrotask(() => this.onerror?.());
      }
    }
    vi.stubGlobal('FileReader', BoomReader);
    const wrapper = mountUploader();
    pickFile(new File(['x'], 'a.png', { type: 'image/png' }));
    await flushPromises();
    expect(mocks.error).toHaveBeenCalledWith('文件读取失败');
    expect(modalOpen(wrapper)).toBe(false);
  });
});

describe('avatarUploader 的确认上传', () => {
  async function openWithImage(wrapper: ReturnType<typeof mountUploader>) {
    pickFile(new File(['x'], 'a.png', { type: 'image/png' }));
    await flushPromises();
    return wrapper.findComponent({ name: 'BasicModalStub' });
  }

  it('上传成功：回抛 url、提示成功、关弹窗并复位确认按钮', async () => {
    const wrapper = mountUploader();
    const modal = await openWithImage(wrapper);
    modal.vm.$emit('ok');
    await flushPromises();

    const { request } = await import('@antdv/request');
    expect(request.post).toHaveBeenCalledWith(
      '/upload/avatar',
      expect.any(FormData),
    );
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([
      'https://cdn.test/avatar.png',
    ]);
    expect(wrapper.emitted('uploaded')?.[0]).toEqual([
      'https://cdn.test/avatar.png',
    ]);
    expect(mocks.success).toHaveBeenCalledWith('头像上传成功');
    expect(modalOpen(wrapper)).toBe(false);
    expect(mocks.changeOkLoading).toHaveBeenCalledWith(false);
  });

  it('接口没返回 url 当作失败，弹窗留着且按钮 loading 复位', async () => {
    stubs.posted = { code: 0, data: {} };
    const wrapper = mountUploader();
    const modal = await openWithImage(wrapper);
    modal.vm.$emit('ok');
    await flushPromises();

    expect(mocks.error).toHaveBeenCalledWith('上传接口未返回 url');
    expect(wrapper.emitted('uploaded')).toBeUndefined();
    expect(modalOpen(wrapper)).toBe(true);
    expect(mocks.changeOkLoading).toHaveBeenCalledWith(false);
  });

  it('请求抛错时错误文案透出来，不静默失败', async () => {
    const { request } = await import('@antdv/request');
    vi.mocked(request.post).mockRejectedValueOnce(new Error('网络中断'));
    const wrapper = mountUploader();
    const modal = await openWithImage(wrapper);
    modal.vm.$emit('ok');
    await flushPromises();

    expect(mocks.error).toHaveBeenCalledWith('网络中断');
    expect(wrapper.emitted('uploaded')).toBeUndefined();
  });
});
