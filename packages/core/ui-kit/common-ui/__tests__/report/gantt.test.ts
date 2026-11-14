import type { GanttFieldMap, Row } from '../../src/report/core/types';

import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import dayjs from 'dayjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 甘特映射层的测试原则：`core/gantt.ts` 是本能力里**唯一有判断的地方**（格式归一、脏行处置、
 * 依赖过滤），所以这里尽量测全；组件层只测三件"接线是否成立"的事，其余交给 frappe 自己。
 * 每个 describe 的标题都写清"为什么值得测"，方便回归时一眼看出挂了会是什么线上现象。
 */
/* ============================ 一、纯映射层 ============================ */
import {
  toGanttDate,
  toGanttProgress,
  toGanttTasks,
} from '../../src/report/core/gantt';

const map: GanttFieldMap = {
  dependencies: 'dep',
  end: 'end',
  group: 'grp',
  id: 'id',
  name: 'name',
  progress: 'prog',
  start: 'start',
};

describe('toGanttDate：时间格式归一（为什么值得测：frappe 用按空格/-/: 切的手写解析器，ISO 的 T/Z 会被读丢、跨时区差一天）', () => {
  it('纯日期串走 date 粒度、原样输出 YYYY-MM-DD，把"补一整天"交给 frappe', () => {
    expect(toGanttDate('2024-01-05')).toEqual({
      granularity: 'date',
      text: '2024-01-05',
    });
  });

  it('不带时区的日期时间串走 datetime 粒度，输出空格分隔、无 T/Z', () => {
    expect(toGanttDate('2024-01-05 18:30:00')).toEqual({
      granularity: 'datetime',
      text: '2024-01-05 18:30:00',
    });
    expect(toGanttDate('2024-01-05T18:30:00')?.text).toBe(
      '2024-01-05 18:30:00',
    );
  });

  it('时间戳按本地时区格式化，但重新解析回来必须还是同一瞬间（不因格式化丢信息）', () => {
    const ts = Date.UTC(2024, 0, 2, 8, 0, 0);
    const hit = toGanttDate(ts);
    expect(hit?.granularity).toBe('datetime');
    expect(hit!.text).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/u);
    expect(dayjs(hit!.text).valueOf()).toBe(ts);
  });

  it('带 Z 的 ISO 也归一到 datetime 并保住瞬间值（时区差异不该改变任务落在哪一刻）', () => {
    const iso = '2024-06-15T12:00:00Z';
    const hit = toGanttDate(iso);
    expect(hit?.granularity).toBe('datetime');
    expect(dayjs(hit!.text).valueOf()).toBe(Date.parse(iso));
  });

  it('date 实例当带时刻处理；NaN 日期 / 空串 / null / undefined / 脏文本 / 布尔 / 对象一律 null', () => {
    expect(toGanttDate(new Date(2024, 0, 5))?.granularity).toBe('datetime');
    for (const value of [
      null,
      undefined,
      '',
      'N/A',
      '待定',
      '-',
      true,
      false,
      {},
      [],
      new Date('x'),
    ]) {
      expect(toGanttDate(value)).toBeNull();
    }
  });
});

describe('toGanttProgress：进度归一到 0~100（为什么值得测：frappe 内部按 /100 算条宽，喂 0~1 会被当成 0%~1%，里程碑几乎看不见）', () => {
  it('比率 0~1 放大到百分数，百分数原样保留', () => {
    expect(toGanttProgress(0.5)).toBe(50);
    expect(toGanttProgress(1)).toBe(100);
    expect(toGanttProgress(60)).toBe(60);
    expect(toGanttProgress('12.5%')).toBe(12.5);
  });

  it('越界夹到 [0,100]，非数值给 0', () => {
    expect(toGanttProgress(150)).toBe(100);
    expect(toGanttProgress(-5)).toBe(0);
    expect(toGanttProgress('N/A')).toBe(0);
    expect(toGanttProgress(null)).toBe(0);
  });
});

describe('toGanttTasks：缺失起止的行的处置（为什么值得测：frappe 会 console.error 后静默丢条，查起错来极难，这里要把原因显式带出来）', () => {
  it('缺开始 / 缺结束分别记 missing-start / missing-end，不进 tasks', () => {
    const { skipped, tasks } = toGanttTasks(
      [
        { end: '2024-01-05', id: 'a' },
        { id: 'b', start: '2024-01-05' },
      ],
      map,
    );
    expect(tasks).toHaveLength(0);
    expect(skipped.map((s) => s.reason)).toEqual([
      'missing-start',
      'missing-end',
    ]);
  });

  it('起止存在但解析不了 → invalid-start / invalid-end；空串按"没填"走 missing-*', () => {
    expect(
      toGanttTasks([{ end: '2024-01-05', id: 'a', start: 'N/A' }], map)
        .skipped[0]!.reason,
    ).toBe('invalid-start');
    expect(
      toGanttTasks([{ end: 'N/A', id: 'a', start: '2024-01-01' }], map)
        .skipped[0]!.reason,
    ).toBe('invalid-end');
    expect(
      toGanttTasks([{ end: '', id: 'a', start: '' }], map).skipped[0]!.reason,
    ).toBe('missing-start');
  });
});

describe('toGanttTasks：区间合法性（为什么值得测：结束早于开始是无意义区间，跨度>10 年 frappe 自己会丢，都必须在映射层挡住并说明）', () => {
  it('工期为 0（同日 / 同刻）是合法里程碑，保留而不是丢弃', () => {
    expect(
      toGanttTasks([{ end: '2024-03-01', id: 'a', start: '2024-03-01' }], map)
        .tasks,
    ).toHaveLength(1);
    expect(
      toGanttTasks(
        [{ end: '2024-03-01 09:00:00', id: 'a', start: '2024-03-01 09:00:00' }],
        map,
      ).tasks,
    ).toHaveLength(1);
  });

  it('结束早于开始 → end-before-start 丢弃', () => {
    const { skipped } = toGanttTasks(
      [{ end: '2024-03-10', id: 'a', start: '2024-03-20' }],
      map,
    );
    expect(skipped[0]!.reason).toBe('end-before-start');
  });

  it('跨度大于十年 → span-too-long；恰好十年边界留着（别和 frappe 的判定错位一格）', () => {
    expect(
      toGanttTasks([{ end: '2015-01-01', id: 'a', start: '2000-01-01' }], map)
        .skipped[0]!.reason,
    ).toBe('span-too-long');
    expect(
      toGanttTasks([{ end: '2010-01-01', id: 'a', start: '2000-01-01' }], map)
        .tasks,
    ).toHaveLength(1);
  });

  it('跨月的行原样保留起止字符串，映射层不做任何"取整到月"的多余处理', () => {
    const [task] = toGanttTasks(
      [{ end: '2024-02-05', id: 'a', start: '2024-01-28' }],
      map,
    ).tasks;
    expect(task).toMatchObject({ end: '2024-02-05', start: '2024-01-28' });
  });
});

describe('toGanttTasks：依赖引用（为什么值得测：frappe 会画一根指向空气的箭头，用户看到"莫名连了根线"却查不到来源）', () => {
  it('指向不存在行的依赖被删掉，指向存活行的保留；自引用也删', () => {
    const rows: Row[] = [
      { end: '2024-01-03', id: '1', start: '2024-01-01' },
      { dep: '1 9', end: '2024-01-05', id: '2', start: '2024-01-04' },
      { dep: '2', end: '2024-01-06', id: '3', start: '2024-01-05' },
    ];
    const { tasks } = toGanttTasks(rows, map);
    const byId = new Map(tasks.map((t) => [t.id, t]));
    expect(byId.get('2')!.dependencies).toEqual(['1']); // '9' 不存在被删
    expect(byId.get('3')!.dependencies).toEqual(['2']);
    // 自引用：让第 2 行依赖自己，应被过滤
    const [selfTask] = toGanttTasks(
      [{ dep: 'x', end: '2024-01-05', id: 'x', start: '2024-01-01' }],
      map,
    ).tasks;
    expect(selfTask!.dependencies).toEqual([]);
  });

  it('依赖能写成数组，也能写成逗号串；去空去重', () => {
    const rows: Row[] = [
      { end: '2024-01-03', id: '1', start: '2024-01-01' },
      {
        dep: ['1', '1', '', '  '],
        end: '2024-01-05',
        id: '2',
        start: '2024-01-04',
      },
    ];
    const [, two] = toGanttTasks(rows, map).tasks;
    expect(two!.dependencies).toEqual(['1']);
  });

  it('因为缺起止被丢弃的行不进 existing：活着的行依赖一个被丢的行 → 依赖被删但当前行仍画出来', () => {
    const rows: Row[] = [
      { id: 'ghost', name: '坏行' }, // 缺起止 → 被丢
      { dep: 'ghost', end: '2024-01-05', id: 'ok', start: '2024-01-01' },
    ];
    const { skipped, tasks } = toGanttTasks(rows, map);
    expect(skipped).toHaveLength(1);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]!.dependencies).toEqual([]);
  });
});

describe('toGanttTasks：空数据与兜底命名（为什么值得测：id 是依赖引用的锚点，缺 id/名称必须给稳定值而不是随机，否则刷新一次依赖全错位）', () => {
  it('空行数组返回空结构，不抛错，交给组件层走自己的空态', () => {
    expect(toGanttTasks([], map)).toEqual({ skipped: [], tasks: [] });
  });

  it('没配 id 列时按行序号生成稳定 id；没名称时名称回落到 id；分组原样透传', () => {
    const rows: Row[] = [
      { end: '2024-01-03', grp: '甲组', start: '2024-01-01' },
      { end: '2024-01-06', name: '有名', start: '2024-01-04' },
    ];
    const { tasks } = toGanttTasks(rows, map);
    expect(tasks[0]).toMatchObject({ group: '甲组', id: 'r1', name: 'r1' });
    expect(tasks[1]).toMatchObject({ id: 'r2', name: '有名' });
    expect(tasks[1]).not.toHaveProperty('group');
  });

  it('起止日期被写成 frappe 认得的空格格式（date 不带时分秒），进度/依赖都补齐成 frappe 需要的类型', () => {
    const { tasks } = toGanttTasks(
      [{ end: '2024-01-05', id: 'a', prog: 0.4, start: '2024-01-01' }],
      map,
    );
    expect(tasks[0]).toMatchObject({
      dependencies: [],
      end: '2024-01-05',
      progress: 40,
      start: '2024-01-01',
    });
  });
});

/* ============================ 二、组件层（最小桩） ============================ */

/**
 * frappe-gantt 构造时会用 `getBoundingClientRect`、`getBBox`、`scrollTo`、`createSVG` 等原生能力，
 * jsdom 不提供 `getBBox` / 元素 `scrollTo`，真实例会直接抛。这里**只对 frappe 的构造做最小桩**
 * （把任务数组渲染成 `data-gantt-bar` 的占位节点），映射层 `core/gantt.ts` 走真实实现——
 * 取舍：测的是"组件是否把对的数组喂给 frappe、生命周期干不干净"，不是 frappe 自己的排版，
 * 后者是库的责任，为了能在 jsdom 跑通不值得把整条链路都 mock 掉。
 */
const ganttSpy = vi.hoisted(() => ({
  changed: 0,
  cleared: 0,
  constructed: 0,
  instances: [] as unknown[],
  lastOptions: undefined as Record<string, unknown> | undefined,
  lastTasks: [] as Array<Record<string, unknown>>,
  refreshed: 0,
}));

vi.mock('frappe-gantt', () => {
  class FakeGantt {
    container: HTMLElement;
    options: Record<string, unknown>;
    tasks: Array<Record<string, unknown>>;
    constructor(
      container: HTMLElement,
      tasks: Array<Record<string, unknown>>,
      options: Record<string, unknown>,
    ) {
      this.container = container;
      this.tasks = tasks;
      this.options = options;
      ganttSpy.constructed += 1;
      ganttSpy.lastOptions = options;
      ganttSpy.lastTasks = tasks;
      ganttSpy.instances.push(this);
      this.render();
    }
    change_view_mode(): void {
      ganttSpy.changed += 1;
    }
    clear(): void {
      ganttSpy.cleared += 1;
      this.container.innerHTML = '';
    }
    refresh(tasks: Array<Record<string, unknown>>): void {
      ganttSpy.refreshed += 1;
      this.tasks = tasks;
      this.render();
    }
    render(): void {
      this.container.innerHTML = '';
      for (const task of this.tasks) {
        const el = this.container.ownerDocument!.createElement('div');
        el.dataset.ganttBar = '1';
        el.dataset.ganttId = String(task.id);
        this.container.append(el);
      }
    }
  }
  return { default: FakeGantt };
});

// 必须在 vi.mock 之后再引入被测组件，让组件里的 `import Gantt from 'frappe-gantt'` 命中上面的桩
const { default: ReportGantt } =
  await import('../../src/report/components/ReportGantt/ReportGantt.vue');

function ganttRows(): Row[] {
  return [
    { end: '2024-01-03', id: '1', name: '需求', start: '2024-01-01' },
    { end: '2024-01-06', id: '2', name: '开发', start: '2024-01-04' },
  ];
}

describe('reportGantt 组件层（为什么值得测：frappe 会在容器里建 SVG，卸载不清就是 DOM 泄漏；数据变了该原地更新而非重建丢滚动位置）', () => {
  beforeEach(() => {
    ganttSpy.changed = 0;
    ganttSpy.cleared = 0;
    ganttSpy.constructed = 0;
    ganttSpy.instances = [];
    ganttSpy.lastOptions = undefined;
    ganttSpy.lastTasks = [];
    ganttSpy.refreshed = 0;
  });

  it('渲染出不止一个任务条：两行合法数据 → frappe 收到两条任务并画两个条', async () => {
    const wrapper = mount(ReportGantt, {
      props: { fieldMap: map, rows: ganttRows() },
    });
    await nextTick();
    expect(ganttSpy.constructed).toBe(1);
    expect(ganttSpy.lastTasks).toHaveLength(2);
    expect(wrapper.findAll('[data-gantt-bar]')).toHaveLength(2);
    expect(
      wrapper.find('[data-slot="report-gantt"]').attributes('data-task-count'),
    ).toBe('2');
    // 默认只读 + Day 粒度
    expect(ganttSpy.lastOptions).toMatchObject({
      readonly: true,
      view_mode: 'Day',
    });
  });

  it('空数据走空态：不构造 frappe 实例，落到 shadcn 的 Empty', async () => {
    const wrapper = mount(ReportGantt, { props: { fieldMap: map, rows: [] } });
    await nextTick();
    expect(ganttSpy.constructed).toBe(0);
    expect(wrapper.find('[data-slot="report-gantt-empty"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-slot="report-gantt-host"]').exists()).toBe(
      false,
    );
  });

  it('卸载后容器被清：onBeforeUnmount 调 frappe.clear 并清空 innerHTML，不留残留 SVG', async () => {
    const wrapper = mount(ReportGantt, {
      props: { fieldMap: map, rows: ganttRows() },
    });
    await nextTick();
    const host = wrapper.find('[data-slot="report-gantt-host"]')
      .element as HTMLElement;
    expect(host.innerHTML).not.toBe('');
    wrapper.unmount();
    expect(ganttSpy.cleared).toBeGreaterThanOrEqual(1);
    expect(host.innerHTML).toBe('');
  });

  it('数据变了走原地更新而不是重建：改 rows 后 refresh+1、constructed 不变', async () => {
    const wrapper = mount(ReportGantt, {
      props: { fieldMap: map, rows: [ganttRows()[0]!] },
    });
    await nextTick();
    expect(ganttSpy.constructed).toBe(1);
    await wrapper.setProps({ rows: ganttRows() });
    await nextTick();
    await nextTick();
    expect(ganttSpy.constructed).toBe(1);
    expect(ganttSpy.refreshed).toBe(1);
    expect(wrapper.findAll('[data-gantt-bar]')).toHaveLength(2);
  });
});
