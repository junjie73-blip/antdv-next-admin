import { mount } from '@vue/test-utils';
import { h } from 'vue';

import { describe, expect, it } from 'vitest';

import PageSkeleton from '../src/components/skeleton/PageSkeleton.vue';
import TableSkeleton from '../src/components/skeleton/TableSkeleton.vue';

// shadcn Skeleton 根节点带 data-slot="skeleton"，用它统计占位块数量
const bars = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAll('[data-slot="skeleton"]').length;

describe('PageSkeleton', () => {
  it('page 变体默认：标题1 + 操作3 + 行5 = 9 块', () => {
    expect(bars(mount(PageSkeleton, { props: { variant: 'page' } }))).toBe(9);
  });

  it('rows 控制行数', () => {
    expect(
      bars(mount(PageSkeleton, { props: { rows: 2, variant: 'page' } })),
    ).toBe(1 + 3 + 2);
  });

  it('showTitle/showActions 关闭对应区块', () => {
    expect(
      bars(
        mount(PageSkeleton, {
          props: { showTitle: false, variant: 'page' },
        }),
      ),
    ).toBe(3 + 5);
    expect(
      bars(
        mount(PageSkeleton, {
          props: { showActions: false, variant: 'page' },
        }),
      ),
    ).toBe(1 + 5);
  });

  it('showSidebar 增加 2 块侧栏占位', () => {
    expect(
      bars(
        mount(PageSkeleton, {
          props: { showSidebar: true, variant: 'page' },
        }),
      ),
    ).toBe(9 + 2);
  });

  it('card 变体 6 张卡×3 = 18 块', () => {
    expect(bars(mount(PageSkeleton, { props: { variant: 'card' } }))).toBe(18);
  });

  it('form 变体 4×2 + 2 = 10 块', () => {
    expect(bars(mount(PageSkeleton, { props: { variant: 'form' } }))).toBe(10);
  });

  it('detail 变体 头像1 + 头部2 + 字段12 = 15 块', () => {
    expect(bars(mount(PageSkeleton, { props: { variant: 'detail' } }))).toBe(
      15,
    );
  });

  it('loading=false 渲染插槽、不渲染占位块', () => {
    const wrapper = mount(PageSkeleton, {
      props: { loading: false },
      slots: { default: () => h('div', { class: 'real' }, '内容') },
    });
    expect(bars(wrapper)).toBe(0);
    expect(wrapper.find('.real').exists()).toBe(true);
  });

  it('class 透传到容器', () => {
    const wrapper = mount(PageSkeleton, { props: { class: 'my-page' } });
    expect(wrapper.find('.my-page').exists()).toBe(true);
  });
});

describe('TableSkeleton', () => {
  it('默认：表头6 + 数据48 + 分页6 = 60 块', () => {
    expect(bars(mount(TableSkeleton))).toBe(6 + 8 * 6 + 6);
  });

  it('showActions=false 去掉操作列（表头/数据各减）', () => {
    expect(
      bars(mount(TableSkeleton, { props: { showActions: false } })),
    ).toBe(5 + 8 * 5 + 6);
  });

  it('showHeader=false 去掉表头', () => {
    expect(
      bars(mount(TableSkeleton, { props: { showHeader: false } })),
    ).toBe(0 + 8 * 6 + 6);
  });

  it('showPagination=false 去掉分页占位', () => {
    expect(
      bars(mount(TableSkeleton, { props: { showPagination: false } })),
    ).toBe(6 + 8 * 6);
  });

  it('loading=false 渲染插槽', () => {
    const wrapper = mount(TableSkeleton, {
      props: { loading: false },
      slots: { default: () => h('div', { class: 'tbl' }, '表') },
    });
    expect(bars(wrapper)).toBe(0);
    expect(wrapper.find('.tbl').exists()).toBe(true);
  });

  it('columns/rows 驱动数量', () => {
    expect(
      bars(mount(TableSkeleton, { props: { columns: 2, rows: 3 } })),
    ).toBe(3 + 3 * 3 + 6);
  });
});
