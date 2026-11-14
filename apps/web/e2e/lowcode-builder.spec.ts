import type { Locator, Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import { go, signIn, watchErrors } from './utils/app';

/**
 * 低代码搭建示例页的浏览器验证。
 *
 * 包内单测（123 条）已经把 `core/dsl`、`core/binding`、`core/datasource` 的口径证明白了，
 * 但有三类结论只有真浏览器给得出来，这一页就照着它们写：
 *
 * 1. **装配是共享的**。示例页把 `page.context` 同时传给渲染器、面板、大纲、属性面板。
 *    各传各的会出现「每块组件自己 `createLowcodeContext()` 一套注册表」：照样能跑，
 *    但渲染器发现的未知类型/坏表达式落在它自己那套的 `report` 里，宿主的运行态面板永远干净 ——
 *    最难查的假绿。所以每条用例都顺手断言「没有运行期错误」那句话真的在。
 * 2. **拖拽载荷走的是真 `DataTransfer`**。包内单测传的是自制的等价对象（jsdom 没有
 *    `DataTransfer`），自定义 MIME 在 WebKit 上读不读得到、`text/plain` 兜底生不生效，
 *    只有浏览器知道。这里用真 `DataTransfer` 构造 dragstart/drop 序列，三个引擎同一条路径
 *    （Playwright 的鼠标拖拽在 Firefox 上不吃 HTML5 DnD，用它就会产出一条只有两个引擎绿的假象）。
 * 3. **绑定 → 求值 → 写回 → 重渲染这条链跨三层**：打字改的是 scope，scope 改的是 DOM，
 *    DOM 改的又是另两个面板看到的同一份 Schema。任何一层用了私有副本，这里就会断在中间。
 *
 * 数据全程走示例页自己注入的假 fetcher（`configureLowcode({ fetcher })`），
 * 一次业务请求都不发，所以 `badResponses` 为空本身也是一条结论。
 */

const RENDERER = '[data-slot="lowcode-renderer"]';
const OUTLINE_ROW = '[data-slot="lowcode-outline-row"]';
const INSPECTOR = '[data-slot="lowcode-inspector"]';
const MATERIAL = '[data-material-type]';
const ROOT_DROP = '[data-action="drop-root"]';

/** 示例页 Schema 里写死的节点 id：断言绑定与条件时用它们定位，比按文案猜稳 */
const NODE = {
  badge: 'node-badge-count',
  dept: 'node-input-dept',
  footer: 'node-text-footer',
  hello: 'node-text-hello',
  history: 'node-text-history',
  members: 'node-table-members',
  name: 'node-input-name',
  title: 'node-text-title',
};

function renderer(page: Page): Locator {
  return page.locator(RENDERER);
}

function node(page: Page, id: string): Locator {
  return renderer(page).locator(`[data-node-id="${id}"]`);
}

function outlineRow(page: Page, id: string): Locator {
  return page.locator(`${OUTLINE_ROW}[data-node-id="${id}"]`);
}

/** 顶部「N 个节点」那枚徽标里的数字：所有增删用例的共同观测量 */
async function nodeCount(page: Page): Promise<number> {
  const text = await page
    .getByText(/\d+ 个节点/)
    .first()
    .innerText();
  return Number(text.match(/\d+/u)?.[0] ?? -1);
}

async function openLowcodePage(page: Page) {
  await signIn(page);
  await go(page, '/enterprise/lowcode');
  await expect(renderer(page)).toBeVisible();
  // 路由级 loading 罩层（`role="status"` 的整屏遮罩）会吃掉导航后第一次点击
  await expect(page.getByText('页面加载中')).toBeHidden();
}

test.describe('低代码搭建', () => {
  test('首屏把 Schema 渲染成真实组件：绑定求值、数据源写回、表格吃到假 fetcher', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await openLowcodePage(page);

    // `{{ form.dept }}` 来自 schema.state，`{{ summary.count }}` 来自 function 源：
    // 一个标题里就同时验掉「绑定求值」和「装载顺序（members 在 roles 之后、count 在 members 之后）」
    await expect(node(page, NODE.title)).toHaveText('平台组 的成员概览');
    await expect(node(page, NODE.badge)).toHaveText('3 人');
    await expect(node(page, NODE.footer)).toHaveText('数据来自 3 条记录');

    // 表格三行来自假 fetcher 的响应：说明 rest 源 → path 写回 → `{{ members }}` → 物料 props 走通了
    for (const name of ['张三', '李四', '王五']) {
      await expect(node(page, NODE.members)).toContainText(name);
    }
    await expect(node(page, NODE.members).locator('tbody tr')).toHaveCount(3);

    // 共享装配的直接结果：渲染器没发现未知类型，宿主面板才是这句「没有运行期错误」
    await expect(page.getByText('没有运行期错误')).toBeVisible();
    // 4 个源里只有 3 个进计数：`sync` 是 `auto: false` 的手动源，装载阶段一次都不该跑
    await expect(page.getByText(/数据源 \d+ 个已装载/)).toContainText('3');
    expect(errors.errors).toEqual([]);
    expect(errors.badResponses).toEqual([]);
  });

  test('双向绑定成对生效：打字让条件节点出现，改部门让标题当场跟着变', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await openLowcodePage(page);

    // `condition: '{{ len(form.name) > 0 }}'` 为假时整节点不渲染，不是 display:none
    await expect(node(page, NODE.hello)).toHaveCount(0);

    await node(page, NODE.name).locator('input').fill('张三');
    await expect(node(page, NODE.hello)).toHaveText('你好，张三');

    // 同一条路径的反方向：读 `{{ form.dept }}` 的标题在 dept 改动后重渲染
    await node(page, NODE.dept).locator('input').fill('支付组');
    await expect(node(page, NODE.title)).toHaveText('支付组 的成员概览');
    // 合计源依赖 members，members 依赖 dept 参数 —— 换部门会重发，徽章数字仍应存在
    await expect(node(page, NODE.badge)).toHaveText('3 人');

    expect(errors.errors).toEqual([]);
  });

  test('事件动作两条分支：push 累计写回 scope，emit 冒到宿主的 onEvent', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await openLowcodePage(page);

    await expect(node(page, NODE.history)).toHaveText('已记录 0 次');
    const submit = renderer(page).getByRole('button', {
      exact: true,
      name: '记录一次姓名',
    });
    await submit.click();
    await submit.click();
    await expect(node(page, NODE.history)).toHaveText('已记录 2 次');

    // `emit:demo-reset` 由 `useLowcodePage({ onEvent })` 交给宿主，宿主用它弹一条 toast
    await renderer(page)
      .getByRole('button', { exact: true, name: '通知宿主重置' })
      .click();
    await expect(
      page.getByText(/宿主收到事件 demo-reset/).first(),
    ).toBeVisible();

    expect(errors.errors).toEqual([]);
  });

  test('手动源只在点的时候跑：sync 结果写回 scope 那一行才出现', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await openLowcodePage(page);

    // `auto: false`：装载阶段一次都不该发，所以初始就是 null
    await expect(page.getByTestId('demo-sync-scope')).toHaveText(
      'sync 写回：null',
    );

    // 画布上的「重新同步」按钮配的是 `refresh:sync` 动作，走 runner 的 refresh 分支
    await renderer(page)
      .getByRole('button', { exact: true, name: '重新同步' })
      .click();
    await expect(page.getByTestId('demo-sync-scope')).toContainText(
      '"total":128',
    );

    // 宿主按钮直接调 `runDataSource`：返回运行态快照，成功才弹这句
    await page
      .getByRole('button', { exact: true, name: '手动跑 sync 数据源' })
      .click();
    await expect(
      page.getByText('已手动跑一次 sync 数据源').first(),
    ).toBeVisible();

    expect(errors.errors).toEqual([]);
  });

  test('大纲点选 → 属性面板回填 → 改一处属性，画布和导出的 Schema 吃到同一份', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await openLowcodePage(page);

    await outlineRow(page, NODE.title)
      .locator('[data-action="select"]')
      .click();
    await expect(
      page.locator(`${INSPECTOR}[data-node-id="${NODE.title}"]`),
    ).toBeVisible();
    await expect(
      page.locator('[data-slot="lowcode-inspector-node-id"]'),
    ).toHaveText(`${NODE.title} · basic.text`);
    // 播种：`{{ form.dept }} 的成员概览` 是绑定串，属性面板按原文显示而不是显示求值结果
    await expect(page.getByLabel('内容')).toHaveValue(
      '{{ form.dept }} 的成员概览',
    );

    await page.getByLabel('内容').fill('换过的标题');
    await expect(node(page, NODE.title)).toHaveText('换过的标题');

    await page
      .getByRole('button', { exact: true, name: '导出 Schema' })
      .click();
    await expect(page.locator('pre')).toContainText('换过的标题');

    // 导出的是那份 Schema，不是求值后的视图：改回来的值必须是模板串本身
    expect(errors.errors).toEqual([]);
  });

  test('面板拖物料进大纲走的是真 DataTransfer：节点数 +1 并且当场渲染出来', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await openLowcodePage(page);

    const before = await nodeCount(page);
    await expect(
      renderer(page).getByRole('button', { exact: true, name: '提交' }),
    ).toHaveCount(0);

    // 真 `DataTransfer` 在两个 data 格式里写读一遍（自定义 MIME + text/plain 兜底）：
    // jsdom 里这是自制对象，WebKit 对自定义 MIME 的限制也只有真引擎会暴露
    const carried = await page.evaluate(
      ({ mime }) => {
        const transfer = new DataTransfer();
        const source = document.querySelector(
          '[data-material-type="basic.button"]',
        )!;
        const target = document.querySelector('[data-action="drop-root"]')!;
        source.dispatchEvent(
          new DragEvent('dragstart', { bubbles: true, dataTransfer: transfer }),
        );
        target.dispatchEvent(
          new DragEvent('dragover', { bubbles: true, dataTransfer: transfer }),
        );
        target.dispatchEvent(
          new DragEvent('drop', { bubbles: true, dataTransfer: transfer }),
        );
        // 顺手确认载荷确实按约定写进去了：读不回来就是编解码表坏了，不是拖拽坏了
        return {
          custom: transfer.getData(mime),
          plain: transfer.getData('text/plain'),
        };
      },
      { mime: 'application/x-antdv-lowcode' },
    );
    expect(JSON.parse(carried.custom)).toEqual({
      kind: 'material',
      type: 'basic.button',
    });
    // 第二份 `text/plain` 是人读的（部分浏览器在 dragover 阶段读不到自定义 MIME，
    // 拖拽幽灵上至少得看得出是什么物料），所以它的格式刻意不是载荷本身
    expect(carried.plain).toBe('application/x-antdv-lowcode:basic.button');

    await expect(async () => {
      expect(await nodeCount(page)).toBe(before + 1);
    }).toPass();
    await expect(
      renderer(page).getByRole('button', { exact: true, name: '提交' }),
    ).toHaveCount(1);

    expect(errors.errors).toEqual([]);
  });

  test('大纲的删除与面板的点击插入都能改结构，体检按钮给的是当前这份', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await openLowcodePage(page);

    const before = await nodeCount(page);

    // 点物料是「插入到选中节点的兄弟位」：先选中再点，落点才有意义
    await outlineRow(page, NODE.title)
      .locator('[data-action="select"]')
      .click();
    await page.locator(`${MATERIAL}[data-material-type="basic.badge"]`).click();
    await expect(page.getByText('已插入「徽标」').first()).toBeVisible();
    // 新节点的 props 是元数据里的默认值（`text: '进行中'`），说明插入走的是 `createMaterialNode` 而不是手写空 props
    await expect(renderer(page).getByText('进行中')).toBeVisible();
    expect(await nodeCount(page)).toBe(before + 1);

    // 删掉刚插的那枚：大纲最后一行就是它
    const last = page.locator(OUTLINE_ROW).last();
    const newId = (await last.getAttribute('data-node-id'))!;
    await last.locator('[data-action="remove"]').click();
    await expect(outlineRow(page, newId)).toHaveCount(0);
    expect(await nodeCount(page)).toBe(before);

    // 体检读的是宿主手里那份 Schema：结构回到出厂就该报通过
    await page.getByRole('button', { exact: true, name: '保存前体检' }).click();
    await expect(page.getByText(/体检通过：\d+ 个节点/).first()).toBeVisible();

    expect(errors.errors).toEqual([]);
  });

  test('重置示例页回到出厂数据，用户填进去的表单与后加的节点都不留', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await openLowcodePage(page);

    const before = await nodeCount(page);
    await node(page, NODE.name).locator('input').fill('张三');
    await page.locator(`${MATERIAL}[data-material-type="basic.text"]`).click();
    expect(await nodeCount(page)).toBe(before + 1);

    await page.getByRole('button', { exact: true, name: '重置示例页' }).click();
    await expect(page.getByText('已回到出厂示例页').first()).toBeVisible();

    expect(await nodeCount(page)).toBe(before);
    // `scope` 里用户填的姓名被 `schema.state` 的初值覆盖回空，条件节点因此消失
    await expect(node(page, NODE.hello)).toHaveCount(0);
    await expect(node(page, NODE.title)).toHaveText('平台组 的成员概览');
    await expect(page.getByText('没有运行期错误')).toBeVisible();

    expect(errors.errors).toEqual([]);
  });
});
