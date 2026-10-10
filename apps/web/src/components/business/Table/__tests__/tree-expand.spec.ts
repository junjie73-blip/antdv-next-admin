import type { BasicColumn } from '../types';

import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import BasicTable from '../BasicTable.vue';

/**
 * 树形表格的"首屏自动展开"契约。
 *
 * 这里守的是一个只会用眼睛发现的缺陷：菜单管理/部门管理打开后
 * **只有目录那几行**，子菜单全折在箭头后面，搜索命中子项时更是像"查无结果"。
 *
 * 根因是 key 的类型：`collectExpandableKeys` 把主键 `String()` 了一遍，
 * 而 antd 比较展开态用的是 `record[rowKey]` **本体**（业务表几乎都是数字 id）。
 * 受控的 `expandedRowKeys` 一旦与数据里的 key 类型不一致就永远命中不了，
 * 还会顺带把同批传下去的 `defaultExpandAllRows: true` 顶掉
 * （antd 见到非 undefined 的受控 keys 就不再走"默认全展开"）。
 *
 * 所以断言全部围绕"子行在不点箭头的前提下出现在 DOM 里"。
 */

const columns: BasicColumn[] = [
  { dataIndex: 'name', key: 'name', title: '名称' },
  { dataIndex: 'path', key: 'path', title: '地址' },
];

/** 三层树：数字 id（业务表的主键形态） */
const TREE = [
  {
    children: [
      { children: [{ id: 31, name: '新增用户', path: '' }], id: 21, name: '用户管理', path: '/system/user' },
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
    props: {
      columns,
      dataSource,
      isTree: true,
      rowKey,
      showTableSetting: false,
      useSearchForm: false,
    },
    attachTo: document.body,
  });
  // 展开态由 `watch(getDataSource, ..., { flush: 'post' })` 写入，多刷一帧才落到 DOM
  for (let i = 0; i < 4; i += 1) await nextTick();
  return wrapper;
}

const rowKeys = (wrapper: ReturnType<typeof mount>) =>
  [...wrapper.findAll('.ant-table-tbody .ant-table-row')].map((row) =>
    row.attributes('data-row-key'),
  );

describe('BasicTable —— 树形表格首屏展开', () => {
  it('数字主键：子行不用点箭头就在表体里（含第三层）', async () => {
    const wrapper = await renderTree(TREE);

    expect(rowKeys(wrapper)).toEqual(['11', '21', '31']);
    // 「展开」的 class 也是证据：只有真的受控命中，antd 才给 expanded
    expect(
      wrapper.find('.ant-table-row[data-row-key="11"] .ant-table-row-expand-icon-expanded').exists(),
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
        .find('.ant-table-row[data-row-key="11"] .ant-table-row-expand-icon')
        .trigger('click');

    await toggle();
    for (let i = 0; i < 3; i += 1) await nextTick();
    expect(rowKeys(wrapper)).toEqual(['11']);

    await toggle();
    for (let i = 0; i < 3; i += 1) await nextTick();
    // 手点一轮再展开：子行必须回得来，说明 antd 回传的 key 与我们给的能互相命中
    expect(rowKeys(wrapper)).toEqual(['11', '21', '31']);
  });
});
