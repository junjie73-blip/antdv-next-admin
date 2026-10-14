import type { UploadFile } from '../src/components/upload/types';

import { flushPromises, mount } from '@vue/test-utils';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import Upload from '../src/components/upload/Upload.vue';
import UploadDragger from '../src/components/upload/UploadDragger.vue';

function makeFile(name = 'a.txt', type = 'text/plain') {
  return new File(['hello'], name, { type });
}

// 读组件最新一次 v-model 提交出来的列表，比读 script-setup 内部 ref 更可靠
function currentList(wrapper: any): UploadFile[] {
  const e = wrapper.emitted('update:fileList');
  return e ? (e[e.length - 1]![0] as UploadFile[]) : [];
}

async function selectFiles(wrapper: any, files: File[]) {
  // Upload 内部用 useFileDialog 管理选文件：其 watchEffect 需要等一次 flush
  // 才把 onchange 绑到模板里的 data-common-upload-input 上，所以先 flush 再驱动。
  await flushPromises();
  const input = wrapper.find('input[type="file"]');
  Object.defineProperty(input.element, 'files', {
    value: files,
    configurable: true,
  });
  await input.trigger('change');
  await flushPromises();
}

beforeEach(() => {
  // jsdom 缺 createObjectURL / revokeObjectURL
  if (typeof URL.createObjectURL !== 'function') {
    vi.spyOn(URL as any, 'createObjectURL').mockImplementation(() => 'blob:x');
    vi.spyOn(URL as any, 'revokeObjectURL').mockImplementation(() => undefined);
  }
});

describe('Upload', () => {
  it('渲染默认插槽触发区', () => {
    const wrapper = mount(Upload, {
      slots: { default: '<b class="t">选择</b>' },
    });
    expect(wrapper.find('[data-common-upload]').exists()).toBe(true);
    expect(wrapper.find('b.t').text()).toBe('选择');
  });

  it('选择文件追加项并触发 update:fileList + change', async () => {
    const wrapper = mount(Upload, { props: { multiple: true, fileList: [] } });
    await selectFiles(wrapper, [makeFile('one.txt'), makeFile('two.txt')]);
    expect(wrapper.emitted('update:fileList')).toBeTruthy();
    expect(wrapper.emitted('change')!.length).toBeGreaterThanOrEqual(2);
    expect(currentList(wrapper)).toHaveLength(2);
  });

  it('beforeUpload 返回 false 时不追加', async () => {
    const wrapper = mount(Upload, {
      props: { fileList: [], beforeUpload: () => false },
    });
    await selectFiles(wrapper, [makeFile()]);
    expect(currentList(wrapper)).toHaveLength(0);
  });

  it('customRequest 的 onSuccess 让项变为 done', async () => {
    const customRequest = vi.fn((o: any) => o.onSuccess({ id: 1 }));
    const wrapper = mount(Upload, { props: { fileList: [], customRequest } });
    await selectFiles(wrapper, [makeFile()]);
    expect(currentList(wrapper)[0]!.status).toBe('done');
    expect(currentList(wrapper)[0]!.response).toEqual({ id: 1 });
  });

  it('customRequest 的 onError 让项变为 error', async () => {
    const customRequest = vi.fn((o: any) => o.onError(new Error('boom')));
    const wrapper = mount(Upload, { props: { fileList: [], customRequest } });
    await selectFiles(wrapper, [makeFile()]);
    expect(currentList(wrapper)[0]!.status).toBe('error');
  });

  it('onProgress 更新百分比', async () => {
    let prog: any;
    const customRequest = vi.fn((o: any) => {
      prog = o.onProgress;
    });
    const wrapper = mount(Upload, { props: { fileList: [], customRequest } });
    await selectFiles(wrapper, [makeFile()]);
    prog({ percent: 42 });
    await flushPromises();
    expect(currentList(wrapper)[0]!.percent).toBe(42);
  });

  it('autoUpload=false 时排队，直到调用 upload()', async () => {
    const customRequest = vi.fn((o: any) => o.onSuccess({}));
    const wrapper = mount(Upload, {
      props: { fileList: [], autoUpload: false, customRequest },
    });
    await selectFiles(wrapper, [makeFile()]);
    expect(customRequest).not.toHaveBeenCalled();
    expect(currentList(wrapper)[0]!.status).toBe('uploading');
    (wrapper.vm as any).upload();
    await flushPromises();
    expect(customRequest).toHaveBeenCalledTimes(1);
    expect(currentList(wrapper)[0]!.status).toBe('done');
  });

  it('移除按钮触发 remove 并删除该项', async () => {
    const wrapper = mount(Upload, {
      props: { fileList: [{ uid: 'x1', name: 'keep.txt', status: 'done' }] },
    });
    await wrapper.find('[data-common-upload-item] button').trigger('click');
    expect(wrapper.emitted('remove')).toBeTruthy();
    const changes = wrapper.emitted('change')!;
    const last = changes[changes.length - 1]![0] as any;
    expect(last.file.status).toBe('removed');
    expect(last.fileList).toHaveLength(0);
  });

  it('showUploadList=false 时不渲染列表', () => {
    const wrapper = mount(Upload, {
      props: { showUploadList: false, fileList: [{ uid: 'x', name: 'a' }] },
    });
    expect(wrapper.find('[data-common-upload-list]').exists()).toBe(false);
  });

  it('maxCount=1 时只保留一项', async () => {
    const wrapper = mount(Upload, {
      props: { fileList: [], maxCount: 1, multiple: true },
    });
    await selectFiles(wrapper, [makeFile('a.txt'), makeFile('b.txt')]);
    expect(currentList(wrapper)).toHaveLength(1);
  });

  it('drag 渲染拖拽区，drop 事件添加文件', async () => {
    const wrapper = mount(Upload, { props: { drag: true, fileList: [] } });
    await wrapper
      .find('[data-common-upload] > div')
      .trigger('drop', { dataTransfer: { files: [makeFile('dropped.txt')] } });
    await flushPromises();
    expect(currentList(wrapper)).toHaveLength(1);
    expect(wrapper.emitted('drop')).toBeTruthy();
  });

  it('UploadDragger 转发到 Upload：拖拽区 + 默认插槽 + change', async () => {
    const onChange = vi.fn();
    const wrapper = mount(UploadDragger, {
      props: { fileList: [], customRequest: (o: any) => o.onSuccess({}) },
      attrs: { onChange },
      slots: { default: '<i>拖到此处</i>' },
    });
    expect(wrapper.find('[data-common-upload]').exists()).toBe(true);
    expect(wrapper.find('i').exists()).toBe(true);
    await wrapper
      .find('[data-common-upload] > div')
      .trigger('drop', { dataTransfer: { files: [makeFile('z.txt')] } });
    await flushPromises();
    expect(onChange).toHaveBeenCalled();
  });
});
