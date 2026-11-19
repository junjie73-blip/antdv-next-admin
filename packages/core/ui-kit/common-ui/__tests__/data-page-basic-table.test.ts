import { flushPromises, mount } from '@vue/test-utils';

import { describe, expect, it } from 'vitest';

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
});
