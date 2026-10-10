import type { Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import { closePreferenceDrawer, go, openPreferenceDrawer, signIn } from './utils/app';

/**
 * 一次性审计（跑完即删）：把页面上"看着能点、光标却是箭头"的元素列出来。
 */
const AUDIT = String.raw`
() => {
  const out = [];
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) continue;
    const cls = typeof el.className === 'string' ? el.className : '';
    if (/\bpointer-events-none\b/.test(cls)) continue;
    const looksInteractive =
      el.tagName === 'BUTTON' ||
      el.getAttribute('role') === 'button' ||
      /(^|\s)hover:(bg|border|text|shadow|outline|scale|underline)/.test(cls) ||
      /(^|\s)group-hover:/.test(cls);
    if (!looksInteractive) continue;
    const cursor = getComputedStyle(el).cursor;
    if (cursor === 'pointer' || cursor === 'grab' || cursor === 'grabbing' || cursor === 'col-resize' || cursor === 'row-resize' || cursor === 'not-allowed' || cursor === 'move') continue;
    out.push({
      tag: el.tagName.toLowerCase(),
      cls: cls.split(/\s+/).filter(c => !c.startsWith('anticon')).slice(0, 6).join(' '),
      ant: [...el.classList].filter(c => c.startsWith('ant-'))[0] || '',
      disabled: el.disabled === true,
      text: (el.textContent || '').trim().slice(0, 14),
      cursor,
    });
  }
  const seen = new Set();
  return out.filter(o => {
    const k = o.tag + '|' + o.ant + '|' + o.cls;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
`;

async function audit(page: Page, label: string) {
  const rows = await page.evaluate(`(${AUDIT})()`);
  console.log(`\n===== ${label} (${rows.length}) =====`);
  for (const r of rows as any[]) console.log(JSON.stringify(r));
}

/** antd 自己该给光标的可点部件，逐个看浏览器算出来的是什么 */
const ANTD_SELECTORS = [
  '.ant-segmented-item',
  '.ant-switch',
  '.ant-collapse-header',
  '.ant-tag',
  '.ant-checkbox-inner',
  '.ant-radio-wrapper',
  '.ant-radio-button-wrapper',
  '.ant-select-item-option',
  '.ant-tree-treenode',
  '.ant-table-row',
  '.ant-tabs-tab',
  '.ant-menu-item',
  '.ant-menu-submenu-title',
  '.ant-breadcrumb li',
  '.ant-pagination-item',
  '.ant-slider',
  '.ant-rate-star',
  '.ant-upload',
  '.ant-picker',
  '.ant-input-number',
  '.ant-transfer-list-content-item',
  '.ant-descriptions-item-label',
  '.ant-steps-item',
];

async function auditAntd(page: Page, label: string) {
  const rows = await page.evaluate((sels) => {
    return sels
      .map((sel) => {
        const el = document.querySelector(sel);
        return el ? ([sel, getComputedStyle(el).cursor] as [string, string]) : null;
      })
      .filter((x): x is [string, string] => x !== null);
  }, ANTD_SELECTORS);
  console.log(`\n----- antd cursor @ ${label} -----`);
  for (const [sel, cursor] of rows) console.log(`${cursor}\t${sel}`);
}

test.describe('cursor 审计', () => {
  test('扫描', async ({ page }) => {
    await signIn(page);
    await go(page, '/system/user');
    await audit(page, 'system/user');

    await go(page, '/components/editor/rich-text');
    await audit(page, 'components/editor/rich-text');

    await go(page, '/components/upload');
    await audit(page, 'components/upload');

    await go(page, '/components/card-list');
    await audit(page, 'components/card-list');

    await go(page, '/components/basic');
    await audit(page, 'components/basic');
    await auditAntd(page, 'components/basic');

    const drawer = await openPreferenceDrawer(page, '外观');
    await expect(drawer).toBeVisible();
    await audit(page, 'drawer/appearance');
    await auditAntd(page, 'drawer/appearance');
    await openPreferenceDrawer(page, '布局');
    await audit(page, 'drawer/layout');
    await closePreferenceDrawer(page);
    expect(true).toBe(true);
  });
});
