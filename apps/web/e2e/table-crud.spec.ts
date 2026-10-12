import type { Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import { go, LIMITED_ACCOUNT, signIn, watchErrors } from './utils/app';

/**
 * 「增删改查」示例页：`useCRUD` + `ActionItem.auth` 的端到端闭环。
 *
 * 这一页存在的理由是两条别处观测不到的性质：
 * 1. **写操作真的落库**。`useCRUD` 把「校验 → 调接口 → 提示 → 关窗 → reload」串成一条，
 *    任何一环接错（保存没带 id 变成新增、reload 没触发、详情接口没实现导致回填空表单）
 *    在单测里都可能被替身掩盖，只有真跑一遍"新增完能在列表里搜到并改掉"才暴露。
 *    mock 是进程内状态，所以用例创建的每一行都在结尾删回去，不给后面的用例留脏数据。
 * 2. **按钮级权限的不对称**。同一张表，admin（`permissions: ['*']`）看得见删除，
 *    custom 只给了 `demo:task:add / edit`、故意没给 `demo:task:remove`。
 *    这条差异是 `ActionItem.auth` 唯一的观测点 —— 只测"custom 进不去某些页面"
 *    等于只测了路由层，按钮层坏了没人知道。
 *
 * 新增的行落在最后一页（列表按插入顺序、默认每页 10 条），所以断言一律先按关键词筛
 * 再定位那一行，不去翻页。
 */

const PAGE_PATH = '/components/table/crud';

/** 按关键词筛出唯一一行（表格自带的搜索表单） */
async function filterBy(page: Page, text: string) {
  await page.getByPlaceholder('标题 / 负责人 / 备注').fill(text);
  await page.getByRole('button', { name: '查询' }).first().click();
  const rows = page.locator('.ant-table-tbody .ant-table-row');
  await expect(rows.first(), `筛选「${text}」后一行都没有`).toBeVisible();
  return rows;
}

function modal(page: Page) {
  return page.getByRole('dialog').last();
}

/** 新增一行：填标题 + 负责人，提交 */
async function createTask(page: Page, title: string, owner = '自动化用例') {
  // `exact` 是必须的：弹窗关掉后它那颗 × 的 `aria-label` 是「关闭 新增任务」，
  // 模糊匹配会撞成 2 个命中（第二次新增起才复现，第一次跑反而是绿的）
  await page.getByRole('button', { exact: true, name: '新增任务' }).click();
  await expect(modal(page)).toBeVisible();
  await modal(page).getByPlaceholder('请输入任务标题').fill(title);
  await modal(page).getByPlaceholder('请输入负责人').fill(owner);
  await modal(page)
    .getByRole('button', { name: /保\s*存|确\s*定|确\s*认/ })
    .first()
    .click();
  await expect(page.locator('.ant-message-success').first()).toBeVisible();
}

test.describe('增删改查示例（useCRUD）', () => {
  test('新增 → 搜到 → 编辑回填 → 删除，整条链路真的落到 mock 数据里', async ({
    page,
  }) => {
    await signIn(page);
    const probe = watchErrors(page);
    await go(page, PAGE_PATH);

    await expect(
      page.locator('.ant-table-tbody .ant-table-row').first(),
      '表格首屏没有数据行',
    ).toBeVisible();

    const title = `useCRUD 闭环验证-${Date.now()}`;
    await createTask(page, title);

    // 新增成功 ≠ 落库：断言"按标题能筛出来"，这才是 reload 之后真的重新拉了数据
    const rows = await filterBy(page, title);
    expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('待处理');

    // ---- 编辑：弹窗要回填原值，改完标题落在列表里 ----
    await rows
      .first()
      .getByRole('button', { name: /编辑/ })
      .click();
    await expect(modal(page)).toBeVisible();
    await expect(
      modal(page).getByPlaceholder('请输入任务标题'),
      '编辑弹窗没有回填原标题（多半是详情接口没接上）',
    ).toHaveValue(title);

    const edited = `${title}（改）`;
    await modal(page).getByPlaceholder('请输入任务标题').fill(edited);
    await modal(page)
      .getByRole('button', { name: /保\s*存|确\s*定|确\s*认/ })
      .first()
      .click();
    await expect(page.locator('.ant-message-success').first()).toBeVisible();

    await expect
      .poll(
        async () => {
          await page.getByPlaceholder('标题 / 负责人 / 备注').fill(edited);
          await page.getByRole('button', { name: '查询' }).first().click();
          return await page
            .locator('.ant-table-tbody .ant-table-row')
            .filter({ hasText: edited })
            .count();
        },
        {
          message: '编辑后筛不出改过的标题（save 没带 id 会变成新增）',
          timeout: 15_000,
        },
      )
      .toBe(1);

    // ---- 删除：必须二次确认，确认后那行真的消失 ----
    const target = page
      .locator('.ant-table-tbody .ant-table-row')
      .filter({ hasText: edited })
      .first();
    await target.getByRole('button', { name: /删除/ }).click();
    const confirm = page
      .locator('.ant-popover')
      .filter({ hasText: '确定删除这个任务吗' })
      .last();
    await expect(confirm, '删除任务没有二次确认').toBeVisible();
    await expect(confirm).toContainText('删除后不可恢复');
    await confirm
      .getByRole('button', { name: /确\s*定|确\s*认|OK/ })
      .last()
      .click();

    await expect
      .poll(
        async () => {
          await page.getByPlaceholder('标题 / 负责人 / 备注').fill(edited);
          await page.getByRole('button', { name: '查询' }).first().click();
          return await page
            .locator('.ant-table-tbody .ant-table-row')
            .filter({ hasText: edited })
            .count();
        },
        { message: '确认后那行任务仍在列表里', timeout: 15_000 },
      )
      .toBe(0);

    expect(
      probe.badResponses,
      `接口报错：${probe.badResponses.join('; ')}`,
    ).toEqual([]);
    expect(probe.errors).toEqual([]);
    probe.stop();
  });

  test('批量删除：按钮上带选中条数，确认框里的条数与选中一致', async ({
    page,
  }) => {
    await signIn(page);
    await go(page, PAGE_PATH);

    const tag = `批量-${Date.now()}`;
    await createTask(page, `${tag}-A`);
    await createTask(page, `${tag}-B`);

    const rows = await filterBy(page, tag);
    expect(rows, '两行都该被同一个关键词筛出来').toHaveCount(2);

    await rows.first().locator('.ant-checkbox-input').check();
    await rows.nth(1).locator('.ant-checkbox-input').check();

    const batch = page.getByRole('button', { name: /批量删除/ });
    await expect(batch).toContainText('2');
    await batch.click();

    const confirm = page
      .locator('.ant-modal')
      .filter({ hasText: '批量删除' })
      .last();
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText('（2 条）');

    await confirm
      .getByRole('button', { name: /确\s*定|确\s*认|OK/ })
      .last()
      .click();
    await expect
      .poll(
        async () => {
          await page.getByPlaceholder('标题 / 负责人 / 备注').fill(tag);
          await page.getByRole('button', { name: '查询' }).first().click();
          return await page
            .locator('.ant-table-tbody .ant-table-row')
            .filter({ hasText: tag })
            .count();
        },
        {
          message: '批量删除后两行仍在（逐条 onDelete 没跑通）',
          timeout: 15_000,
        },
      )
      .toBe(0);
  });

  test('取消批量删除：一行都不该消失', async ({ page }) => {
    await signIn(page);
    await go(page, PAGE_PATH);

    const title = `仅取消-${Date.now()}`;
    await createTask(page, title);
    const rows = await filterBy(page, title);
    await rows.first().locator('.ant-checkbox-input').check();

    await page.getByRole('button', { name: /批量删除/ }).click();
    const confirm = page
      .locator('.ant-modal')
      .filter({ hasText: '批量删除' })
      .last();
    await confirm
      .getByRole('button', { name: /取\s*消|Cancel/ })
      .last()
      .click();

    // 取消后那一行必须还在：确认框的 onOk/onCancel 接反的表现就是"取消也删了"
    await expect(
      page
        .locator('.ant-table-tbody .ant-table-row')
        .filter({ hasText: title })
        .first(),
    ).toBeVisible();

    // 收尾清理，别把这行留给后面的用例
    await page
      .locator('.ant-table-tbody .ant-table-row')
      .filter({ hasText: title })
      .first()
      .getByRole('button', { name: /删除/ })
      .click();
    await page
      .locator('.ant-popover')
      .filter({ hasText: '确定删除这个任务吗' })
      .last()
      .getByRole('button', { name: /确\s*定|确\s*认|OK/ })
      .last()
      .click();
  });

  test('按钮级权限：custom 看得见页面与「新增/编辑」，看不见「删除」', async ({
    page,
  }) => {
    await signIn(page, LIMITED_ACCOUNT);
    const probe = watchErrors(page);
    await go(page, PAGE_PATH);

    // 页面本身可达（菜单白名单里有 DemoTableCrud），数据也拉得到
    await expect(
      page.locator('.ant-table-tbody .ant-table-row').first(),
    ).toBeVisible();
    expect(probe.badResponses).toEqual([]);

    // 有 add / edit：工具栏与操作列都该出现
    await expect(
      page.getByRole('button', { exact: true, name: '新增任务' }),
    ).toBeVisible();
    await expect(
      page
        .locator('.ant-table-tbody .ant-table-row')
        .first()
        .getByRole('button', { name: /编辑/ }),
    ).toBeVisible();

    // 没有 remove：整页找不到任何删除入口（工具栏按钮 + 每一行的操作项）
    await expect(page.getByRole('button', { name: /批量删除/ })).toHaveCount(0);
    await expect(
      page.locator('.ant-table-row').getByRole('button', { name: /删除/ }),
    ).toHaveCount(0);

    probe.stop();
  });
});
