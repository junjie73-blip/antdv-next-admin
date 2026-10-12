import type { BasicColumn } from '../types';

import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, ref } from 'vue';

import BasicTable from '../BasicTable.vue';
import { useDragSort } from '../hooks/useDragSort';

/**
 * 拖拽排序的契约。
 *
 * 两条各自坏过的链路：
 * 1. `dragSort` 在 `types.ts` 里声明了很久，但 `BasicTable` 从没消费过它 ——
 *    传了等于没传，页面“看起来配好了”，实际一行都拖不动；
 * 2. Sortable 的 `oldIndex/newIndex` 数的是 `<tbody>` 的**全部子节点**，
 *    而 antd 在固定表头/横向滚动时会先插一行 `ant-table-measure-row`，
 *    首屏无数据时还可能有占位行 —— 下标整体错位一格，
 *    表现为“把第 2 行拖到第 3 行，改名的却是第 1 行”。
 *
 * 所以断言分两层：钩子层用手工搭的 tbody（含前导测量行）验证下标换算与响应式配置，
 * 组件层验证 `dragSort` 真的把 Sortable 绑到了表格自己的 `<tbody>` 上。
 */

const sortableCalls: { destroy: () => void; el: HTMLElement; options: any }[] =
  [];

vi.mock('sortablejs', () => ({
  default: class FakeSortable {
    el: HTMLElement;
    options: any;

    constructor(el: HTMLElement, options: any) {
      this.el = el;
      this.options = options;
      sortableCalls.push(this as any);
    }

    destroy() {
      const index = sortableCalls.indexOf(this as any);
      if (index !== -1) sortableCalls.splice(index, 1);
    }
  },
}));

beforeEach(() => {
  sortableCalls.length = 0;
});

/** antd 的数据行是 `<tbody>` 里唯一带 `data-row-key` 的 `<tr>` */
function makeTbody(keys: string[], withMeasureRow = true) {
  const tbody = document.createElement('tbody');
  tbody.className = 'ant-table-tbody';
  if (withMeasureRow) {
    const measure = document.createElement('tr');
    measure.className = 'ant-table-measure-row';
    tbody.append(measure);
  }
  for (const key of keys) {
    const row = document.createElement('tr');
    row.dataset.rowKey = key;
    tbody.append(row);
  }
  return tbody;
}

function useDragSortInComponent(options: Parameters<typeof useDragSort>[0]) {
  let exposed!: ReturnType<typeof useDragSort>;
  const wrapper = mount(
    defineComponent({
      setup() {
        exposed = useDragSort(options);
        return () => h('div');
      },
    }),
  );
  return { exposed: exposed!, wrapper };
}

const ROWS = () => [
  { id: 1, name: '甲' },
  { id: 2, name: '乙' },
  { id: 3, name: '丙' },
  { id: 4, name: '丁' },
];

describe('useDragSort —— 下标换算', () => {
  it('前导的 ant-table-measure-row 不参与数据索引', () => {
    const dataSource = ref(ROWS());
    const { exposed, wrapper } = useDragSortInComponent({
      dataSource,
      enabled: true,
    });

    const tbody = makeTbody(['1', '2', '3', '4']);
    exposed.initSortable(tbody);

    const { options } = sortableCalls[0]!;
    // DOM 里第 1 行是测量行：oldIndex 1 → 数据下标 0，newIndex 3 → 数据下标 2
    options.onEnd({ newIndex: 3, oldIndex: 1 });

    expect(dataSource.value.map((row) => row.name)).toEqual([
      '乙',
      '丙',
      '甲',
      '丁',
    ]);
    wrapper.unmount();
  });

  it('没有测量行时下标原样使用', () => {
    const dataSource = ref(ROWS());
    const { exposed, wrapper } = useDragSortInComponent({
      dataSource,
      enabled: true,
    });

    exposed.initSortable(makeTbody(['1', '2', '3', '4'], false));
    sortableCalls[0]!.options.onEnd({ newIndex: 1, oldIndex: 3 });

    expect(dataSource.value.map((row) => row.name)).toEqual([
      '甲',
      '丁',
      '乙',
      '丙',
    ]);
    wrapper.unmount();
  });

  it('起点终点同一行时不动数据', () => {
    const dataSource = ref(ROWS());
    const { exposed, wrapper } = useDragSortInComponent({
      dataSource,
      enabled: true,
    });

    exposed.initSortable(makeTbody(['1', '2', '3', '4']));
    const before = dataSource.value;
    sortableCalls[0]!.options.onEnd({ newIndex: 2, oldIndex: 2 });

    expect(dataSource.value).toBe(before);
    wrapper.unmount();
  });
});

describe('useDragSort —— 配置读取', () => {
  it('选项用 getter 传入时，换配置不需要重建 Sortable', () => {
    const dataSource = ref(ROWS());
    const disabled = ref<((record: any) => boolean) | boolean>(
      (_record) => false,
    );
    const { exposed, wrapper } = useDragSortInComponent({
      dataSource,
      enabled: true,
      get disabled() {
        return disabled.value;
      },
    });

    exposed.initSortable(makeTbody(['1', '2', '3', '4']));
    expect(sortableCalls.length).toBe(1);

    const { options } = sortableCalls[0]!;
    expect(options.onStart({ oldIndex: 1, preventDefault: vi.fn() })).not.toBe(
      false,
    );

    disabled.value = true;
    expect(options.onStart({ oldIndex: 1, preventDefault: vi.fn() })).toBe(
      false,
    );
    wrapper.unmount();
  });

  it('enabled 为假时不绑定', () => {
    const dataSource = ref(ROWS());
    const { exposed, wrapper } = useDragSortInComponent({
      dataSource,
      enabled: false,
    });

    exposed.initSortable(makeTbody(['1', '2']));
    expect(sortableCalls.length).toBe(0);
    wrapper.unmount();
  });

  it('canDrop 为假时拒绝落点', () => {
    const dataSource = ref(ROWS());
    const { exposed, wrapper } = useDragSortInComponent({
      canDrop: (_drag, drop) => drop.name !== '丙',
      dataSource,
      enabled: true,
    });

    exposed.initSortable(makeTbody(['1', '2', '3', '4']));
    const { options } = sortableCalls[0]!;

    // DOM 下标 1（甲）→ 3（丁）要经过丙（数据下标 2）
    expect(options.onMove({ draggedRowIndex: 1, relatedRowIndex: 4 })).toBe(
      true,
    );
    expect(options.onMove({ draggedRowIndex: 1, relatedRowIndex: 3 })).toBe(
      false,
    );
    wrapper.unmount();
  });
});

describe('basicTable —— dragSort 属性', () => {
  const columns: BasicColumn[] = [
    { dataIndex: 'name', key: 'name', title: '名称' },
  ];

  const list = ROWS();
  const baseProps = {
    columns,
    dataSource: list,
    pagination: false,
    rowKey: 'id',
    scroll: {},
    showTableSetting: false,
  };

  it('开 dragSort 时把 Sortable 绑到自己的 tbody，并把新顺序同步回 raw 快照', async () => {
    const onDragEnd = vi.fn();
    const wrapper = mount(BasicTable, {
      props: {
        ...baseProps,
        dragSort: true,
        dragSortConfig: { animation: 200, handle: '.grip', onDragEnd },
      },
    });
    await nextTick();

    expect(sortableCalls.length).toBe(1);
    const tbody = wrapper.find('tbody').element as HTMLElement;
    expect(sortableCalls[0]!.el).toBe(tbody);
    expect(sortableCalls[0]!.options.animation).toBe(200);
    expect(sortableCalls[0]!.options.handle).toBe('.grip');

    sortableCalls[0]!.options.onEnd({ newIndex: 2, oldIndex: 1 });
    await nextTick();

    expect(onDragEnd).toHaveBeenCalledTimes(1);
    expect(
      wrapper.findAll('tbody tr[data-row-key]').map((row) => row.text()),
    ).toEqual(['甲', '丙', '乙', '丁']);
    // onDragEnd 里补了 setTableData，raw 快照必须跟着新顺序，否则“重置数据”会退回拖之前
    expect(
      (wrapper.vm as any).getRawDataSource().map((row: any) => row.name),
    ).toEqual(['甲', '丙', '乙', '丁']);
    wrapper.unmount();
  });

  it('不开 dragSort 时完全不碰 Sortable', async () => {
    const wrapper = mount(BasicTable, { props: baseProps });
    await nextTick();

    expect(sortableCalls.length).toBe(0);
    wrapper.unmount();
  });

  it('运行中把 dragSort 关掉会销毁实例', async () => {
    const wrapper = mount(BasicTable, {
      props: { ...baseProps, dragSort: true },
    });
    await nextTick();
    expect(sortableCalls.length).toBe(1);

    await wrapper.setProps({ dragSort: false });
    expect(sortableCalls.length).toBe(0);
    wrapper.unmount();
  });
});
