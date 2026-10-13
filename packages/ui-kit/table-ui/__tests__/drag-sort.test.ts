import type { Recordable } from '../src/types';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import BasicTable from '../src/BasicTable.vue';
import { useDragSort } from '../src/hooks/useDragSort';

// Sortable 在 jsdom 里不会真的移动 DOM 节点，这里只记录传入的选项，
// 用生命周期回调验证下标换算与重排逻辑。
const instances: Array<{ destroy: any; el: HTMLElement; options: any }> = [];

vi.mock('sortablejs', () => ({
  // 必须是函数表达式：`useDragSort` 用 `new Sortable(...)` 实例化，箭头函数不能当构造器
  // eslint-disable-next-line prefer-arrow-callback
  default: vi.fn(function FakeSortable(this: any, el: HTMLElement, options: any) {
    const destroy = vi.fn();
    instances.push({ destroy, el, options });
    return { destroy, option: vi.fn() };
  }),
}));

const rows = (): Recordable[] => [
  { id: 1, name: 'a' },
  { id: 2, name: 'b' },
  { id: 3, name: 'c' },
];

async function setupDragSort(options: Record<string, any> = {}) {
  const dataSource = ref<Recordable[]>(rows());
  const ctl = ref<any>(null);

  const wrapper = mount(
    defineComponent({
      setup() {
        ctl.value = useDragSort({
          animation: 100,
          canDrop: options.canDrop,
          dataSource,
          disabled: options.disabled,
          enabled: options.enabled ?? true,
          handle: options.handle,
          onDragEnd: options.onDragEnd,
        } as any);
        return () => h('div');
      },
    }),
    { attachTo: document.body },
  );
  return { ctl: ctl.value, dataSource, wrapper };
}

const makeEvt = (extra: Record<string, any>) => ({
  preventDefault: vi.fn(),
  ...extra,
});

beforeEach(() => {
  instances.length = 0;
});

describe('useDragSort', () => {
  it('enabled 为假时不创建 Sortable 实例', async () => {
    const { ctl } = await setupDragSort({ enabled: false });
    ctl.initSortable(document.createElement('tbody'));
    expect(instances).toHaveLength(0);
  });

  it('创建实例时透传 handle 与 animation', async () => {
    const { ctl } = await setupDragSort({ handle: '.drag-handle' });
    const tbody = document.createElement('tbody');
    ctl.initSortable(tbody);
    expect(instances[0]!.el).toBe(tbody);
    expect(instances[0]!.options.handle).toBe('.drag-handle');
    expect(instances[0]!.options.animation).toBe(100);
    expect(instances[0]!.options.disabled).toBe(false);

    ctl.destroySortable();
    expect(ctl.initSortable).toBeTypeOf('function');
  });

  it('同一元素重复 init 只创建一个实例', async () => {
    const { ctl } = await setupDragSort();
    const tbody = document.createElement('tbody');
    ctl.initSortable(tbody);
    ctl.initSortable(tbody);
    expect(instances).toHaveLength(1);
  });

  it('onEnd 重排数据源并回调新旧两份数据', async () => {
    const onDragEnd = vi.fn();
    const { ctl, dataSource } = await setupDragSort({ onDragEnd });
    const tbody = document.createElement('tbody');
    for (const row of dataSource.value) {
      const tr = document.createElement('tr');
      tr.setAttribute('data-row-key', String(row.id));
      tbody.append(tr);
    }
    ctl.initSortable(tbody);

    instances[0]!.options.onEnd({ newIndex: 2, oldIndex: 0 });
    expect(dataSource.value.map((row) => row.id)).toEqual([2, 3, 1]);
    expect(onDragEnd.mock.calls[0]![0].map((r: Recordable) => r.id)).toEqual([
      2,
      3,
      1,
    ]);
    // 旧数据保持拖拽前的顺序
    expect(onDragEnd.mock.calls[0]![1].map((r: Recordable) => r.id)).toEqual([
      1,
      2,
      3,
    ]);
  });

  it('下标相同或越界时不改数据', async () => {
    const onDragEnd = vi.fn();
    const { ctl, dataSource } = await setupDragSort({ onDragEnd });
    const tbody = document.createElement('tbody');
    for (const row of dataSource.value) {
      const tr = document.createElement('tr');
      tr.setAttribute('data-row-key', String(row.id));
      tbody.append(tr);
    }
    ctl.initSortable(tbody);

    instances[0]!.options.onEnd({ newIndex: 1, oldIndex: 1 });
    instances[0]!.options.onEnd({ newIndex: undefined, oldIndex: 0 });
    expect(onDragEnd).not.toHaveBeenCalled();
    expect(dataSource.value.map((row) => row.id)).toEqual([1, 2, 3]);
  });

  it('测量行/占位行造成的前导偏移会被扣掉', async () => {
    const onDragEnd = vi.fn();
    const { ctl, dataSource } = await setupDragSort({ onDragEnd });
    const tbody = document.createElement('tbody');
    // 两行没有 data-row-key 的测量行在前
    tbody.append(document.createElement('tr'), document.createElement('tr'));
    for (const row of dataSource.value) {
      const tr = document.createElement('tr');
      tr.setAttribute('data-row-key', String(row.id));
      tbody.append(tr);
    }
    ctl.initSortable(tbody);

    // Sortable 给的是 tbody 子节点下标：2 → 4 实际是数据行 0 → 2
    instances[0]!.options.onEnd({ newIndex: 4, oldIndex: 2 });
    expect(dataSource.value.map((row) => row.id)).toEqual([2, 3, 1]);
  });

  it('disabled 命中的行拖不动', async () => {
    const { ctl, dataSource } = await setupDragSort({
      disabled: (row: Recordable) => row.id === 2,
    });
    const tbody = document.createElement('tbody');
    for (const row of dataSource.value) {
      const tr = document.createElement('tr');
      tr.setAttribute('data-row-key', String(row.id));
      tbody.append(tr);
    }
    ctl.initSortable(tbody);

    expect(instances[0]!.options.onStart(makeEvt({ oldIndex: 1 }))).toBe(false);
    expect(instances[0]!.options.onStart(makeEvt({ oldIndex: 0 }))).toBe(true);
  });

  it('canDrop 决定能否落到目标行', async () => {
    const canDrop = vi.fn(() => false);
    const { ctl, dataSource } = await setupDragSort({ canDrop });
    const tbody = document.createElement('tbody');
    for (const row of dataSource.value) {
      const tr = document.createElement('tr');
      tr.setAttribute('data-row-key', String(row.id));
      tbody.append(tr);
    }
    ctl.initSortable(tbody);

    const result = instances[0]!.options.onMove({
      draggedRowIndex: 0,
      newindex: 1,
      relatedRowIndex: 2,
    });
    expect(result).toBe(false);
    expect(canDrop).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
      expect.objectContaining({ id: 3 }),
    );
  });

  it('组件卸载时销毁实例', async () => {
    const { ctl, wrapper } = await setupDragSort();
    const tbody = document.createElement('tbody');
    ctl.initSortable(tbody);
    expect(instances[0]!.destroy).not.toHaveBeenCalled();
    wrapper.unmount();
    expect(instances[0]!.destroy).toHaveBeenCalledTimes(1);
  });
});

describe('BasicTable 拖拽接线', () => {
  it('dragSort 打开时把 Sortable 绑在 tbody 上', async () => {
    const wrapper = mount(BasicTable as any, {
      props: {
        columns: [{ dataIndex: 'name', title: '名称' }],
        dataSource: rows(),
        dragSort: true,
        dragSortConfig: { handle: 'tr' },
        showTableSetting: false,
      },
    });
    await flushPromises();
    expect(instances).toHaveLength(1);
    expect(instances[0]!.el).toBe(wrapper.find('tbody').element);
    expect(instances[0]!.options.handle).toBe('tr');
    wrapper.unmount();
  });

  it('默认不开拖拽', async () => {
    mount(BasicTable as any, {
      props: {
        columns: [{ dataIndex: 'name', title: '名称' }],
        dataSource: rows(),
        showTableSetting: false,
      },
    });
    await flushPromises();
    expect(instances).toHaveLength(0);
  });

  it('onDragEnd 会同步写回 rawDataSource，避免"重置"退回旧顺序', async () => {
    const onDragEnd = vi.fn();
    const wrapper = mount(BasicTable as any, {
      props: {
        columns: [{ dataIndex: 'name', title: '名称' }],
        dataSource: rows(),
        dragSort: true,
        dragSortConfig: { onDragEnd },
        showTableSetting: false,
      },
    }) as any;
    await flushPromises();

    instances[0]!.options.onEnd({ newIndex: 1, oldIndex: 0 });
    await flushPromises();

    expect(onDragEnd).toHaveBeenCalledTimes(1);
    expect(wrapper.vm.getDataSource().map((r: Recordable) => r.id)).toEqual([
      2, 1, 3,
    ]);
    expect(wrapper.vm.getRawDataSource().map((r: Recordable) => r.id)).toEqual([
      2, 1, 3,
    ]);
    wrapper.unmount();
  });
});
