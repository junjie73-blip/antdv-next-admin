import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import { describe, expect, it } from 'vitest';

import TablePagination from '../src/components/TablePagination.vue';

const settle = async () => {
  await nextTick();
  await flushPromises();
  await nextTick();
};

function mountPager(props: Record<string, any> = {}) {
  const wrapper = mount(TablePagination, {
    attachTo: document.body,
    props: {
      current: 1,
      pageSize: 10,
      total: 25,
      ...props,
    },
  });
  return wrapper;
}

/** 关掉可能残留的下拉层，避免后一个用例捡到前一个的 option */
const closePopper = () => {
  document
    .querySelectorAll('[data-slot="select-content"]')
    .forEach((el) => el.remove());
};

describe('tablePagination', () => {
  it('总数文案：showTotal 拿到总数与当前区间', async () => {
    const wrapper = mountPager({
      current: 2,
      showTotal: (total: number, range: [number, number]) =>
        `共 ${total} 条，第 ${range[0]}-${range[1]} 条`,
    });
    const text = wrapper.find('.basic-table-pagination span').text();
    expect(text).toBe('共 25 条，第 11-20 条');
    wrapper.unmount();
  });

  it('末页区间不越过总数', async () => {
    const wrapper = mountPager({
      current: 3,
      showTotal: (_t: number, [from, to]: [number, number]) => `${from}-${to}`,
      total: 25,
    });
    expect(wrapper.find('.basic-table-pagination span').text()).toBe('21-25');
    wrapper.unmount();
  });

  it('页码由 reka 计算：当前页带 aria-current，点击回传页码', async () => {
    const wrapper = mountPager();
    const pages = wrapper.findAll('.basic-table-page');
    expect(pages.map((p) => p.text())).toEqual(['1', '2', '3']);
    expect(pages[0]!.attributes('aria-current')).toBe('page');

    await pages[1]!.trigger('click');
    await settle();
    expect(wrapper.emitted('update:current')?.at(-1)).toEqual([2]);
    wrapper.unmount();
  });

  it('页数多时收拢成省略号，首尾页仍可见', async () => {
    const wrapper = mountPager({ pageSize: 1, total: 25 });
    expect(wrapper.find('.basic-table-page-ellipsis').exists()).toBe(true);
    expect(wrapper.findAll('.basic-table-page').length).toBeLessThanOrEqual(8);
    expect(wrapper.find('.basic-table-page-25').exists()).toBe(true);
    wrapper.unmount();
  });

  it('首尾页禁用上/下页按钮', async () => {
    const first = mountPager({ current: 1 });
    expect(
      first.find('.basic-table-prev').attributes('disabled'),
    ).toBeDefined();
    expect(
      first.find('.basic-table-next').attributes('disabled'),
    ).toBeUndefined();
    first.unmount();

    const last = mountPager({ current: 3 });
    expect(last.find('.basic-table-next').attributes('disabled')).toBeDefined();
    expect(
      last.find('.basic-table-prev').attributes('disabled'),
    ).toBeUndefined();
    last.unmount();
  });

  it('每页条数：打开下拉选择后回传数值', async () => {
    const wrapper = mountPager({ pageSizeOptions: [10, 20, 50, 100] });
    const trigger = wrapper.find('.basic-table-page-size');
    expect(trigger.attributes('aria-label')).toBe('每页条数');

    await trigger.trigger('pointerdown');
    await trigger.trigger('click');
    await settle();
    const items = [...document.querySelectorAll('[data-slot="select-item"]')];
    expect(items.map((i) => i.textContent?.trim())).toEqual([
      '10 条/页',
      '20 条/页',
      '50 条/页',
      '100 条/页',
    ]);

    // reka 的选项在 pointerup 上落值，且事件要从内容元素冒泡上去
    const option50 = items.find((el) => el.textContent?.includes('50'))!;
    option50.firstElementChild!.dispatchEvent(
      new PointerEvent('pointerup', { bubbles: true }),
    );
    await settle();
    expect(wrapper.emitted('update:pageSize')?.at(-1)).toEqual([50]);
    closePopper();
    wrapper.unmount();
  });

  it('字符串型 pageSizeOptions 也回传数字', async () => {
    const wrapper = mountPager({ pageSizeOptions: ['10', '20'] });
    const trigger = wrapper.find('.basic-table-page-size');
    await trigger.trigger('pointerdown');
    await trigger.trigger('click');
    await settle();
    const option20 = [
      ...document.querySelectorAll('[data-slot="select-item"]'),
    ].find((el) => el.textContent?.includes('20'))!;
    option20.firstElementChild!.dispatchEvent(
      new PointerEvent('pointerup', { bubbles: true }),
    );
    await settle();
    expect(wrapper.emitted('update:pageSize')?.at(-1)).toEqual([20]);
    closePopper();
    wrapper.unmount();
  });

  it('快速跳至：回车回传页码，非正数不回传', async () => {
    const wrapper = mountPager();
    const jumper = wrapper.find('.basic-table-quick-jumper');

    await jumper.setValue('2');
    await jumper.trigger('keydown.enter');
    await settle();
    expect(wrapper.emitted('update:current')?.at(-1)).toEqual([2]);

    await jumper.setValue('abc');
    await jumper.trigger('keydown.enter');
    await jumper.setValue('0');
    await jumper.trigger('keydown.enter');
    await settle();
    expect(wrapper.emitted('update:current')).toHaveLength(1);
    wrapper.unmount();
  });

  it('showSizeChanger / showQuickJumper 关掉后不渲染', async () => {
    const wrapper = mountPager({
      showQuickJumper: false,
      showSizeChanger: false,
    });
    expect(wrapper.find('.basic-table-page-size').exists()).toBe(false);
    expect(wrapper.find('.basic-table-quick-jumper').exists()).toBe(false);
    expect(wrapper.find('.basic-table-page-1').exists()).toBe(true);
    wrapper.unmount();
  });
});
