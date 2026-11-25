import type { ActionItem, Recordable } from '../src/types';

import { mount } from '@vue/test-utils';
import { h, nextTick } from 'vue';

import { Tooltip } from '@antdv/shadcn-ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import TableAction from '../src/components/TableAction.vue';
import { configureTable } from '../src/config';

const record: Recordable = { id: 1, name: '张三', status: 'draft' };

/** reka 的 PopoverContent 会 teleport 到 body，组件树里找不到，只能从 document 取 */
const bodyFind = (selector: string) =>
  document.body.querySelector<HTMLElement>(selector);
const bodyFindAll = (selector: string) => [
  ...document.body.querySelectorAll<HTMLElement>(selector),
];

function mountAction(actions: ActionItem[], props: Record<string, any> = {}) {
  return mount(TableAction, { props: { actions, record, ...props } });
}

function buttonTexts(wrapper: ReturnType<typeof mountAction>) {
  return wrapper.findAll('button').map((btn) => btn.text().trim());
}

let authCodes: string[] = [];

beforeEach(() => {
  authCodes = [];
  configureTable({
    checkAuth: (code) => authCodes.includes(code),
    checkAnyAuth: (codes) => codes.some((code) => authCodes.includes(code)),
  });
});

afterEach(() => {
  document.body.innerHTML = '';
  configureTable({
    checkAnyAuth: () => true,
    checkAuth: () => true,
  });
});

describe('tableAction 可见性', () => {
  it('默认放行：不配 auth 就全部渲染', () => {
    const wrapper = mountAction([
      { label: '编辑', onClick: vi.fn() },
      { label: '删除', onClick: vi.fn() },
    ]);
    expect(buttonTexts(wrapper)).toEqual(['编辑', '删除']);
  });

  it('字符串权限按 checkAuth 判定，数组权限任一命中', () => {
    authCodes = ['user:edit'];
    const wrapper = mountAction([
      { auth: 'user:edit', label: '编辑' },
      { auth: 'user:remove', label: '删除' },
      { auth: ['user:remove', 'user:edit'], label: '批量' },
      { auth: ['nope:one', 'nope:two'], label: '越权' },
    ]);
    expect(buttonTexts(wrapper)).toEqual(['编辑', '批量']);
  });

  it('ifShow 支持布尔与函数', () => {
    const wrapper = mountAction([
      { ifShow: false, label: '隐藏' },
      {
        ifShow: (row: Recordable) => row.status === 'draft',
        label: '草稿才见',
      },
      { ifShow: (row: Recordable) => row.status === 'done', label: '完成才见' },
    ]);
    expect(buttonTexts(wrapper)).toEqual(['草稿才见']);
  });

  it('disabled 支持布尔与函数', () => {
    const wrapper = mountAction([
      { disabled: true, label: '禁用' },
      { disabled: (row: Recordable) => row.id === 1, label: '按记录禁用' },
      { label: '可用' },
    ]);
    const buttons = wrapper.findAll('button');
    expect(buttons[0]!.attributes('disabled')).toBeDefined();
    expect(buttons[1]!.attributes('disabled')).toBeDefined();
    expect(buttons[2]!.attributes('disabled')).toBeUndefined();
  });

  it('danger 用红色样式区分危险操作', () => {
    const wrapper = mountAction([{ danger: true, label: '删除' }]);
    expect(wrapper.find('button').classes().join(' ')).toContain(
      'text-red-500',
    );
  });
});

describe('tableAction 标签与点击', () => {
  it('label 支持字符串、函数与 VNode', () => {
    const wrapper = mountAction([
      { label: '字符串' },
      { label: (row: Recordable) => `改名-${row.name}` },
      { label: h('em', '节点标签') },
    ]);
    const texts = buttonTexts(wrapper);
    expect(texts[0]).toBe('字符串');
    expect(texts[1]).toBe('改名-张三');
    expect(texts[2]).toContain('节点标签');
    expect(wrapper.findAll('em')).toHaveLength(1);
  });

  it('icon 渲染图标节点', () => {
    const wrapper = mountAction([
      { icon: 'ant-design:edit-outlined', label: '编辑' },
    ]);
    expect(wrapper.find('svg').exists()).toBe(true);
  });

  it('点击把当前行记录带给 onClick', async () => {
    const onClick = vi.fn();
    const wrapper = mountAction([{ label: '编辑', onClick }]);
    await wrapper.find('button').trigger('click');
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick.mock.calls[0]![0]).toMatchObject({ id: 1 });
    expect(onClick.mock.calls[0]![1]).toBeInstanceOf(MouseEvent);
  });

  it('size 与 type 映射到 shadcn 按钮档位', () => {
    const wrapper = mountAction([
      { label: '小', size: 'small' },
      { label: '大', size: 'large', type: 'primary' },
      { label: '默认', type: 'dashed' },
    ]);
    const classes = wrapper.findAll('button').map((b) => b.classes().join(' '));
    // small → xs，large → lg，dashed/primary 走 outline/default 变体
    expect(classes[0]).not.toBe(classes[1]);
    expect(classes.join(' ')).toContain('text-primary');
  });
});

describe('tableAction 二次确认', () => {
  it('popConfirm 打开弹层，确定走 confirm、取消走 cancel', async () => {
    const confirm = vi.fn();
    const cancel = vi.fn();
    const wrapper = mountAction([
      {
        danger: true,
        label: '删除',
        popConfirm: {
          cancel,
          confirm,
          content: '删除后不可恢复',
          title: '确认删除？',
        },
      },
    ]);
    // 只有一个触发按钮，弹层内容在点击后才挂到 body
    expect(wrapper.findAll('button')).toHaveLength(1);

    await wrapper.find('button').trigger('click');
    await nextTick();
    const buttons = bodyFindAll('button');
    const labels = buttons.map((b) => b.textContent?.trim());
    expect(document.body.textContent).toContain('确认删除？');
    expect(document.body.textContent).toContain('删除后不可恢复');

    const no = buttons.find((b) => b.textContent?.trim() === '取消')!;
    expect(labels).toContain('确定');
    expect(labels).toContain('取消');

    no.click();
    await nextTick();
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('popConfirm 的确定回调执行后收起弹层', async () => {
    const confirm = vi.fn();
    const wrapper = mountAction([
      { label: '删除', popConfirm: { confirm, title: '确认？' } },
    ]);
    await wrapper.find('button').trigger('click');
    await nextTick();
    const ok = bodyFindAll('button').find(
      (b) => b.textContent?.trim() === '确定',
    )!;
    ok.click();
    await nextTick();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(bodyFind('button')?.textContent).not.toContain('确认？');
  });

  it('无 popConfirm 的普通按钮不产生弹层', async () => {
    const wrapper = mountAction([{ label: '编辑', onClick: vi.fn() }]);
    await wrapper.find('button').trigger('click');
    await nextTick();
    expect(bodyFindAll('button').length).toBe(0);
  });
});

describe('tableAction 下拉与"更多"', () => {
  it('dropdown 子项渲染在弹层里，点击子项只触发该子项', async () => {
    const parentClick = vi.fn();
    const subClick = vi.fn();
    const wrapper = mountAction([
      {
        dropdown: [
          { auth: 'nope', label: '无权限子项' },
          { label: '复制', onClick: subClick },
        ],
        label: '更多操作',
        onClick: parentClick,
      },
    ]);
    await wrapper.find('button').trigger('click');
    await nextTick();

    const items = bodyFindAll('div.cursor-pointer');
    const texts = items.map((item) => item.textContent?.trim());
    expect(texts).not.toContain('无权限子项');
    const copy = items.find((item) => item.textContent?.trim() === '复制')!;
    copy.click();
    await nextTick();
    expect(subClick).toHaveBeenCalledTimes(1);
    expect(subClick.mock.calls[0]![0]).toMatchObject({ id: 1 });
    expect(parentClick).not.toHaveBeenCalled();
  });

  it('超过 maxShowCount 的操作折进"更多"下拉', async () => {
    const actions: ActionItem[] = Array.from({ length: 5 }, (_, i) => ({
      label: `操作${i + 1}`,
      onClick: vi.fn(),
    }));
    const wrapper = mountAction(actions, { maxShowCount: 3 });
    const inline = buttonTexts(wrapper);
    // 3 项上限：留 2 项在行内 + 1 个"更多"
    expect(inline).toEqual(['操作1', '操作2', '更多']);

    await wrapper.findAll('button')[2]!.trigger('click');
    await nextTick();
    const items = bodyFindAll('div.cursor-pointer').map((item) =>
      item.textContent?.trim(),
    );
    expect(items).toEqual(['操作3', '操作4', '操作5']);
  });

  it('未超过 maxShowCount 时不出现"更多"', () => {
    const wrapper = mountAction([{ label: '编辑' }, { label: '删除' }], {
      maxShowCount: 4,
    });
    expect(buttonTexts(wrapper)).toEqual(['编辑', '删除']);
  });

  it('"更多"里带 popConfirm 的项先展开内联确认再执行', async () => {
    const confirm = vi.fn();
    const actions: ActionItem[] = [
      { label: '编辑' },
      { label: '查看' },
      { label: '删除', popConfirm: { confirm, title: '确认删除' } },
    ];
    const wrapper = mountAction(actions, { maxShowCount: 2 });

    await wrapper.findAll('button').at(-1)!.trigger('click');
    await nextTick();
    const items = bodyFindAll('div.cursor-pointer');
    const del = items.find((item) => item.textContent?.includes('删除'))!;
    del.click();
    await nextTick();
    // 第一步只展开确认行，不直接执行
    expect(confirm).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('确认删除');

    const ok = bodyFindAll('button').find(
      (b) => b.textContent?.trim() === '确定',
    )!;
    ok.click();
    await nextTick();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0]![0]).toMatchObject({ id: 1 });
  });

  it('record 为空对象时也能安全渲染', () => {
    const wrapper = mount(TableAction as any, {
      props: { actions: [{ label: '编辑' }] },
    });
    expect(buttonTexts(wrapper as any)).toEqual(['编辑']);
  });
});

describe('tableAction 统一操作栏契约', () => {
  it('默认按钮保留 link 变体，但不设置任何 text-decoration-line 类', () => {
    const wrapper = mountAction([{ label: '详情' }]);
    const button = wrapper.find('button');
    expect(button.attributes('data-variant')).toBe('link');
    const classes = button.classes();
    expect(classes).not.toContain('underline');
    expect(classes).not.toContain('no-underline');
    expect(classes).not.toContain('hover:underline');
    expect(classes).not.toContain('hover:no-underline');
    expect(classes).not.toContain('underline-offset-4');

    // 显式 type: link 同样是 link 变体 + 无 text-decoration-line
    const link = mountAction([{ label: '外链', type: 'link' }]);
    expect(link.find('button').attributes('data-variant')).toBe('link');
    expect(link.find('button').classes()).not.toContain('hover:underline');
  });

  it('默认底色取主题 primary，不再使用黑色/默认底色', () => {
    const wrapper = mountAction([{ label: '详情' }]);
    const classes = wrapper.find('button').classes().join(' ');
    expect(classes).toContain('bg-primary/10');
    expect(classes).toContain('text-primary');
    expect(classes).not.toContain('bg-black');
  });

  it('tooltip 只在纯图标按钮上出现，并按行数据生成', () => {
    const tooltipFn = vi.fn((row: Recordable) => `查看 ${row.name}`);
    const iconOnly = mountAction([
      { icon: 'ant-design:edit-outlined', tooltip: tooltipFn },
    ]);
    expect(iconOnly.findComponent(Tooltip).exists()).toBe(true);
    expect(tooltipFn).toHaveBeenCalledWith(record);

    // 有 label（含函数形态）时一律不展示 tooltip，避免文字与提示重复
    const withLabel = mountAction([
      {
        icon: 'ant-design:edit-outlined',
        label: '详情',
        tooltip: '查看该行',
      },
      {
        icon: 'ant-design:edit-outlined',
        label: (row: Recordable) => `改名-${row.name}`,
        tooltip: '查看该行',
      },
    ]);
    expect(withLabel.findAllComponents(Tooltip)).toHaveLength(0);

    // 既无 label 也无 icon 的按钮同样不展示
    const noIcon = mountAction([{ tooltip: '查看该行' }]);
    expect(noIcon.findComponent(Tooltip).exists()).toBe(false);
  });

  it('permission 不通过时默认隐藏，permissionMode=disable 时保留但禁用', () => {
    authCodes = ['user:edit'];
    const wrapper = mountAction([
      { label: '编辑', permission: 'user:edit' },
      { label: '删除', permission: 'user:remove' },
      {
        label: '导出',
        permission: 'user:export',
        permissionMode: 'disable',
      },
    ]);
    expect(buttonTexts(wrapper)).toEqual(['编辑', '导出']);
    expect(wrapper.findAll('button')[1]!.attributes('disabled')).toBeDefined();
  });

  it('带 label 的 tooltip 不渲染，但确认弹层仍能正常打开', async () => {
    const wrapper = mountAction([
      {
        label: '删除',
        tooltip: '删除该行',
        popConfirm: { confirm: vi.fn(), title: '确认删除？' },
      },
    ]);
    expect(wrapper.findComponent(Tooltip).exists()).toBe(false);
    await wrapper.find('button').trigger('click');
    await nextTick();
    expect(document.body.textContent).toContain('确认删除？');
  });

  it('纯图标按钮的 tooltip 与 popConfirm 可共存', async () => {
    const wrapper = mountAction([
      {
        icon: 'ant-design:delete-outlined',
        tooltip: '删除该行',
        popConfirm: { confirm: vi.fn(), title: '确认删除？' },
      },
    ]);
    expect(wrapper.findComponent(Tooltip).exists()).toBe(true);
    await wrapper.find('button').trigger('click');
    await nextTick();
    expect(document.body.textContent).toContain('确认删除？');
  });

  it('popConfirm 支持自定义确认/取消文案', async () => {
    const wrapper = mountAction([
      {
        label: '删除',
        popConfirm: {
          cancelText: '再想想',
          confirm: vi.fn(),
          okText: '确认删除',
          title: '确认？',
        },
      },
    ]);
    await wrapper.find('button').trigger('click');
    await nextTick();
    const labels = bodyFindAll('button').map((b) => b.textContent?.trim());
    expect(labels).toContain('确认删除');
    expect(labels).toContain('再想想');
  });

  it('操作项按配置顺序从左到右渲染，整组在单元格内居中', () => {
    const wrapper = mountAction([
      { label: '通过' },
      { label: '驳回' },
      { label: '详情' },
    ]);
    const root = wrapper.find('[data-table-action]');
    expect(root.classes().join(' ')).toContain('justify-center');
    expect(buttonTexts(wrapper)).toEqual(['通过', '驳回', '详情']);
  });
});

/** 分隔线数量 = 平铺按钮数 - 1（有「更多」时再 +1） */
const separatorCount = (wrapper: ReturnType<typeof mountAction>) =>
  wrapper.findAll('[data-slot="separator"]').length;

function labeledActions(count: number): ActionItem[] {
  return Array.from({ length: count }, (_, index) => ({
    label: `操作${index + 1}`,
    onClick: vi.fn(),
  }));
}

async function dropdownTexts(wrapper: ReturnType<typeof mountAction>) {
  await wrapper.findAll('button').at(-1)!.trigger('click');
  await nextTick();
  return bodyFindAll('div.cursor-pointer').map((item) =>
    item.textContent?.trim(),
  );
}

describe('tableAction maxCount 边界', () => {
  it('默认 maxCount=4：四项全部平铺，三项分隔线，无更多', () => {
    const wrapper = mountAction(labeledActions(4));
    expect(buttonTexts(wrapper)).toEqual(['操作1', '操作2', '操作3', '操作4']);
    expect(separatorCount(wrapper)).toBe(3);
  });

  it('默认 maxCount=4：五项时前三项平铺，第四项起进入更多', async () => {
    const wrapper = mountAction(labeledActions(5));
    expect(buttonTexts(wrapper)).toEqual(['操作1', '操作2', '操作3', '更多']);
    expect(separatorCount(wrapper)).toBe(3);
    expect(await dropdownTexts(wrapper)).toEqual(['操作4', '操作5']);
  });

  it('maxCount=2：一项平铺 + 更多，其余全部进下拉', async () => {
    const wrapper = mountAction(labeledActions(3), { maxCount: 2 });
    expect(buttonTexts(wrapper)).toEqual(['操作1', '更多']);
    expect(separatorCount(wrapper)).toBe(1);
    expect(await dropdownTexts(wrapper)).toEqual(['操作2', '操作3']);
  });

  it('maxCount=1：不平铺任何操作，全部进更多且无分隔线', async () => {
    const wrapper = mountAction(labeledActions(3), { maxCount: 1 });
    expect(buttonTexts(wrapper)).toEqual(['更多']);
    expect(separatorCount(wrapper)).toBe(0);
    expect(await dropdownTexts(wrapper)).toEqual(['操作1', '操作2', '操作3']);
  });

  it('maxCount 大于操作数量时不折叠', () => {
    const wrapper = mountAction(labeledActions(4), { maxCount: 6 });
    expect(buttonTexts(wrapper)).toHaveLength(4);
    expect(buttonTexts(wrapper)).not.toContain('更多');
    expect(separatorCount(wrapper)).toBe(3);
  });

  it('maxCount 与旧 maxShowCount 同时传入时以旧配置为准', () => {
    const wrapper = mountAction(labeledActions(5), {
      maxCount: 4,
      maxShowCount: 3,
    });
    expect(buttonTexts(wrapper)).toEqual(['操作1', '操作2', '更多']);
  });

  it('超出项按权限过滤后再拆分，不会留下空位', async () => {
    authCodes = ['user:edit'];
    const actions = labeledActions(5).map((action, index) => ({
      ...action,
      permission: index === 1 ? 'user:remove' : 'user:edit',
    }));
    const wrapper = mountAction(actions, { maxCount: 3 });
    expect(buttonTexts(wrapper)).toEqual(['操作1', '操作3', '更多']);
    expect(await dropdownTexts(wrapper)).toEqual(['操作4', '操作5']);
  });
});

describe('tableAction 组件级权限 props', () => {
  it('hasPermission 覆盖运行时权限判定', () => {
    authCodes = ['user:edit'];
    const wrapper = mountAction(
      [
        { label: '编辑', permission: 'user:edit' },
        { label: '删除', permission: 'user:edit' },
      ],
      {
        hasPermission: (action: ActionItem) => action.label === '编辑',
      },
    );
    expect(buttonTexts(wrapper)).toEqual(['编辑']);
  });

  it('permissionMode=disable 让无权限项保留但禁用', () => {
    const wrapper = mountAction(
      [
        { label: '编辑', permission: 'user:edit' },
        { label: '删除', permission: 'user:remove' },
      ],
      {
        hasPermission: (action: ActionItem) => action.label === '编辑',
        permissionMode: 'disable',
      },
    );
    expect(buttonTexts(wrapper)).toEqual(['编辑', '删除']);
    expect(wrapper.findAll('button')[1]!.attributes('disabled')).toBeDefined();
  });
});
