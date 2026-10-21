import type { ActionItem, Recordable } from '../src/types';

import { mount } from '@vue/test-utils';
import { h, nextTick } from 'vue';

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
