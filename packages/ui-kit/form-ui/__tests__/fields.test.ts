import { mount } from '@vue/test-utils';

import { describe, expect, it, vi } from 'vitest';

import FCheckbox from '../src/fields/FCheckbox.vue';
import FInput from '../src/fields/FInput.vue';
import FInputNumber from '../src/fields/FInputNumber.vue';
import FRadioGroup from '../src/fields/FRadioGroup.vue';
import FRate from '../src/fields/FRate.vue';
import FSelect from '../src/fields/FSelect.vue';
import FSlider from '../src/fields/FSlider.vue';
import FSwitch from '../src/fields/FSwitch.vue';
import FTextarea from '../src/fields/FTextarea.vue';

describe('FInput', () => {
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

describe('FTextarea', () => {
  it('输入发出 update:value', async () => {
    const wrapper = mount(FTextarea, { props: { value: '' } });
    await wrapper.find('textarea').setValue('line1');
    expect(wrapper.emitted('update:value')?.[0]).toEqual(['line1']);
  });
});

describe('FInputNumber', () => {
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

describe('FSwitch', () => {
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

describe('FRadioGroup', () => {
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

describe('FCheckbox', () => {
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

describe('FSlider', () => {
  it('单值模式渲染轨道与滑块', () => {
    const wrapper = mount(FSlider, { props: { value: 30 } });
    expect(wrapper.find('[data-field-control]').exists()).toBe(true);
    expect(wrapper.findAll('[role="slider"]').length).toBe(1);
  });
});

describe('FRate', () => {
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

describe('FSelect', () => {
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
