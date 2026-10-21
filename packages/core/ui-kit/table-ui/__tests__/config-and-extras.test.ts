import type { Recordable, TableActionType } from '../src/types';

import { flushPromises, mount } from '@vue/test-utils';
import { h, nextTick, ref } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import BasicTable from '../src/BasicTable.vue';
import { configureTable, tableRuntime } from '../src/config';
import { features } from '../src/features';
import * as indexExports from '../src/index';
import { useTable } from '../src/useTable';

const rows: Recordable[] = [
  { age: 28, id: 1, name: '张三' },
  { age: 32, id: 2, name: '李四' },
];
const columns = [{ dataIndex: 'name', title: '名称' }];

/**
 * `useDataSource` 的首屏取数走 `useTimeoutFn(..., 0)`，是真实定时器，
 * 单靠 flushPromises 等不到它，测试里要真的把宏任务放过去。
 */
const wait = () => new Promise((resolve) => setTimeout(resolve, 10));

afterEach(() => {
  configureTable({
    checkAnyAuth: () => true,
    checkAuth: () => true,
    notifyError: (content: string) => content,
    resolveErrorMessage: (error: unknown, fallback: string) =>
      error instanceof Error ? error.message : fallback,
  });
});

describe('configureTable / tableRuntime', () => {
  it('默认实现：Error 用 message，其他用 fallback，权限一律放行', () => {
    expect(tableRuntime.resolveErrorMessage(new Error('炸了'), '默认')).toBe(
      '炸了',
    );
    expect(tableRuntime.resolveErrorMessage('字符串错', '默认')).toBe(
      '字符串错',
    );
    expect(tableRuntime.resolveErrorMessage({}, '默认')).toBe('默认');
    expect(tableRuntime.checkAuth('any')).toBe(true);
    expect(tableRuntime.checkAnyAuth(['a', 'b'])).toBe(true);
  });

  it('注入实现覆盖默认行为（web 侧就是这么接 usePermission 的）', () => {
    const resolveErrorMessage = vi.fn(() => '翻译后的文案');
    const notifyError = vi.fn();
    configureTable({
      checkAuth: (code) => code === 'ok',
      notifyError,
      resolveErrorMessage,
    });
    expect(tableRuntime.checkAuth('ok')).toBe(true);
    expect(tableRuntime.checkAuth('nope')).toBe(false);
    expect(tableRuntime.resolveErrorMessage(new Error('x'), '兜底')).toBe(
      '翻译后的文案',
    );
    expect(resolveErrorMessage).toHaveBeenCalledOnce();
    tableRuntime.notifyError('出错了');
    expect(notifyError).toHaveBeenCalledWith('出错了');
  });

  it('取数失败时走注入的错误通道', async () => {
    const notifyError = vi.fn();
    const resolveErrorMessage = vi.fn(() => '接口 500');
    configureTable({ notifyError, resolveErrorMessage });

    const wrapper = mount(BasicTable, {
      props: {
        api: async () => {
          throw new Error('boom');
        },
        columns,
        dataSource: undefined,
      },
    });
    await wait();
    await flushPromises();

    expect(resolveErrorMessage).toHaveBeenCalled();
    expect(notifyError).toHaveBeenCalledWith('接口 500');
    expect(wrapper.findAll('tbody tr.basic-table-row')).toHaveLength(0);
    wrapper.unmount();
  });
});

/** useTable 走的是 `@register` 事件，等价于传 onRegister prop */
function mountRegistered(
  register: (instance: TableActionType) => void,
  props: Record<string, any> = {},
) {
  return mount(BasicTable as any, {
    props: {
      columns,
      dataSource: rows,
      ...props,
      onRegister: register,
    },
  }) as any;
}

describe('useTable', () => {
  it('register 拿到实例后即可命令式调用，初始 props 一并生效', async () => {
    const api = vi.fn(async () => ({ list: rows, total: 2 }));
    const [register, tableRef] = useTable({
      api,
      columns,
      pagination: { pageSize: 5 },
    });

    const wrapper = mountRegistered(register, { dataSource: undefined });
    await wait();
    await nextTick();

    const instance = tableRef.value as TableActionType;
    expect(instance).toBeTruthy();
    expect(instance.getDataSource()).toHaveLength(2);
    // 内部状态优先（applyData 回填 total 时会带默认 pageSize 落进 paginationRef），
    // 这一优先级与 web 的 usePagination 完全一致
    expect(instance.getPaginationRef()).toMatchObject({ current: 1, total: 2 });
    expect(api).toHaveBeenCalled();

    instance.setProps({ showIndexColumn: true });
    await nextTick();
    expect(wrapper.findAll('.basic-table-head')).toHaveLength(2);
    wrapper.unmount();
  });

  it('未注册时 tableRef 为空，注册后指向最新实例', async () => {
    const [register, tableRef] = useTable();
    expect(tableRef.value).toBeNull();

    const first = mountRegistered(register);
    await nextTick();
    const one = tableRef.value;
    expect(one).toBeTruthy();
    expect(one!.getDataSource()).toHaveLength(2);

    const second = mountRegistered(register, {
      dataSource: [rows[0]],
    });
    await nextTick();
    expect(tableRef.value).not.toBe(one);
    expect(tableRef.value!.getDataSource()).toHaveLength(1);
    first.unmount();
    second.unmount();
  });

  it('useTable 返回的实例支持刷新与选择相关方法', async () => {
    const api = vi.fn(async () => ({ list: rows, total: 2 }));
    const selectedRowKeys = ref<string[]>([]);
    const [register, tableRef] = useTable({
      api,
      columns,
      rowSelection: {
        onChange: (keys: any) => (selectedRowKeys.value = keys as string[]),
        selectedRowKeys: [],
      },
    });
    mountRegistered(register, { dataSource: undefined });
    await wait();
    await nextTick();

    const instance = tableRef.value as TableActionType;
    instance.clearSelectedRowKeys();
    expect(selectedRowKeys.value).toEqual([]);
    instance.selectRows(['1']);
    await nextTick();
    expect(instance.getSelectRowKeys()).toEqual(['1']);
    expect(instance.getSelectRows()).toMatchObject([{ id: 1 }]);
  });
});

describe('index 导出面', () => {
  it('对外暴露组件、hooks 与运行时配置', () => {
    for (const key of [
      'BasicTable',
      'TableAction',
      'TableEditableCell',
      'TableHeaderCell',
      'TableImg',
      'configureTable',
      'tableRuntime',
      'useTable',
      'useColumns',
      'useDataSource',
      'useDragSort',
      'useLoading',
      'usePagination',
      'useRowSelection',
      'useTableForm',
      'convertColumns',
    ]) {
      expect(indexExports, key).toHaveProperty(key);
    }
  });

  it('features.ts 暴露统一的 TanStack 特性集', () => {
    expect(features).toBeTruthy();
    expect((features as any).rowSortingFeature).toBeTypeOf('object');
  });

  it('渲染需要的组件能被 h 消费', () => {
    expect(() => h(BasicTable, { columns, dataSource: rows })).not.toThrow();
  });
});
