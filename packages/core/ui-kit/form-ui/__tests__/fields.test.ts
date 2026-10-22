import type { MarkdownEditorInstance } from '@antdv/common-ui';

import { flushPromises, mount } from '@vue/test-utils';

import { MarkdownEditor } from '@antdv/common-ui';
import { describe, expect, it, vi } from 'vitest';

import FCheckbox from '../src/fields/FCheckbox.vue';
import FDatePicker from '../src/fields/FDatePicker.vue';
import FInput from '../src/fields/FInput.vue';
import FInputNumber from '../src/fields/FInputNumber.vue';
import FMarkdown from '../src/fields/FMarkdown.vue';
import FRadioGroup from '../src/fields/FRadioGroup.vue';
import FRate from '../src/fields/FRate.vue';
import FSelect from '../src/fields/FSelect.vue';
import FSlider from '../src/fields/FSlider.vue';
import FSwitch from '../src/fields/FSwitch.vue';
import FTextarea from '../src/fields/FTextarea.vue';

describe('fInput', () => {
  it('输入发出 update:value（value/update:value 契约）', async () => {
    const wrapper = mount(FInput, { props: { value: '' } });
    await wrapper.find('input').setValue('abc');
    expect(wrapper.emitted('update:value')?.[0]).toEqual(['abc']);
  });

  it('allowClear 清空按钮发出 undefined', async () => {
    const wrapper = mount(FInput, {
      props: { value: 'abc', allowClear: true },
    });
    await wrapper.find('[data-clear]').trigger('click');
    expect(wrapper.emitted('update:value')?.[0]).toEqual([undefined]);
  });

  it('disabled 透传到原生 input', () => {
    const wrapper = mount(FInput, { props: { disabled: true } });
    expect(wrapper.find('input').attributes('disabled')).toBeDefined();
  });

  it('password 形态可切换可见性', async () => {
    const wrapper = mount(FInput, { props: { type: 'password' } });
    expect(wrapper.find('input').attributes('type')).toBe('password');
    await wrapper.find('button[aria-label="显示密码"]').trigger('click');
    expect(wrapper.find('input').attributes('type')).toBe('text');
  });
});

describe('fTextarea', () => {
  it('输入发出 update:value', async () => {
    const wrapper = mount(FTextarea, { props: { value: '' } });
    await wrapper.find('textarea').setValue('line1');
    expect(wrapper.emitted('update:value')?.[0]).toEqual(['line1']);
  });

  it('外部 value 变化要回灌进 textarea（受控写法不能只认 input 事件）', async () => {
    const wrapper = mount(FTextarea, { props: { value: '' } });
    await wrapper.setProps({ value: '回填内容' });
    expect(
      (wrapper.find('textarea').element as HTMLTextAreaElement).value,
    ).toBe('回填内容');
  });
});

describe('fInputNumber', () => {
  it('解析数字并应用 min/max 钳制', async () => {
    const wrapper = mount(FInputNumber, {
      props: { value: 0, min: 1, max: 10 },
    });
    await wrapper.find('input').setValue('25');
    expect(wrapper.emitted('update:value')?.at(-1)?.[0]).toBe(10);
  });

  it('清空发出 undefined', async () => {
    const wrapper = mount(FInputNumber, { props: { value: 5 } });
    await wrapper.find('input').setValue('');
    expect(wrapper.emitted('update:value')?.[0]).toEqual([undefined]);
  });
});

/**
 * 区间模式的占位符全站四个调用点传的都是**数组**（`['开始时间', '结束时间']`），
 * 而 props 里一度只声明 `string`：Vue 只打一条 "Invalid prop" warning 就照常渲染，
 * 显示时数组被 `join(',')` 成"开始时间,结束时间"，跟内置默认的 ` - ` 分隔不一致。
 * 症状是"页面看着没坏、控制台一直在报"，所以文案与 warning 一起钉住。
 */
describe('fDatePicker', () => {
  function controlText(wrapper: ReturnType<typeof mount>) {
    return wrapper.find('[data-field-control]').text().trim();
  }

  it('区间模式接得住数组占位符，并按内置分隔符连接', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const wrapper = mount(FDatePicker, {
      props: { range: true, placeholder: ['开始时间', '结束时间'] },
    });

    expect(controlText(wrapper)).toBe('开始时间 - 结束时间');
    expect(
      warn.mock.calls.map((args) => args.join(' ')).join('\n'),
    ).not.toContain('Invalid prop');

    warn.mockRestore();
  });

  it('单值模式字符串占位符照原样显示', () => {
    const wrapper = mount(FDatePicker, { props: { placeholder: '出货日期' } });
    expect(controlText(wrapper)).toBe('出货日期');
  });

  it('不传占位符时按模式回落：单日期 / 区间各一条', () => {
    expect(controlText(mount(FDatePicker))).toBe('请选择日期');
    expect(controlText(mount(FDatePicker, { props: { range: true } }))).toBe(
      '开始日期 - 结束日期',
    );
  });

  it('空字符串与空数组也算没传，不许显示成空白格子', () => {
    expect(
      controlText(mount(FDatePicker, { props: { placeholder: '' } })),
    ).toBe('请选择日期');
    expect(
      controlText(
        mount(FDatePicker, { props: { range: true, placeholder: [] } }),
      ),
    ).toBe('开始日期 - 结束日期');
  });

  it('有值时显示格式化结果而不是占位符', () => {
    const wrapper = mount(FDatePicker, {
      props: { value: '2026-01-05', placeholder: '请选择日期' },
    });
    expect(controlText(wrapper)).toContain('2026-01-05');
  });
});

describe('fSwitch', () => {
  it('布尔开关切换发出 update:value', async () => {
    const wrapper = mount(FSwitch, { props: { value: false } });
    await wrapper.find('[data-field-control]').trigger('click');
    expect(wrapper.emitted('update:value')?.[0]).toEqual([true]);
  });

  it('checkedValue/unCheckedValue 自定义值', async () => {
    const wrapper = mount(FSwitch, {
      props: { value: 0, checkedValue: 1, unCheckedValue: 0 },
    });
    await wrapper.find('[data-field-control]').trigger('click');
    expect(wrapper.emitted('update:value')?.[0]).toEqual([1]);
  });
});

describe('fRadioGroup', () => {
  it('渲染 options 并回传原始 value 类型', async () => {
    const wrapper = mount(FRadioGroup, {
      props: {
        value: undefined,
        options: [
          { label: '男', value: 1 },
          { label: '女', value: 2 },
        ],
      },
    });
    expect(wrapper.text()).toContain('男');
    const radios = wrapper.findAll('input[type="radio"], [role="radio"]');
    expect(radios.length).toBe(2);
    // 通过 label 点击选中第二项
    await wrapper.findAll('label')[1]!.trigger('click');
    const emitted = wrapper.emitted('update:value');
    expect(emitted).toBeTruthy();
    expect(emitted![0]![0]).toBe(2);
  });
});

describe('fCheckbox', () => {
  it('单选形态 value 为布尔', async () => {
    const wrapper = mount(FCheckbox, {
      attachTo: document.body,
      props: { value: false },
    });
    const box = wrapper.find('[role="checkbox"]').element as HTMLElement;
    box.click();
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted('update:value')?.[0]).toEqual([true]);
    wrapper.unmount();
  });

  it('组形态（options）value 为数组', async () => {
    const wrapper = mount(FCheckbox, {
      props: {
        value: [],
        options: [
          { label: 'A', value: 'a' },
          { label: 'B', value: 'b' },
        ],
      },
    });
    await wrapper.findAll('label')[0]!.trigger('click');
    expect(wrapper.emitted('update:value')?.[0]).toEqual([['a']]);
  });

  // shadcn Checkbox 的勾选态来自 reka 的 modelValue，写成 :checked 是无效属性，
  // 值再对也永远画不出勾选框——这两条把绑定契约钉住
  it('value 变化时勾选框要真的显示为已选', async () => {
    const wrapper = mount(FCheckbox, { props: { value: true } });
    expect(wrapper.find('[role="checkbox"]').attributes('data-state')).toBe(
      'checked',
    );
    await wrapper.setProps({ value: false });
    expect(wrapper.find('[role="checkbox"]').attributes('data-state')).toBe(
      'unchecked',
    );
  });

  it('组形态里被选中的选项显示为已选', () => {
    const wrapper = mount(FCheckbox, {
      props: {
        value: ['b'],
        options: [
          { label: 'A', value: 'a' },
          { label: 'B', value: 'b' },
        ],
      },
    });
    const states = wrapper
      .findAll('[role="checkbox"]')
      .map((box) => box.attributes('data-state'));
    expect(states).toEqual(['unchecked', 'checked']);
  });
});

describe('fSlider', () => {
  it('单值模式渲染轨道与滑块', () => {
    const wrapper = mount(FSlider, { props: { value: 30 } });
    expect(wrapper.find('[data-field-control]').exists()).toBe(true);
    expect(wrapper.findAll('[role="slider"]').length).toBe(1);
  });
});

describe('fRate', () => {
  it('点击星级回传数值', async () => {
    const wrapper = mount(FRate, { props: { value: 0, count: 5 } });
    const stars = wrapper.findAll('button');
    expect(stars).toHaveLength(5);
    await stars[2]!.trigger('click');
    expect(wrapper.emitted('update:value')?.[0]).toEqual([3]);
    await stars[4]!.trigger('click');
    expect(wrapper.emitted('update:value')?.[1]).toEqual([5]);
  });
});

describe('fSelect', () => {
  it('渲染占位文本并在点击选项后回传 value', async () => {
    const wrapper = mount(FSelect, {
      attachTo: document.body,
      props: {
        value: undefined,
        placeholder: '请选择状态',
        options: [
          { label: '启用', value: 'on' },
          { label: '禁用', value: 'off' },
        ],
      },
    });
    expect(wrapper.text()).toContain('请选择状态');
    await wrapper.find('[role="combobox"]').trigger('click');
    await vi.waitFor(async () => {
      const opt = [...document.querySelectorAll('button')].find(
        (b) => b.textContent?.trim() === '启用',
      );
      expect(opt).toBeTruthy();
      (opt as HTMLButtonElement).click();
    });
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted('update:value')?.[0]).toEqual(['on']);
    wrapper.unmount();
  });

  it('multiple 模式回传累加数组', async () => {
    const wrapper = mount(FSelect, {
      attachTo: document.body,
      props: {
        value: [],
        mode: 'multiple',
        options: [
          { label: 'A', value: 'a' },
          { label: 'B', value: 'b' },
        ],
      },
    });
    await wrapper.find('[role="combobox"]').trigger('click');
    await vi.waitFor(() => {
      const optA = [...document.querySelectorAll('button')].find(
        (b) => b.textContent?.trim() === 'A',
      );
      expect(optA).toBeTruthy();
      (optA as HTMLButtonElement).click();
    });
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted('update:value')?.[0]).toEqual([['a']]);
    wrapper.unmount();
  });
});

/**
 * `FMarkdown` 现在是 `@antdv/common-ui` 里 tiptap 编辑器的薄壳：
 * 存的是 Markdown 源码，`value` / `update:value` 契约与别的 `F*` 字段一致。
 */
describe('fMarkdown', () => {
  async function mountMarkdown(props: Record<string, any> = {}) {
    const wrapper = mount(FMarkdown, {
      attachTo: document.body,
      props: { value: '', ...props },
    });
    await wrapper.vm.$nextTick();
    await flushPromises();
    return wrapper;
  }

  function editorOf(wrapper: ReturnType<typeof mount>) {
    return wrapper.findComponent(MarkdownEditor)
      .vm as unknown as MarkdownEditorInstance;
  }

  it('渲染富文本编辑器，不再是裸 textarea', async () => {
    const wrapper = await mountMarkdown({ value: '# 标题' });

    expect(wrapper.find('textarea').exists()).toBe(false);
    expect(wrapper.find('[contenteditable="true"]').exists()).toBe(true);
    // 字段存的是 Markdown，不是 HTML
    expect(wrapper.findComponent(MarkdownEditor).props('contentType')).toBe(
      'markdown',
    );
    // Markdown 初值真的解析成了结构，而不是原样贴字符串
    expect(wrapper.find('.tiptap').html()).toContain('<h1>标题</h1>');

    wrapper.unmount();
  });

  it('保留字段契约：id / data-field-control / disabled / placeholder', async () => {
    const wrapper = await mountMarkdown({
      disabled: true,
      id: 'fld-md',
      placeholder: '写点什么…',
    });

    const control = wrapper.find('[data-field-control]');
    expect(control.exists()).toBe(true);
    expect(control.attributes('id')).toBe('fld-md');
    expect(wrapper.findComponent(MarkdownEditor).props('disabled')).toBe(true);
    expect(wrapper.findComponent(MarkdownEditor).props('placeholder')).toBe(
      '写点什么…',
    );

    wrapper.unmount();
  });

  it('placeholder 缺省时给出 Markdown 字段的提示语', async () => {
    const wrapper = await mountMarkdown();
    expect(wrapper.findComponent(MarkdownEditor).props('placeholder')).toBe(
      '请输入 Markdown 内容',
    );
    wrapper.unmount();
  });

  it('编辑后 emit 的 update:value 是 Markdown 源码', async () => {
    const wrapper = await mountMarkdown({ value: '要加粗的文字' });

    editorOf(wrapper)
      .getEditor()
      ?.chain()
      .focus()
      .selectAll()
      .toggleBold()
      .run();
    await flushPromises();

    const emitted = wrapper.emitted('update:value') ?? [];
    expect(String(emitted.at(-1)?.[0])).toBe('**要加粗的文字**');

    wrapper.unmount();
  });

  it('外部 value（Markdown）变化会回灌进编辑器', async () => {
    const wrapper = await mountMarkdown({ value: '# 初值' });

    await wrapper.setProps({ value: '- 项目一\n- 项目二' });
    await flushPromises();

    expect(wrapper.find('.tiptap').html()).toContain('<ul>');
    expect(wrapper.find('.tiptap').text()).toContain('项目一');
    expect(editorOf(wrapper).getMarkdown()).toBe('- 项目一\n- 项目二');

    wrapper.unmount();
  });

  it('rows 换算成编辑区最小高度，未给时走编辑器自身尺寸', async () => {
    const withRows = await mountMarkdown({ rows: 10 });
    expect(withRows.findComponent(MarkdownEditor).props('minHeight')).toBe(240);
    withRows.unmount();

    const withoutRows = await mountMarkdown();
    // rows 缺席时不覆盖，落回 MarkdownEditor 自己的 160px 起高
    expect(withoutRows.findComponent(MarkdownEditor).props('minHeight')).toBe(
      160,
    );
    withoutRows.unmount();
  });

  it('透传 mode 等编辑器 props（preview 模式无工具栏且锁输入）', async () => {
    const wrapper = await mountMarkdown({ mode: 'preview', value: '只读' });

    expect(wrapper.findComponent(MarkdownEditor).props('mode')).toBe('preview');
    expect(wrapper.find('.markdown-editor button').exists()).toBe(false);
    // 不可编辑：没有可聚焦的 contenteditable
    expect(wrapper.find('[contenteditable="true"]').exists()).toBe(false);

    wrapper.unmount();
  });
});
