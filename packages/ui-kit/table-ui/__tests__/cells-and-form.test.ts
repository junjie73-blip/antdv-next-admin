import type { FormSchema } from '@antdv/form-ui';

import type { Recordable } from '../src/types';

import { flushPromises, mount } from '@vue/test-utils';
import { computed, nextTick, ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import BasicTable from '../src/BasicTable.vue';
import TableEditableCell from '../src/components/TableEditableCell.vue';
import TableHeaderCell from '../src/components/TableHeaderCell.vue';
import TableImg from '../src/components/TableImg.vue';
import { useTableForm } from '../src/hooks/useTableForm';

const record: Recordable = { age: 28, id: 1, name: '张三' };

const baseSchemas = [
  { component: 'Input', field: 'createTime' },
  { component: 'Input', field: 'name' },
] as FormSchema[];

describe('TableImg', () => {
  it('按 imgList 渲染缩略图，尺寸来自 size', () => {
    const wrapper = mount(TableImg, {
      props: { imgList: ['https://x/a.png', 'https://x/b.png'], size: 32 },
    });
    const imgs = wrapper.findAll('img');
    expect(imgs).toHaveLength(2);
    expect(imgs[0]!.attributes('src')).toBe('https://x/a.png');
    expect(imgs[0]!.attributes('style')).toContain('width: 32px');
  });

  it('无图时不渲染', () => {
    expect(mount(TableImg, { props: {} }).findAll('img')).toHaveLength(0);
  });

  it('simpleShow 只显示首图并给出剩余数量', () => {
    const wrapper = mount(TableImg, {
      props: {
        imgList: ['https://x/a.png', 'https://x/b.png', 'https://x/c.png'],
        simpleShow: true,
      },
    });
    expect(wrapper.findAll('img')).toHaveLength(1);
    expect(wrapper.text()).toContain('+2');
  });
});

describe('TableHeaderCell', () => {
  it('渲染 title 与默认插槽', () => {
    const wrapper = mount(TableHeaderCell, {
      props: { column: { title: '名称' } },
      slots: { default: '<span class="mine">x</span>' },
    });
    expect(wrapper.text()).toContain('名称');
    expect(wrapper.find('.mine').exists()).toBe(true);
  });

  it('align 决定容器对齐 class', () => {
    const left = mount(TableHeaderCell, {
      props: { column: { align: 'left', title: 'a' } },
    });
    const right = mount(TableHeaderCell, {
      props: { column: { align: 'right', title: 'a' } },
    });
    expect(left.find('div').classes()).toContain('justify-start');
    expect(right.find('div').classes()).toContain('justify-end');
  });

  it('可编辑列显示编辑图标，点击发 edit 且不冒泡', async () => {
    const column = { title: '名称' };
    const wrapper = mount(TableHeaderCell, { props: { column } });
    expect(wrapper.find('[title="点击编辑"]').exists()).toBe(false);

    const editable = mount(TableHeaderCell, {
      props: { column, editable: true },
    });
    await editable.find('[title="点击编辑"]').trigger('click');
    expect(editable.emitted('edit')?.[0]).toEqual([column]);
  });

  it('column.edit / editRow 同样点亮编辑图标', () => {
    expect(
      mount(TableHeaderCell, {
        props: { column: { edit: true, title: 'a' } },
      })
        .find('[title="点击编辑"]')
        .exists(),
    ).toBe(true);
    expect(
      mount(TableHeaderCell, {
        props: { column: { editRow: true, title: 'a' } },
      })
        .find('[title="点击编辑"]')
        .exists(),
    ).toBe(true);
  });
});

describe('TableEditableCell', () => {
  it('非编辑列就是纯文本', () => {
    const wrapper = mount(TableEditableCell, {
      props: { column: {}, dataIndex: 'name', record, value: '张三' },
    });
    expect(wrapper.text()).toBe('张三');
    expect(wrapper.find('[title="点击编辑"]').exists()).toBe(false);
  });

  it('编辑列先显示触发器，点击后进入编辑态', async () => {
    const wrapper = mount(TableEditableCell, {
      props: {
        column: { edit: true },
        dataIndex: 'name',
        record,
        value: '张三',
      },
    });
    await wrapper.find('[title="点击编辑"]').trigger('click');
    await nextTick();
    expect(wrapper.find('[data-field-control]').exists()).toBe(true);
    expect(wrapper.find('button[title="保存"]').exists()).toBe(true);
    expect(wrapper.find('button[title="取消"]').exists()).toBe(true);
  });

  it('文本组件靠回车保存，值随 save 一起抛出', async () => {
    const wrapper = mount(TableEditableCell, {
      props: { column: { edit: true }, dataIndex: 'name', record, value: '张三' },
    });
    await wrapper.find('[title="点击编辑"]').trigger('click');
    await nextTick();
    const input = wrapper.find('input');
    await input.setValue('李四');
    await input.trigger('keydown', { code: 'Enter', key: 'Enter' });
    await nextTick();
    expect(wrapper.emitted('save')?.at(-1)?.[0]).toMatchObject({
      dataIndex: 'name',
      value: '李四',
    });
  });

  it('保存按钮直接保存，取消按钮回滚值并抛 cancel', async () => {
    const wrapper = mount(TableEditableCell, {
      props: { column: { edit: true }, dataIndex: 'name', record, value: '张三' },
    });
    await wrapper.find('[title="点击编辑"]').trigger('click');
    await nextTick();
    await wrapper.find('input').setValue('改了但不保存');
    await wrapper.find('button[title="取消"]').trigger('click');
    expect(wrapper.emitted('cancel')?.[0]).toMatchObject([{ dataIndex: 'name' }]);
    expect(wrapper.emitted('save')).toBeUndefined();

    await wrapper.find('[title="点击编辑"]').trigger('click');
    await nextTick();
    expect(wrapper.find('input').element.value).toBe('张三');
    await wrapper.find('button[title="保存"]').trigger('click');
    expect(wrapper.emitted('save')?.[0]?.[0]).toMatchObject({ value: '张三' });
  });

  it('非文本组件改值即保存，不再需要回车', async () => {
    const wrapper = mount(TableEditableCell, {
      props: {
        column: { edit: true, editComponent: 'Switch' },
        dataIndex: 'name',
        record,
        value: false,
      },
    });
    await wrapper.find('[title="点击编辑"]').trigger('click');
    await nextTick();
    // 真实点一下开关：FSwitch -> update:value -> 单元格改值即保存
    await wrapper.find('[role="switch"]').trigger('click');
    await nextTick();
    expect(wrapper.emitted('change')?.[0]).toMatchObject([{ value: true }]);
    expect(wrapper.emitted('save')?.[0]).toMatchObject([{ value: true }]);
  });

  it('按值类型推断编辑组件，并可透传 editComponentProps', async () => {
    const numberCell = mount(TableEditableCell, {
      props: {
        column: { edit: true, editComponentProps: { placeholder: 'p1' } },
        dataIndex: 'age',
        record,
        value: 28,
      },
    });
    await numberCell.find('[title="点击编辑"]').trigger('click');
    await nextTick();
    expect(numberCell.find('input[type="number"]').exists()).toBe(true);
    expect(numberCell.find('input').attributes('placeholder')).toBe('p1');
  });

  it('未知编辑组件退回文本输入，不会白屏', async () => {
    const wrapper = mount(TableEditableCell, {
      props: {
        column: { edit: true, editComponent: 'ApiSelect' },
        dataIndex: 'name',
        record,
        value: '张三',
      },
    });
    await wrapper.find('[title="点击编辑"]').trigger('click');
    await nextTick();
    expect(wrapper.find('input').exists()).toBe(true);
  });

  it('props.value 变化会同步编辑中的值', async () => {
    const value = ref('张三');
    const wrapper = mount(TableEditableCell, {
      props: { column: { edit: true }, dataIndex: 'name', record, value },
    });
    await wrapper.find('[title="点击编辑"]').trigger('click');
    value.value = '外部改过的名字';
    await nextTick();
    expect(wrapper.find('input').element.value).toBe('外部改过的名字');
  });
});

describe('useTableForm', () => {
  it('默认表单 props 与 useSearchForm 开关', () => {
    const propsRef = ref({ formConfig: { schemas: baseSchemas } });
    const { getFormProps } = useTableForm({ propsRef });
    expect(getFormProps.value).toMatchObject({
      autoSubmitOnEnter: true,
      showActionButtonGroup: true,
      showResetButton: true,
      showSubmitButton: true,
      submitOnReset: true,
    });
    expect(getFormProps.value.submitFunc).toBeUndefined();

    const withSearch = useTableForm({
      propsRef: ref({ formConfig: {}, useSearchForm: true }),
    });
    expect(withSearch.getFormProps.value.submitFunc).toBeTypeOf('function');
    expect(withSearch.getFormProps.value.resetFunc).toBeTypeOf('function');
  });

  it('handleSearchInfoFn 丢掉空条件并拆分时间范围', () => {
    const { handleSearchInfoFn } = useTableForm({
      baseProps: computed(
        () =>
          ({
            formConfig: {
              fieldMapToTime: [['createTime', ['startTime', 'endTime']]],
              schemas: baseSchemas,
            },
          }) as any,
      ),
    });
    const info = handleSearchInfoFn({
      createTime: ['2026-01-01', '2026-02-01'],
      empty: '',
      name: '张三',
      nullish: null,
    });
    expect(info).toMatchObject({
      endTime: '2026-02-01',
      name: '张三',
      startTime: '2026-01-01',
    });
    expect(info.createTime).toBeUndefined();
    expect(info.empty).toBeUndefined();
    expect(info.nullish).toBeUndefined();
  });

  /**
   * `useForm` 的方法都代理到 register 进来的表单实例，
   * 单测里不挂 BasicForm，就用一个假实例把这条链路补齐。
   */
  function fakeForm(initial: Recordable = {}) {
    let values: Recordable = { ...initial };
    return {
      getFieldsValue: () => ({ ...values }),
      isMounted: () => true,
      resetFields: async () => {
        values = {};
      },
      setFieldsValue: async (v: Recordable) => {
        values = { ...values, ...v };
      },
      setProps: () => {},
      validate: async () => ({ ...values }),
    };
  }

  it('提交时把搜索条件交给表格的 fetch', async () => {
    const fetch = vi.fn<(params: any) => Promise<void>>(async () => {});
    const { getFormProps, registerForm } = useTableForm({
      fetch,
      propsRef: ref({
        formConfig: { schemas: baseSchemas },
        useSearchForm: true,
      }),
    });
    registerForm(fakeForm({ name: '李四' }) as any);
    await (getFormProps.value.submitFunc as () => Promise<void>)();
    expect(fetch).toHaveBeenCalled();
    expect(fetch.mock.calls.at(-1)![0]).toMatchObject({
      searchInfo: { name: '李四' },
    });
  });

  it('未注册表单实例时提交也不会炸（校验退化为空条件）', async () => {
    const fetch = vi.fn<(params: any) => Promise<void>>(async () => {});
    const { getFormProps, registerForm } = useTableForm({
      fetch,
      propsRef: ref({
        formConfig: { schemas: baseSchemas },
        useSearchForm: true,
      }),
    });
    expect(registerForm).toBeTypeOf('function');
    await (getFormProps.value.submitFunc as () => Promise<void>)();
    expect(fetch).toHaveBeenCalledWith({ searchInfo: {} });
  });

  it('重置不管 submitOnReset 都要清掉表格记住的条件', async () => {
    const setSearchInfo = vi.fn();
    const fetch = vi.fn<(params: any) => Promise<void>>(async () => {});
    const { getFormProps, registerForm } = useTableForm({
      fetch,
      propsRef: ref({
        formConfig: {
          schemas: baseSchemas,
          submitOnReset: false,
          values: { name: '张三' },
        },
        useSearchForm: true,
      }),
      setSearchInfo,
    });
    registerForm(fakeForm({ name: '张三' }) as any);
    await (getFormProps.value.resetFunc as () => Promise<void>)();
    expect(fetch).not.toHaveBeenCalled();
    expect(setSearchInfo).toHaveBeenCalled();
  });

  it('processFormSchema 应用 dynamicDisabled / dynamicRules', () => {
    const { processFormSchema } = useTableForm({
      getFormValues: () => ({ locked: true }),
    });
    const [out] = processFormSchema([
      {
        component: 'Input',
        componentProps: { placeholder: 'x' },
        dynamicDisabled: ({ values }: any) => values.locked,
        dynamicRules: () => [{ required: true, trigger: 'blur' }],
        field: 'name',
      },
    ] as any);
    expect(out!.componentProps).toMatchObject({
      disabled: true,
      placeholder: 'x',
    });
    expect(out!.rules).toEqual([{ required: true, trigger: 'blur' }]);
  });

  it('replaceFormSchemaKey 与 handleSearchInfoFn 一致', () => {
    const { replaceFormSchemaKey } = useTableForm();
    expect(replaceFormSchemaKey({ a: 1, b: '' }, baseSchemas as any)).toEqual({
      a: 1,
    });
  });
});

describe('BasicTable 搜索表单联动', () => {
  it('useSearchForm 渲染搜索表单，提交后条件进入请求参数', async () => {
    const api = vi.fn<(params: any) => Promise<any>>(async () => ({ list: [], total: 0 }));
    const wrapper = mount(BasicTable as any, {
      props: {
        api,
        columns: [{ dataIndex: 'name', title: '名称' }],
        formConfig: { schemas: baseSchemas.slice(0, 1) },
        immediate: false,
        pagination: false,
        showTableSetting: false,
        useSearchForm: true,
      },
    });
    await nextTick();
    expect(wrapper.find('form').exists()).toBe(true);

    await (wrapper as any).vm.setFormValues({ name: '王五' });
    await (wrapper as any).vm.submitForm();
    await flushPromises();

    expect(api).toHaveBeenCalled();
    expect(api.mock.calls.at(-1)![0]).toMatchObject({ name: '王五' });
    wrapper.unmount();
  });

  it('关掉 useSearchForm 就不渲染表单', () => {
    const wrapper = mount(BasicTable as any, {
      props: {
        columns: [{ dataIndex: 'name', title: '名称' }],
        dataSource: [record],
        showTableSetting: false,
      },
    });
    expect(wrapper.find('form').exists()).toBe(false);
    wrapper.unmount();
  });
});
