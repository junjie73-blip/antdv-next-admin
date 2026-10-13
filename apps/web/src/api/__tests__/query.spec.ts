import { mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';

import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const Get = vi.hoisted(() => vi.fn());
vi.mock('~/composables', () => ({
  http: { Get },
}));

const { useApiQuery } = await import('../query');

function mountQuery<T>(setup: () => { result: any }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Comp = defineComponent({ setup });
  const wrapper = mount(Comp, {
    global: { plugins: [[VueQueryPlugin, { queryClient: client }]] },
    render: () => h('div'),
  });
  return wrapper;
}

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

describe('useApiQuery', () => {
  beforeEach(() => Get.mockReset());

  it('unwraps the R<T> envelope and forwards vue-query signal to the fetch executor', async () => {
    let captured: any;
    Get.mockImplementation((_url, _params, opts) => {
      captured = opts;
      return Promise.resolve({
        code: 200,
        data: { list: [1, 2] },
        message: '',
      });
    });

    let result: any;
    mountQuery(() => {
      result = useApiQuery<{ list: number[] }>(['/demo/list'], {
        url: '/demo/list',
        params: { pageNum: 1 },
      });
      return { result };
    });

    await vi.waitFor(() => expect(result.isSuccess.value).toBe(true));
    expect(Get).toHaveBeenCalledWith(
      '/demo/list',
      { pageNum: 1 },
      expect.objectContaining({ signal: expect.anything() }),
    );
    expect(captured.signal.aborted).toBe(false);
    expect(result.data.value).toEqual({ list: [1, 2] });
  });

  it('refetches with new params when params change', async () => {
    Get.mockImplementation(() =>
      Promise.resolve({ code: 200, data: 'ok', message: '' }),
    );
    const keyword = ref('a');
    let result: any;
    mountQuery(() => {
      result = useApiQuery(['search'], {
        url: '/system/user/list',
        params: () => ({ keyword: keyword.value }),
      });
      return { result };
    });

    await vi.waitFor(() => expect(result.isSuccess.value).toBe(true));
    expect(Get).toHaveBeenLastCalledWith(
      '/system/user/list',
      { keyword: 'a' },
      expect.anything(),
    );

    keyword.value = 'b';
    await vi.waitFor(() =>
      expect(Get).toHaveBeenLastCalledWith(
        '/system/user/list',
        { keyword: 'b' },
        expect.anything(),
      ),
    );
  });
});
