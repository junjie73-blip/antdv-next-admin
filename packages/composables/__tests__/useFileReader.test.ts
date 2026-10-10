import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useFileReader } from '../src/useFileReader';

/**
 * 假 FileReader。
 *
 * 不依赖 happy-dom 的实现：它对 readAsArrayBuffer / 进度事件的支持在不同版本里
 * 差异很大，而这个 composable 真正要验证的是「状态机 + Promise 包装」，
 * 读取本身只是转发给浏览器 API。
 */
class FakeFileReader {
  static readonly instances: FakeFileReader[] = [];

  error: Error | null = null;
  onerror: ((event: { target: FakeFileReader }) => void) | null = null;
  onload: ((event: { target: FakeFileReader }) => void) | null = null;
  result: ArrayBuffer | null | string = null;

  readAsArrayBuffer(file: File) {
    FakeFileReader.instances.push(this);
    this.#settle(file, new ArrayBuffer(file.size || 1));
  }

  readAsDataURL(file: File) {
    FakeFileReader.instances.push(this);
    this.#settle(file, `data:;base64,${file.name}`);
  }

  readAsText(file: File) {
    FakeFileReader.instances.push(this);
    this.#settle(file, `text:${file.name}`);
  }

  /** 名为 boom 的文件一律当作读取失败 */
  #settle(file: File, value: ArrayBuffer | string) {
    queueMicrotask(() => {
      if (file.name === 'boom.png') {
        this.error = new Error('read error');
        this.onerror?.({ target: this });
      } else {
        this.result = value;
        this.onload?.({ target: this });
      }
    });
  }
}

const file = (name: string, size = 8): File =>
  ({ name, size }) as unknown as File;

describe('useFileReader', () => {
  beforeEach(() => {
    FakeFileReader.instances.length = 0;
    vi.stubGlobal('FileReader', FakeFileReader);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('默认按 dataURL 读取，resolved 值与 result 一致', async () => {
    const reader = useFileReader();
    const result = await reader.read(file('a.png'));

    expect(result).toBe('data:;base64,a.png');
    expect(reader.result.value).toBe('data:;base64,a.png');
    expect(reader.isLoading.value).toBe(false);
    expect(reader.error.value).toBeNull();
  });

  it('readAs 决定调用哪个原生方法', async () => {
    const reader = useFileReader();
    await reader.read(file('b.txt'), 'readAsText');
    expect(reader.result.value).toBe('text:b.txt');

    await reader.read(file('c.bin'), 'readAsArrayBuffer');
    expect(reader.result.value).toBeInstanceOf(ArrayBuffer);
    expect(FakeFileReader.instances).toHaveLength(2);
  });

  it('读取失败时 reject，并把 error 留在状态里', async () => {
    const reader = useFileReader();
    await expect(reader.read(file('boom.png'))).rejects.toThrow('文件读取失败');
    expect(reader.error.value).toBeInstanceOf(Error);
    expect(reader.isLoading.value).toBe(false);
    expect(reader.result.value).toBeNull();
  });

  it('读取过程中 isLoading 为 true', async () => {
    const reader = useFileReader();
    const pending = reader.read(file('d.png'));
    expect(reader.isLoading.value).toBe(true);
    await pending;
    expect(reader.isLoading.value).toBe(false);
  });

  it('reset 清空三份状态', async () => {
    const reader = useFileReader();
    await reader.read(file('e.png'));
    reader.reset();
    expect(reader.result.value).toBeNull();
    expect(reader.error.value).toBeNull();
    expect(reader.isLoading.value).toBe(false);
  });

  it('对外暴露的是只读 ref，直接赋值会被 TS 挡住、运行时也不该影响内部状态', async () => {
    const reader = useFileReader();
    await reader.read(file('f.png'));
    // readonly() 返回的对象没有可写的 value setter（Vue 会给出开发期告警）
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    (reader.result as { value: null }).value = null;
    expect(reader.result.value).toBe('data:;base64,f.png');
    spy.mockRestore();
  });
});
