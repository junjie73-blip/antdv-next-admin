import type { BasicColumn, Recordable } from '../src/types';

import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import { describe, expect, it } from 'vitest';

import BasicTable from '../src/BasicTable.vue';

/**
 * 树形表格的"首屏自动展开"契约。
 *
 * 这里守的是一个只会用眼睛发现的缺陷：菜单管理/部门管理打开后
 * **只有目录那几行**，子菜单全折在箭头后面，搜索命中子项时更是像"查无结果"。
 *
 * 根因是 key 的类型：展开态的比较是 `expandedRowKeys.includes(rowKey)`，
 * 而业务表的主键几乎都是数字。一旦收集时把 key `String()` 了一遍，
 * 受控的 `expandedRowKeys` 就永远命中不了数据里的本体值。
 *
 * 所以断言全部围绕"子行在不点箭头的前提下出现在表体里"。
 */

const columns: BasicColumn[] = [
  { dataIndex: 'name', key: 'name', title: '名称' },
  { dataIndex: 'path', key: 'path', title: '地址' },
];

/** 三层树：数字 id（业务表的主键形态） */
const TREE = [
  {
    children: [
      {
        children: [{ id: 31, name: '新增用户', path: '' }],
        id: 21,
        name: '用户管理',
        path: '/system/user',
      },
    ],
    id: 11,
    name: '系统管理',
    path: '/system',
  },
];

/** 字符串 id 的表（文件 path 当主键那一类），类型必须原样保留 */
const STRING_TREE = [
  {
    children: [{ id: 'src/a.ts', name: 'a.ts' }],
    id: 'src',
    name: 'src',
  },
];

async function renderTree(dataSource: Recordable[], rowKey = 'id') {
  const wrapper = mount(BasicTable, {
    attachTo: document.body,
    props: {
      columns,
      dataSource,
      isTree: true,
      rowKey,
      showTableSetting: false,
      useSearchForm: false,
    },
  });
  // 展开态由 `watch(getDataSource, ..., { flush: 'post' })` 写入，多刷一帧才落到 DOM
  for (let i = 0; i < 4; i += 1) await nextTick();
  return wrapper;
}

const rowKeys = (wrapper: ReturnType<typeof mount>) =>
  [...wrapper.findAll('.basic-table-row')].map((row) =>
    row.attributes('data-row-key'),
  );

describe('BasicTable —— 树形首屏展开', () => {
  it('数字主键：子行不用点箭头就在表体里（含第三层）', async () => {
    const wrapper = await renderTree(TREE);

    expect(rowKeys(wrapper)).toEqual(['11', '21', '31']);
    expect(
      wrapper
        .find(
          '.basic-table-row[data-row-key="11"] .basic-table-row-expand-icon-expanded',
        )
        .exists(),
    ).toBe(true);
  });

  it('字符串主键同样成立（不能被归一成数字或反过来）', async () => {
    const wrapper = await renderTree(STRING_TREE);

    expect(rowKeys(wrapper)).toEqual(['src', 'src/a.ts']);
  });

  it('点箭头折叠后，key 类型仍然对得上（受控回写不能把类型洗掉）', async () => {
    const wrapper = await renderTree(TREE);

    const toggle = () =>
      wrapper
        .find('.basic-table-row[data-row-key="11"] .basic-table-row-expand-icon')
        .trigger('click');

    await toggle();
    for (let i = 0; i < 3; i += 1) await nextTick();
    expect(rowKeys(wrapper)).toEqual(['11']);

    await toggle();
    for (let i = 0; i < 3; i += 1) await nextTick();
    expect(rowKeys(wrapper)).toEqual(['11', '21', '31']);
  });
});
