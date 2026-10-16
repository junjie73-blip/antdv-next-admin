import type { FormActionType, FormSchema } from '../src/types';

import { flushPromises, mount } from '@vue/test-utils';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import BasicForm from '../src/components/form-render/form.vue';

function mountForm(
  schemas: FormSchema[],
  props: Record<string, any> = {},
  slots: Record<string, any> = {},
) {
  return mount(BasicForm as any, {
    props: { schemas, ...props },
    slots,
    attachTo: document.body,
  });
}

function getInstance(wrapper: any): FormActionType {
  const events = wrapper.emitted('register');
  return events[0][0] as FormActionType;
}

describe('BasicForm', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('挂载后 emit register，渲染 schema 控件与 label', async () => {
    const wrapper = mountForm([
      {
        field: 'username',
        label: '用户名',
        component: 'Input',
        componentProps: { placeholder: '输入用户名' },
      },
    ]);
    await flushPromises();
    expect(wrapper.emitted('register')).toBeTruthy();
    expect(wrapper.text()).toContain('用户名');
    const input = wrapper.find('input[data-field-control]');
    expect(input.exists()).toBe(true);
    expect(input.attributes('placeholder')).toBe('输入用户名');
  });

  it('label 用 for 关联到控件节点，`label.control` 解析得回来', async () => {
    const wrapper = mountForm([
      { field: 'username', label: '用户名', component: 'Input' },
      { field: 'memo', label: '备注', component: 'InputTextArea' },
    ]);
    await flushPromises();
    const labels = wrapper.findAll('label.form-item-label');
    expect(labels).toHaveLength(2);
    const ids = labels.map((label) => label.attributes('for'));
    expect(ids[0]).toBeTruthy();
    // 两个字段的 id 不能撞车
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) {
      const control = document.querySelector(`#${CSS.escape(id as string)}`);
      expect(control?.hasAttribute('data-field-control')).toBe(true);
      expect(
        (wrapper.find(`label[for="${id}"]`).element as HTMLLabelElement)
          .control,
      ).toBe(control);
    }
  });

  it('必填星号是伪元素，不落在标签文本里', async () => {
    const wrapper = mountForm([
      {
        field: 'username',
        label: '用户名',
        component: 'Input',
        required: true,
      },
      {
        field: 'remark',
        label: '备注',
        component: 'Input',
        itemProps: { required: true },
      },
    ]);
    await flushPromises();
    const labels = wrapper.findAll('label.form-item-label');
    expect(labels.map((label) => label.text())).toEqual(['用户名', '备注']);
    for (const label of labels) {
      expect(label.classes()).toContain("before:content-['*']");
    }
  });

  it('输入触发 update:value 并同步 getFieldsValue', async () => {
    const wrapper = mountForm([
      { field: 'username', label: '用户名', component: 'Input' },
    ]);
    await flushPromises();
    const instance = getInstance(wrapper);
    await wrapper.find('input[data-field-control]').setValue('hello');
    expect(instance.getFieldsValue().username).toBe('hello');
  });

  it('setFieldsValue 回填到控件展示值', async () => {
    const wrapper = mountForm([
      { field: 'username', label: '用户名', component: 'Input' },
    ]);
    await flushPromises();
    const instance = getInstance(wrapper);
    await instance.setFieldsValue({ username: 'prefilled' });
    await flushPromises();
    expect(
      (wrapper.find('input[data-field-control]').element as HTMLInputElement)
        .value,
    ).toBe('prefilled');
  });

  it('必填校验失败：validate reject errorFields 且展示错误文案', async () => {
    const wrapper = mountForm([
      {
        field: 'username',
        label: '用户名',
        component: 'Input',
        required: true,
      },
    ]);
    await flushPromises();
    const instance = getInstance(wrapper);
    await expect(instance.validate()).rejects.toMatchObject({
      errorFields: [{ errors: ['该项为必填项'], name: ['username'] }],
      message: '该项为必填项',
    });
    await vi.waitFor(() => {
      expect(wrapper.find('[data-error]').text()).toBe('该项为必填项');
    });
  });

  it('校验只在提交后触发：灌初值阶段一条错误都不显示', async () => {
    const wrapper = mountForm([
      {
        component: 'Input',
        field: 'username',
        label: '用户名',
        required: true,
      },
      { component: 'Input', field: 'code', label: '编码', required: true },
    ]);
    await flushPromises();
    const instance = getInstance(wrapper);

    // 抽屉/弹窗打开时的常规动作：先灌一遍空初值（tanstack 会把字段标成 touched）
    await instance.setFieldsValue({ code: '', username: '' });
    await flushPromises();
    expect(wrapper.find('[data-error]').exists()).toBe(false);

    await expect(instance.validate()).rejects.toBeTruthy();
    await vi.waitFor(() => {
      expect(wrapper.findAll('[data-error]')).toHaveLength(2);
    });

    // 提交过一次以后，改动才实时纠正
    await instance.setFieldsValue({ username: 'admin' });
    await vi.waitFor(() => {
      expect(wrapper.findAll('[data-error]')).toHaveLength(1);
    });
  });

  it('行与行之间有垂直间距，gutter 的垂直分量可覆盖', async () => {
    const schemas: FormSchema[] = [
      { component: 'Input', field: 'username', label: '用户名' },
      { component: 'Input', field: 'code', label: '编码' },
    ];
    const wrapper = mountForm(schemas, { grid: { cols: 1 } });
    await flushPromises();
    const style = wrapper.find('.form-row').attributes('style') ?? '';
    expect(style).toContain('margin-bottom: 16px');
    expect(style).toContain('row-gap: 16px');

    const custom = mountForm(schemas, { grid: { cols: 1, gutter: [24, 4] } });
    await flushPromises();
    expect(custom.find('.form-row').attributes('style')).toContain(
      'margin-bottom: 4px',
    );
  });

  it('标签与控件之间留横向间隙（只写 gap-y 时两者贴在一起）', async () => {
    const wrapper = mountForm([
      { component: 'Input', field: 'username', label: '用户名' },
    ]);
    await flushPromises();
    expect(
      wrapper.find('.form-item > div').classes(),
    ).toContain('gap-x-2');
  });

  it('校验通过后 submit 触发 emit(submit)', async () => {
    const wrapper = mountForm([
      {
        field: 'username',
        label: '用户名',
        component: 'Input',
        required: true,
      },
    ]);
    await flushPromises();
    const instance = getInstance(wrapper);
    await instance.setFieldsValue({ username: 'ok' });
    await instance.submit();
    await vi.waitFor(() => {
      expect(wrapper.emitted('submit')?.[0]?.[0]).toEqual({ username: 'ok' });
    });
  });

  it('defaultValue 初始化值，resetFields 回到默认值', async () => {
    const wrapper = mountForm([
      {
        field: 'status',
        label: '状态',
        component: 'Input',
        defaultValue: 'abc',
      },
    ]);
    await flushPromises();
    const instance = getInstance(wrapper);
    expect(instance.getFieldsValue().status).toBe('abc');
    await instance.setFieldsValue({ status: 'xyz' });
    await instance.resetFields();
    expect(instance.getFieldsValue().status).toBe('abc');
  });

  it('ifShow=false 不渲染，show=false 渲染但隐藏', async () => {
    const wrapper = mountForm([
      { field: 'a', label: 'A', component: 'Input', ifShow: false },
      { field: 'b', label: 'B', component: 'Input', show: false },
      { field: 'c', label: 'C', component: 'Input' },
    ]);
    await flushPromises();
    expect(wrapper.find('[data-field="a"]').exists()).toBe(false);
    expect(wrapper.find('[data-field="b"]').exists()).toBe(true);
    expect(wrapper.find('[data-field="c"]').exists()).toBe(true);
  });

  it('slot 形态渲染自定义内容并拿到 model', async () => {
    const wrapper = mountForm(
      [{ field: 'custom', label: '自定义', slot: 'mySlot' }],
      {},
      {
        mySlot: (slotProps: any) =>
          `slot:${slotProps.field}:${JSON.stringify(
            Object.keys(slotProps.model ?? {}),
          )}`,
      },
    );
    await flushPromises();
    expect(wrapper.text()).toContain('slot:custom');
  });

  it('fieldMapToTime 在 validate 时拆分区间字段', async () => {
    const wrapper = mountForm(
      [
        {
          field: 'time',
          label: '时间',
          component: 'RangePicker',
        },
      ],
      { fieldMapToTime: [['time', ['startTime', 'endTime']]] },
    );
    await flushPromises();
    const instance = getInstance(wrapper);
    await instance.setFieldsValue({
      time: ['2024-01-01', '2024-01-31'],
    });
    const values = await instance.validate();
    expect(values.startTime).toBe('2024-01-01');
    expect(values.endTime).toBe('2024-01-31');
    expect(values.time).toBeUndefined();
  });

  it('updateSchema 合并新属性（deepMerge 目标优先语义）', async () => {
    const wrapper = mountForm([{ field: 'a', label: 'A', component: 'Input' }]);
    await flushPromises();
    const instance = getInstance(wrapper);
    await instance.updateSchema({
      field: 'a',
      componentProps: { placeholder: '新占位' },
    });
    await flushPromises();
    expect(
      wrapper.find('input[data-field-control]').attributes('placeholder'),
    ).toBe('新占位');
  });

  it('removeSchemaByField / appendSchemaByField 操作 DOM 字段', async () => {
    const wrapper = mountForm([
      { field: 'a', label: 'A', component: 'Input' },
      { field: 'b', label: 'B', component: 'Input' },
    ]);
    await flushPromises();
    const instance = getInstance(wrapper);
    await instance.removeSchemaByField('a');
    await flushPromises();
    expect(wrapper.find('[data-field="a"]').exists()).toBe(false);

    await instance.appendSchemaByField(
      { field: 'c', label: 'C', component: 'Input' },
      'b',
      true,
    );
    await flushPromises();
    const fields = wrapper.findAll('[data-field]');
    expect(fields[0]!.attributes('data-field')).toBe('c');
  });

  it('setProps 替换 schemas 并重建表单', async () => {
    const wrapper = mountForm([{ field: 'a', label: 'A', component: 'Input' }]);
    await flushPromises();
    const instance = getInstance(wrapper);
    await instance.setProps({
      schemas: [{ field: 'z', label: 'Z', component: 'Input' }],
    });
    await flushPromises();
    expect(wrapper.find('[data-field="a"]').exists()).toBe(false);
    expect(wrapper.find('[data-field="z"]').exists()).toBe(true);
  });

  it('clearValidate 抹掉错误与 touched 状态', async () => {
    const wrapper = mountForm([
      { field: 'a', label: 'A', component: 'Input', required: true },
    ]);
    await flushPromises();
    const instance = getInstance(wrapper);
    await expect(instance.validate()).rejects.toBeTruthy();
    await vi.waitFor(() => {
      expect(wrapper.find('[data-error]').exists()).toBe(true);
    });
    await instance.clearValidate();
    await flushPromises();
    expect(wrapper.find('[data-error]').exists()).toBe(false);
  });

  it('showAdvancedButton：超过行数折叠并可展开', async () => {
    const schemas: FormSchema[] = Array.from({ length: 5 }, (_, i) => ({
      field: `f${i}`,
      label: `字段${i}`,
      component: 'Input',
    }));
    const wrapper = mountForm(schemas, {
      grid: { cols: 1 },
      showAdvancedButton: true,
      alwaysShowLines: 2,
    });
    await flushPromises();
    // 折叠：只显示前 2 行
    expect(wrapper.findAll('[data-field]')).toHaveLength(2);
    const expandBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('展开'));
    expect(expandBtn).toBeTruthy();
    await expandBtn!.trigger('click');
    await flushPromises();
    expect(wrapper.findAll('[data-field]')).toHaveLength(5);
  });

  it('提交按钮存在且表单 submit 事件触发 emit(submit)', async () => {
    const wrapper = mountForm([{ field: 'a', label: 'A', component: 'Input' }]);
    await flushPromises();
    const submitBtn = wrapper
      .findAll('button')
      .find((b) => b.attributes('type') === 'submit');
    expect(submitBtn).toBeTruthy();
    await wrapper.find('form').trigger('submit');
    // tanstack 异步校验内部有计时器，用 waitFor 轮询结果
    await vi.waitFor(() => {
      expect(wrapper.emitted('submit')).toBeTruthy();
    });
  });

  it('卸载后 isMounted() 返回 false', async () => {
    const wrapper = mountForm([{ field: 'a', label: 'A', component: 'Input' }]);
    await flushPromises();
    const instance = getInstance(wrapper);
    expect(instance.isMounted!()).toBe(true);
    wrapper.unmount();
    expect(instance.isMounted!()).toBe(false);
  });
});
