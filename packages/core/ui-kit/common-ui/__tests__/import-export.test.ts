import type { PermissionChecker } from '../src/components/import-export/context';

import { flushPromises, mount } from '@vue/test-utils';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PERMISSION_CHECK } from '../src/components/import-export/context';
import ImportExport from '../src/components/import-export/ImportExport.vue';

const mocks = vi.hoisted(() => ({
  alert: vi.fn(() => Promise.resolve()),
  error: vi.fn(),
  post: vi.fn(),
  success: vi.fn(),
}));

vi.mock('@antdv/request', () => ({ request: { post: mocks.post } }));
vi.mock('@antdv/popup-ui', () => ({
  alert: mocks.alert,
  message: { error: mocks.error, success: mocks.success },
}));

const permissions = ['system:user:import', 'system:user:export'];

function mountImportExport(
  props: Record<string, any> = {},
  permissionCheck?: PermissionChecker,
) {
  return mount(ImportExport, {
    global: {
      provide: permissionCheck
        ? { [PERMISSION_CHECK as symbol]: permissionCheck }
        : {},
    },
    props: { importTemplate: [], module: 'system/user', permissions, ...props },
  });
}

/**
 * 按文本**精确**匹配：`includes('导入')` 会先命中「导入模板」那个按钮，
 * 于是「导入被权限挡掉」看着没生效、点错按钮也查不出来。
 */
function findButton(wrapper: any, text: string) {
  return wrapper.findAll('button').find((b: any) => b.text().trim() === text);
}

/** 取不到按钮就失败，而不是留一个 `!` 断言到运行时报 TypeError */
function clickButton(wrapper: any, text: string) {
  const button = findButton(wrapper, text);
  if (!button) throw new Error(`找不到文本为「${text}」的按钮`);
  return button.trigger('click');
}

beforeEach(() => {
  mocks.alert.mockClear();
  mocks.error.mockClear();
  mocks.post.mockReset();
  mocks.success.mockClear();
});

describe('导入导出的权限口径', () => {
  it('宿主没注入 PERMISSION_CHECK 时两个按钮都在（与迁移前 v-permission 的放行兜底一致）', () => {
    const wrapper = mountImportExport();

    expect(findButton(wrapper, '导出')).toBeTruthy();
    expect(findButton(wrapper, '导入')).toBeTruthy();
  });

  it('注入的判定说没有导入权限，就只留导出按钮', () => {
    const wrapper = mountImportExport(
      {},
      (value) => value !== 'system:user:import',
    );

    expect(findButton(wrapper, '导出')).toBeTruthy();
    expect(findButton(wrapper, '导入')).toBeFalsy();
  });

  it('判定拿到的是 permissions 里对应那一项，而不是整个数组', () => {
    const check = vi.fn<PermissionChecker>(() => true);
    mountImportExport({}, check);

    expect(check.mock.calls.map(([value]) => value).toSorted()).toEqual([
      'system:user:export',
      'system:user:import',
    ]);
  });
});

describe('导入导出的导出通道', () => {
  it('宿主给了 submitExport 就用宿主那条通道，并把 bizType / 格式 / 查询参数原样传过去', async () => {
    const submitExport = vi.fn().mockResolvedValue({ taskId: 'a1b2c3d4e5f6' });
    const wrapper = mountImportExport({
      exportParams: { status: 1 },
      exportProps: { bizType: 'user', exportFormat: 'csv' },
      submitExport,
    });

    await clickButton(wrapper, '导出');
    await flushPromises();

    expect(submitExport).toHaveBeenCalledWith({
      bizType: 'user',
      exportFormat: 'csv',
      queryParams: { status: 1 },
    });
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.success).toHaveBeenCalledWith(
      expect.stringContaining('a1b2c3d4'),
    );
  });

  it('没给 submitExport 时退回「module/export」这条默认请求，exportFormat 兜底 xlsx', async () => {
    mocks.post.mockResolvedValue({ data: { taskId: null } });
    const wrapper = mountImportExport({ exportParams: { status: 1 } });

    await clickButton(wrapper, '导出');
    await flushPromises();

    expect(mocks.post).toHaveBeenCalledWith('system/user/export', {
      bizType: undefined,
      exportFormat: 'xlsx',
      queryParams: { status: 1 },
    });
    // 拿不到 taskId 就不该把 undefined 截成 "undefi"，换成不带 ID 的文案
    expect(mocks.success).toHaveBeenCalledWith(
      '导出任务已提交，可在「导出中心」查看进度',
    );
  });

  it('ids 是数组时拼成逗号串再发；空数组直接拦下并提示', async () => {
    mocks.post.mockResolvedValue({ data: { taskId: 't' } });
    const wrapper = mountImportExport({ exportParams: { ids: [1, 2, 3] } });
    await clickButton(wrapper, '导出');
    await flushPromises();

    expect(mocks.post.mock.calls[0]?.[1]).toMatchObject({
      queryParams: { ids: '1,2,3' },
    });

    const empty = mountImportExport({ exportParams: { ids: [] } });
    await clickButton(empty, '导出');
    await flushPromises();

    expect(mocks.error).toHaveBeenCalledWith('请选择导出数据');
    expect(mocks.post.mock.calls).toHaveLength(1);
  });

  it('通道抛错时提示失败原因并 emit exportError', async () => {
    const wrapper = mountImportExport({
      submitExport: vi.fn().mockRejectedValue(new Error('导出队列已满')),
    });

    await clickButton(wrapper, '导出');
    await flushPromises();

    expect(mocks.error).toHaveBeenCalledWith('导出队列已满');
    expect(wrapper.emitted('exportError')?.[0]?.[0]).toBeInstanceOf(Error);
  });
});
