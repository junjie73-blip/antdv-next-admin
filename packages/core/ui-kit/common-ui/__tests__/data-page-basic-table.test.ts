import { flushPromises, mount } from '@vue/test-utils';

import { describe, expect, it, vi } from 'vitest';

/** api 模式首屏取数走 setTimeout(0)，flushPromises 不等待真实定时器 */
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 20));
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 20));
  await flushPromises();
}

import DataPage from '../src/components/data-page/DataPage.vue';

/**
 * DataPage 改用 BasicTable 生态后的回归守护：
 * 表格主体走 BasicTable（data-row-key / basic-table 容器）、行选择、查询表单、
 * 状态列 Tag、操作列三按钮都应存在，且对外 DataPageProps 契约不变。
 */
function makeProps() {
  return {
    title: '项目列表',
    description: '全部项目',
    columns: [
      { key: 'id', title: '编号' },
      { key: 'name', title: '项目名称' },
      { key: 'status', title: '状态' },
      { key: 'progress', title: '进度' },
    ],
    rows: [
      {
        id: 'P-001',
        name: '管理后台 2.0',
        status: '进行中',
        progress: '72%',
      },
      {
        id: 'P-002',
        name: '数据平台重构',
        status: '已完成',
        progress: '45%',
      },
    ],
    filters: [
      {
        key: 'status',
        label: '项目状态',
        options: [{ label: '进行中', value: '进行中' }],
      },
    ],
    statusKey: 'status',
    statusColors: { 进行中: 'blue', 已完成: 'green' },
  };
}

describe('dataPage with BasicTable', () => {
  it('表格由 BasicTable 渲染：容器、行、data-row-key 齐备', async () => {
    const wrapper = mount(DataPage, { props: makeProps() });
    await settle();

    expect(wrapper.find('.basic-table').exists()).toBe(true);
    const rows = wrapper.findAll('.basic-table-tbody tr[data-row-key]');
    // 调试：打印 tbody 结构
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.attributes('data-row-key'))).toEqual([
      'P-001',
      'P-002',
    ]);
  });

  it('行选择复选框与操作列三按钮存在', async () => {
    const wrapper = mount(DataPage, { props: makeProps() });
    await settle();

    expect(wrapper.find('.basic-table-select-all').exists()).toBe(true);
    expect(wrapper.find('.basic-table-row-checkbox').exists()).toBe(true);

    const text = wrapper.text();
    expect(text).toContain('详情');
    expect(text).toContain('编辑');
    expect(text).toContain('删除');
    expect(text).toContain('批量删除');
  });

  it('查询表单由 BasicForm 渲染（关键字 + 筛选项）', async () => {
    const wrapper = mount(DataPage, { props: makeProps() });
    await settle();

    const text = wrapper.text();
    expect(text).toContain('关键词');
    expect(text).toContain('项目状态');
  });

  it('行操作整组居中，工具栏操作项在右侧操作区', async () => {
    const wrapper = mount(DataPage, { props: makeProps() });
    await settle();

    const firstRow = wrapper.find('.basic-table-tbody tr[data-row-key]');
    const actions = firstRow.find('[data-table-action]');
    expect(actions.classes()).toContain('justify-center');
    expect(wrapper.find('[data-page="toolbar-actions"]').exists()).toBe(true);
  });

  it('默认每页 10 条，分页选项也从 10 起', async () => {
    const api = vi.fn(async (_params: Record<string, any>) => ({
      list: makeProps().rows,
      total: makeProps().rows.length,
    }));
    const wrapper = mount(DataPage, { props: { ...makeProps(), api } });
    await settle();

    expect(api.mock.calls[0]![0]).toMatchObject({ pageNum: 1, pageSize: 10 });
    expect(wrapper.text()).toContain('10 条/页');
    expect(wrapper.text()).not.toContain('8 条/页');
  });

  it('行级权限为 false 时隐藏对应编辑与删除入口', async () => {
    const props = {
      ...makeProps(),
      canDeleteRow: (row: Record<string, any>) => row.id === 'P-001',
      canEditRow: (row: Record<string, any>) => row.id === 'P-001',
    };
    const wrapper = mount(DataPage, { props });
    await settle();

    const rows = wrapper.findAll('.basic-table-tbody tr[data-row-key]');
    expect(rows[0]!.text()).toContain('编辑');
    expect(rows[0]!.text()).toContain('删除');
    expect(rows[1]!.text()).not.toContain('编辑');
    expect(rows[1]!.text()).not.toContain('删除');
  });

  it('宿主 extraActions 由统一操作栏渲染，按钮默认 text 变体', async () => {
    const onClick = vi.fn();
    const wrapper = mount(DataPage, {
      props: {
        ...makeProps(),
        extraActions: [{ icon: 'carbon:send', label: '发布', onClick }],
      },
    });
    await settle();

    const firstRow = wrapper.find('.basic-table-tbody tr[data-row-key]');
    const buttons = firstRow.findAll('button');
    expect(buttons.map((b) => b.text().trim())).toEqual([
      '发布',
      '详情',
      '编辑',
      '删除',
    ]);
    for (const button of buttons) {
      expect(button.attributes('data-variant')).toBe('ghost');
    }
    await buttons[0]!.trigger('click');
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
