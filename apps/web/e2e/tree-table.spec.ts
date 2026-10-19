import type { Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import { go, signIn, watchErrors } from './utils/app';

/**
 * TreeTable（`@antdv/table-ui`）的「选节点 → 驱动右侧表格取数」闭环。
 *
 * 这一页要盯的只有一件事：**组件从 `apps/web/src/components/business/` 搬进
 * `packages/core/ui-kit/table-ui/src/components/TreeTable.vue` 之后，左侧树的选中
 * 仍然能把参数交给调用方的 `tableApi`**。搬迁最容易弄丢的是两处内部状态桥：
 * 1. 选中态（`selectedKey`）变了要重新取数，而且模板只在「已选节点」时才挂表格；
 * 2. 对外的分页字段是 `page`，内部数据源用的是 `pageNum`，换算点在组件里
 *    （`TreeTable.vue:134-140`）。示例页按 `params.page` 切片，接错会直接筛空。
 *
 * 断言靠示例页自带的本地 mock 数据（`tree-table/index.vue:53-209`，每个部门的人数固定），
 * 不依赖接口，所以这条用例也不会被 mock 进程状态影响。
 */

const PAGE_PATH = '/components/table/tree-table';

/** `@antdv/table-ui` 的行，不是 antd 的 `.ant-table-row` */
const ROW = 'tr.basic-table-row';

/**
 * 树节点。`@antdv/common-ui` 的 Tree 是自绘的 div 树（`TreeNodes.vue:47-52`），
 * 没有 role/aria 语义，可点的那一行靠 `data-common-tree-node` 标记。
 */
const NODE = '[data-common-tree-node]';

/** 点树上的一个部门：整行 div 带 click，等于真人点击 */
async function selectDept(page: Page, title: string) {
  await page.locator(NODE).filter({ hasText: title }).first().click();
}

/** 表格底部那行「共 N 条」（默认 showTotal，`hooks/usePagination.ts:18`） */
function totalText(page: Page) {
  return page.getByText(/^共 \d+ 条$/).first();
}

test.describe('树表格（TreeTable）', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('选部门 → 表格按该部门取数，切部门不带旧数据', async ({ page }) => {
    const errors = watchErrors(page);
    await go(page, PAGE_PATH);

    // 未选节点时右侧只是占位，不挂表格
    await expect(page.locator(ROW)).toHaveCount(0);
    await expect(page.getByText('请在左侧选择节点查看数据')).toBeVisible();
    // treeDefaultExpandAll 默认 true，全树展开
    await expect(page.locator(NODE)).toHaveCount(13);

    // 前端开发组：3 人
    await selectDept(page, '前端开发组');
    await expect(page.locator(ROW)).toHaveCount(3);
    await expect(totalText(page)).toHaveText('共 3 条');
    await expect(page.getByText('张三')).toBeVisible();

    // 测试组：2 人 —— 换节点后行数与总数都跟着变，说明 selectedKey 真的进了取数参数
    await selectDept(page, '测试组');
    await expect(page.locator(ROW)).toHaveCount(2);
    await expect(totalText(page)).toHaveText('共 2 条');
    await expect(page.getByText('吴九')).toBeVisible();
    await expect(page.getByText('张三')).toHaveCount(0);

    // 分支节点刻意是空名单：能选中但表格走空态（不是「还没选」的占位）
    // 页脚那行「共 N 条」这里不断言 —— `useDataSource.ts:177` 的 `total > 0` 兜底
    // 会让空响应保留上一次的总数，属于 table-ui 既有行为，不在这次迁移范围内。
    await selectDept(page, '技术部');
    await expect(page.locator(ROW)).toHaveCount(0);
    await expect(page.getByText('暂无数据')).toBeVisible();

    // 财务部挂在总公司下，人数非 0 —— 再次证明 treeKey 换到了不同数据源
    await selectDept(page, '财务部');
    await expect(page.locator(ROW)).toHaveCount(2);
    await expect(totalText(page)).toHaveText('共 2 条');

    expect(errors.errors).toEqual([]);
  });

  test('搜索框过滤树，命中路径上的节点都留着', async ({ page }) => {
    const errors = watchErrors(page);
    await go(page, PAGE_PATH);

    await page.getByPlaceholder('请输入关键词搜索').fill('后端');
    // 总公司 → 技术部 → 后端开发组：未命中的兄弟节点被剪掉，命中链全留
    await expect(page.locator(NODE)).toHaveCount(3);
    await expect(page.getByText('前端开发组')).toHaveCount(0);
    await expect(page.getByText('后端开发组')).toBeVisible();

    // 清空后恢复全树
    await page.getByPlaceholder('请输入关键词搜索').fill('');
    await expect(page.locator(NODE)).toHaveCount(13);

    expect(errors.errors).toEqual([]);
  });
});
