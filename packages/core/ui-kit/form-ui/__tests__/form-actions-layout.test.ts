import type { FormSchema } from '../src/types';

import { flushPromises, mount } from '@vue/test-utils';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import BasicForm from '../src/components/form-render/form.vue';

/**
 * 动作区归属的断言只能看行内 `style`：jsdom 没有布局引擎，宽度百分比与
 * `flex-wrap` 的真实折行在这里都不会发生，能钉住的是「占了几格」和「挂在哪个容器里」。
 */
function mountForm(schemas: FormSchema[], props: Record<string, any> = {}) {
  return mount(BasicForm as any, {
    props: { schemas, ...props },
    attachTo: document.body,
  });
}

function actionsEl(wrapper: any): HTMLElement | undefined {
  return wrapper.find('[data-form-actions]').element as HTMLElement | undefined;
}

/** 动作区宽度换算成栅格数，避免断言 `33.33333333333333%` 这种浮点串 */
function actionsSpanOf(wrapper: any): number {
  const width = actionsEl(wrapper)?.style.width ?? '';
  const percent = Number.parseFloat(width);
  return Number.isNaN(percent) ? Number.NaN : Math.round((percent / 100) * 24);
}

function parentRowClass(wrapper: any): string | undefined {
  return actionsEl(wrapper)?.parentElement?.className;
}

function isInsideLastRow(wrapper: any): boolean {
  const rows = wrapper.findAll('.form-row');
  const parent = actionsEl(wrapper)?.parentElement;
  return (
    !!parent && rows.length > 0 && rows[rows.length - 1].element === parent
  );
}

const input = (field: string, span?: number): FormSchema => ({
  colProps: span === undefined ? undefined : { span },
  component: 'Input',
  field,
  label: field,
});

describe('basicForm 动作区的栅格归属', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('最后一行没占满时，动作区填进行尾剩余栅格而不换行', async () => {
    // cols=2 → 默认 span 12；两行两列后第三行只剩 f3，剩余 12 格给动作区
    const wrapper = mountForm([input('f1'), input('f2'), input('f3')], {
      grid: { cols: 2 },
    });
    await flushPromises();

    expect(actionsSpanOf(wrapper)).toBe(12);
    expect(parentRowClass(wrapper)).toContain('form-row');
    expect(isInsideLastRow(wrapper)).toBe(true);
    // 动作区不再自带一个行容器：3 个字段 = 3 行
    expect(wrapper.findAll('.form-row')).toHaveLength(2);
  });

  it('最后一行刚好占满 24 时，动作区退回独占一行', async () => {
    const wrapper = mountForm([input('f1'), input('f2')], {
      grid: { cols: 2 },
    });
    await flushPromises();

    expect(actionsSpanOf(wrapper)).toBe(24);
    expect(isInsideLastRow(wrapper)).toBe(true);
  });

  it('自定义列宽下按行的实际剩余栅格计算，而不是按字段个数', async () => {
    // 8 + 8 + 8 = 24 满行；6 独占一行，剩 18 给动作区
    const wrapper = mountForm([
      input('a', 8),
      input('b', 8),
      input('c', 8),
      input('d', 6),
    ]);
    await flushPromises();

    expect(actionsSpanOf(wrapper)).toBe(18);
    expect(wrapper.findAll('.form-row')).toHaveLength(2);
  });

  it('列数由 1 到 4 时都遵循同一条剩余空间规则', async () => {
    // cols=1：默认 span=24，每个字段独占一行 → 最后一行已满，动作区另起一行
    const one = mountForm([input('f1'), input('f2')], { grid: { cols: 1 } });
    await flushPromises();
    expect(actionsSpanOf(one)).toBe(24);
    one.unmount();

    // cols=3：默认 span=8，前三字段填满第一行，第四个起新行用掉 8 → 剩 16
    const three = mountForm(
      [input('f1'), input('f2'), input('f3'), input('f4')],
      { grid: { cols: 3 } },
    );
    await flushPromises();
    expect(actionsSpanOf(three)).toBe(16);
    three.unmount();

    // cols=4：默认 span=6，三个字段用掉 18 → 剩 6
    const four = mountForm([input('f1'), input('f2'), input('f3')], {
      grid: { cols: 4 },
    });
    await flushPromises();
    expect(actionsSpanOf(four)).toBe(6);
    four.unmount();
  });

  it('展开与收缩两种状态用同一条规则：都跟着最后一个可见行', async () => {
    const wrapper = mountForm([input('f1'), input('f2'), input('f3')], {
      alwaysShowLines: 1,
      grid: { cols: 2 },
      showAdvancedButton: true,
    });
    await flushPromises();

    // 收缩：只有第一行可见且已占满 → 动作区独占一行
    expect(wrapper.findAll('[data-field]')).toHaveLength(2);
    expect(actionsSpanOf(wrapper)).toBe(24);

    const toggle = wrapper
      .findAll('button')
      .find((button) => button.text().includes('展开'));
    expect(toggle).toBeTruthy();
    await toggle?.trigger('click');
    await flushPromises();

    // 展开：第三行出现，剩余 12 格 → 动作区并进该行行尾
    expect(wrapper.findAll('[data-field]')).toHaveLength(3);
    expect(actionsSpanOf(wrapper)).toBe(12);
    expect(isInsideLastRow(wrapper)).toBe(true);
  });

  it('末行是 Divider 时不并进分割线那一行', async () => {
    const wrapper = mountForm([
      input('f1'),
      { component: 'Divider', field: 'div1', label: '分组' },
    ]);
    await flushPromises();

    expect(actionsSpanOf(wrapper)).toBe(24);
    expect(isInsideLastRow(wrapper)).toBe(true);
  });

  it('空 schema 也保留动作区宿主行，showActionButtonGroup=false 时整块消失', async () => {
    const withActions = mountForm([]);
    await flushPromises();
    expect(withActions.findAll('[data-form-actions]')).toHaveLength(1);
    expect(actionsSpanOf(withActions)).toBe(24);
    withActions.unmount();

    const hidden = mountForm([input('f1')], { showActionButtonGroup: false });
    await flushPromises();
    expect(hidden.findAll('[data-form-actions]')).toHaveLength(0);
    hidden.unmount();
  });

  it('actionColOptions.style 仍然覆盖在栅格宽度之上', async () => {
    const wrapper = mountForm([input('f1'), input('f2'), input('f3')], {
      actionColOptions: { style: { width: '200px' } },
      grid: { cols: 2 },
    });
    await flushPromises();

    expect(actionsEl(wrapper)?.style.width).toBe('200px');
  });

  it('剩余空间只剩 1 格时仍按栅格给宽度，靠 max-content 保底不压变形', async () => {
    // a 占满一行；b 用掉 23 格 → 末行只剩 1 格给动作区
    const wrapper = mountForm([input('a', 24), input('b', 23)]);
    await flushPromises();

    const style = actionsEl(wrapper)?.style;
    expect(style?.minWidth).toBe('max-content');
    expect(actionsSpanOf(wrapper)).toBe(1);
    expect(style?.marginLeft).toBe('auto');
  });
});
