import { flushPromises, mount } from '@vue/test-utils';
import { h, nextTick } from 'vue';

import { describe, expect, it } from 'vitest';

import { DESCRIPTION_DICT_RESOLVER } from '../src/components/description/context';
import Description from '../src/components/description/Description.vue';

const flush = async () => {
  await flushPromises();
  await nextTick();
};

describe('Description', () => {
  it('文本字段渲染 label + 值，默认带冒号', async () => {
    const wrapper = mount(Description, {
      props: { data: { name: '张三' }, schema: [{ field: 'name', label: '姓名' }] },
    });
    await flush();
    expect(wrapper.text()).toContain('姓名:');
    expect(wrapper.text()).toContain('张三');
    expect(wrapper.findAll('[data-common-descriptions-item]')).toHaveLength(1);
  });

  it('colon=false 时不追加冒号', async () => {
    const wrapper = mount(Description, {
      props: {
        colon: false,
        data: { name: '张三' },
        schema: [{ field: 'name', label: '姓名' }],
      },
    });
    await flush();
    expect(wrapper.text()).toContain('姓名');
    expect(wrapper.text()).not.toContain('姓名:');
  });

  it('空值落到 emptyText（默认 -）', async () => {
    const wrapper = mount(Description, {
      props: { data: {}, schema: [{ field: 'x', label: 'X' }] },
    });
    await flush();
    expect(wrapper.text()).toContain('-');
  });

  it('item.value 直接覆盖 data 取值', async () => {
    const wrapper = mount(Description, {
      props: {
        data: { x: '来自data' },
        schema: [{ field: 'x', label: 'X', value: '直接值' }],
      },
    });
    await flush();
    expect(wrapper.text()).toContain('直接值');
    expect(wrapper.text()).not.toContain('来自data');
  });

  it('render 自定义渲染生效', async () => {
    const wrapper = mount(Description, {
      props: {
        data: { x: 1 },
        schema: [
          { field: 'x', label: 'X', render: () => h('span', 'RENDERED') },
        ],
      },
    });
    await flush();
    expect(wrapper.text()).toContain('RENDERED');
  });

  it('type=date 按 YYYY-MM-DD 格式化', async () => {
    const wrapper = mount(Description, {
      props: {
        data: { d: '2024-01-15' },
        schema: [{ field: 'd', label: '日期', type: 'date' }],
      },
    });
    await flush();
    expect(wrapper.text()).toContain('2024-01-15');
  });

  it('type=datetime 按 YYYY-MM-DD HH:mm:ss 格式化', async () => {
    const wrapper = mount(Description, {
      props: {
        data: { d: '2024-01-15T10:30:00' },
        schema: [{ field: 'd', label: '时间', type: 'datetime' }],
      },
    });
    await flush();
    expect(wrapper.text()).toContain('2024-01-15 10:30:00');
  });

  it('type=dict 未注入解析器时回退原值，多值以、连接', async () => {
    const single = mount(Description, {
      props: {
        data: { s: 'abc' },
        schema: [{ field: 's', label: 'S', type: 'dict', dictType: 't' }],
      },
    });
    await flush();
    expect(single.text()).toContain('abc');

    const multi = mount(Description, {
      props: {
        data: { s: 'a,b' },
        schema: [{ field: 's', label: 'S', type: 'dict', dictType: 't' }],
      },
    });
    await flush();
    expect(multi.text()).toContain('a、b');
  });

  it('type=dict 注入解析器后使用其结果', async () => {
    const wrapper = mount(Description, {
      props: {
        data: { s: 'abc' },
        schema: [{ field: 's', label: 'S', type: 'dict', dictType: 't' }],
      },
      global: {
        provide: {
          [DESCRIPTION_DICT_RESOLVER]: (_t: string, v: unknown) =>
            `D:${String(v)}`,
        },
      },
    });
    await flush();
    expect(wrapper.text()).toContain('D:abc');
  });

  it('type=image 渲染 common Image', async () => {
    const wrapper = mount(Description, {
      props: {
        data: { img: 'http://x.png' },
        schema: [{ field: 'img', label: '图', type: 'image' }],
      },
    });
    await flush();
    expect(wrapper.find('[data-common-image]').exists()).toBe(true);
  });

  it('show=false 的条目被过滤', async () => {
    const wrapper = mount(Description, {
      props: {
        data: { a: 1, b: 2 },
        schema: [
          { field: 'a', label: 'A' },
          { field: 'b', label: 'B', show: false },
        ],
      },
    });
    await flush();
    expect(wrapper.findAll('[data-common-descriptions-item]')).toHaveLength(1);
    expect(wrapper.text()).not.toContain('B');
  });

  it('loading=true 显示 Spinner 且不渲染条目', async () => {
    const wrapper = mount(Description, {
      props: {
        data: { a: 1 },
        loading: true,
        schema: [{ field: 'a', label: 'A' }],
      },
    });
    await flush();
    expect(wrapper.find('[role="status"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-common-descriptions-item]')).toHaveLength(0);
  });

  it('暴露 getData / setData', async () => {
    const data = { a: 1 };
    const wrapper = mount(Description, {
      props: { data, schema: [{ field: 'a', label: 'A' }] },
    });
    await flush();
    const vm = wrapper.vm as unknown as {
      getData: () => unknown;
      setData: (d: unknown) => void;
    };
    expect(vm.getData()).toEqual(data);
    expect(() => vm.setData({ b: 2 })).not.toThrow();
  });

  it('className / style 透传到根容器', async () => {
    const wrapper = mount(Description, {
      props: {
        className: 'my-desc',
        data: {},
        schema: [],
        style: { color: 'red' },
      },
    });
    await flush();
    const root = wrapper.find('.description-wrapper');
    expect(root.classes()).toContain('my-desc');
    expect(root.attributes('style')).toContain('color');
  });
});
