import { nextTick, ref } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface RecordItem {
  calls: string[];
  options: Record<string, unknown>;
}

const { recorder } = vi.hoisted(() => ({
  recorder: { instances: [] as RecordItem[] },
}));

/**
 * watermark-plus 是无类型库（本包用 src/types/watermark-plus.d.ts 兜住），
 * 它真实实现会往 body 插 canvas 节点并做防篡改监听。
 * 这里只关心「什么时候建、带什么参数建、有没有销毁」，所以整包 mock 掉。
 */
vi.mock('watermark-plus', () => ({
  default: class FakeWatermark {
    private readonly record: RecordItem = { calls: [], options: {} };

    constructor(options: Record<string, unknown>) {
      this.record.options = options;
      recorder.instances.push(this.record);
    }

    create() {
      this.record.calls.push('create');
    }

    destroy() {
      this.record.calls.push('destroy');
    }
  },
}));

import { useWatermark } from '../src/useWatermark';
import { withSetup } from './helpers/setup';

const last = (): RecordItem => recorder.instances.at(-1) as RecordItem;

describe('useWatermark', () => {
  beforeEach(() => {
    recorder.instances.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('挂载时按 enabled + content 创建，并合并默认样式', () => {
    const { result, unmount } = withSetup(() =>
      useWatermark({ content: '张三', enabled: true }),
    );

    expect(recorder.instances).toHaveLength(1);
    expect(last().options).toMatchObject({
      alpha: 0.15,
      color: '#666666',
      content: '张三',
      fontFamily: 'sans-serif',
      fontSize: 14,
      height: 150,
      rotate: 330,
      width: 200,
    });
    expect(last().calls).toEqual(['create']);
    expect(result.watermarkInstance.value).not.toBeNull();
    unmount();
  });

  it('content 为空不创建水印', () => {
    const { unmount } = withSetup(() =>
      useWatermark({ content: '', enabled: true }),
    );
    expect(recorder.instances).toHaveLength(0);
    unmount();
  });

  it('enabled 为 false 时不创建', () => {
    const { unmount } = withSetup(() =>
      useWatermark({ content: '张三', enabled: false }),
    );
    expect(recorder.instances).toHaveLength(0);
    unmount();
  });

  it('style 覆盖默认值', () => {
    const { unmount } = withSetup(() =>
      useWatermark({
        content: '李四',
        enabled: true,
        style: { color: '#ff0000', fontSize: 20 },
      }),
    );
    expect(last().options).toMatchObject({ color: '#ff0000', fontSize: 20 });
    unmount();
  });

  it('content 变化会先销毁旧的再建新的', async () => {
    const content = ref('A');
    const { unmount } = withSetup(() =>
      useWatermark({ content, enabled: true }),
    );
    expect(recorder.instances).toHaveLength(1);
    const first = last();

    content.value = 'B';
    await nextTick();

    expect(first.calls).toContain('destroy');
    expect(recorder.instances).toHaveLength(2);
    expect(last().options.content).toBe('B');
    expect(last().calls).toEqual(['create']);
    unmount();
  });

  it('enabled 由 false 翻到 true 时才创建', async () => {
    const enabled = ref(false);
    const { unmount } = withSetup(() =>
      useWatermark({ content: '王五', enabled }),
    );
    expect(recorder.instances).toHaveLength(0);

    enabled.value = true;
    await nextTick();
    expect(recorder.instances).toHaveLength(1);
    expect(last().options.content).toBe('王五');

    enabled.value = false;
    await nextTick();
    expect(last().calls).toContain('destroy');
    unmount();
  });

  it('卸载时销毁实例', async () => {
    const { unmount } = withSetup(() =>
      useWatermark({ content: '赵六', enabled: true }),
    );
    const created = last();
    expect(created.calls).toEqual(['create']);
    unmount();
    await nextTick();
    expect(created.calls).toEqual(['create', 'destroy']);
  });

  it('updateWatermark("") 只销毁不重建，createWatermark 可手动重建', () => {
    const { result, unmount } = withSetup(() =>
      useWatermark({ content: '初始', enabled: true }),
    );
    result.updateWatermark('');
    expect(recorder.instances).toHaveLength(1);
    expect(last().calls).toContain('destroy');

    result.createWatermark('手动');
    expect(recorder.instances).toHaveLength(2);
    expect(last().options.content).toBe('手动');
    unmount();
  });
});
