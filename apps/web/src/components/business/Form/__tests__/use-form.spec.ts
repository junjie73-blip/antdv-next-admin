import type { FormActionType } from '../types';

import { describe, expect, it, vi } from 'vitest';

import { useForm } from '../useForm';

/**
 * `useForm` 的"表单还没挂载"分支。
 *
 * 页面里到处都是这个写法：
 *
 * ```ts
 * formMethods.setFieldsValue(record);
 * modalMethods.openModal();
 * ```
 *
 * 而 `BasicModal` 默认 `destroyOnHidden`，弹窗没开（或上次开完关掉）时表单不在组件树上，
 * 于是"点编辑 → 弹窗是空的、保存把记录改成空值"。
 * 这里用一个假实例把 `register` / `isMounted` 这条契约钉住，不需要真渲染组件。
 */
interface FakeForm extends Omit<FormActionType, 'isMounted'> {
  /** 写进这个对象即视为"渲染出来了" */
  model: Record<string, unknown>;
  /** 组件是否还在树上；测试里直接改它模拟弹窗的开与关 */
  alive: boolean;
  isMounted: () => boolean;
}

function createFakeForm(): FakeForm {
  const state = { alive: true, model: {} as Record<string, unknown> };

  return {
    get model() {
      return state.model;
    },
    get alive() {
      return state.alive;
    },
    set alive(value: boolean) {
      state.alive = value;
    },
    getFieldsValue: () => ({ ...state.model }),
    setFieldsValue: async (values: any) => {
      Object.assign(state.model, values);
    },
    resetFields: async () => {
      state.model = {};
    },
    validate: async () => ({ ...state.model }),
    validateFields: async () => ({ ...state.model }),
    submit: async () => {},
    clearValidate: async () => {},
    scrollToField: async () => {},
    updateSchema: async () => {},
    removeSchemaByField: async () => {},
    appendSchemaByField: async () => {},
    setProps: async () => {},
    getForm: () => null,
    isMounted: () => state.alive,
  };
}

describe('useForm · 未挂载时的待写入值', () => {
  it('实例还没注册时，setFieldsValue 在 register 时被兑现', async () => {
    const [register, methods] = useForm();

    await methods.setFieldsValue({ title: '原始标题' });

    const form = createFakeForm();
    register(form);
    await Promise.resolve();

    expect(form.model).toEqual({ title: '原始标题' });
  });

  it('实例活着时直接写入，不留待写入值', async () => {
    const [register, methods] = useForm();
    const form = createFakeForm();
    register(form);

    await methods.setFieldsValue({ title: 'A' });
    expect(form.model).toEqual({ title: 'A' });

    // 卸载后再写一次，旧的已生效值不该在下次挂载时盖掉新值
    form.alive = false;
    const next = createFakeForm();
    register(next);
    await methods.setFieldsValue({ title: 'B' });
    expect(next.model).toEqual({ title: 'B' });
  });

  it('写进死实例不算成功：下一次挂载才拿到值', async () => {
    const [register, methods] = useForm();
    const first = createFakeForm();
    register(first);
    await methods.setFieldsValue({ title: '第一次' });
    expect(first.model).toEqual({ title: '第一次' });

    // 弹窗关闭 → 组件销毁，但 formRef 里的引用还在
    first.alive = false;
    await methods.setFieldsValue({ title: '第二次', status: 1 });
    // 死对象一次都不该被写：写了也没人看得见，只会把"回填失败"伪装成"已回填"
    expect(first.model).toEqual({ title: '第一次' });

    const second = createFakeForm();
    register(second);
    await Promise.resolve();
    expect(second.model).toEqual({ status: 1, title: '第二次' });
  });

  it('待写入值会累加，后面的字段赢', async () => {
    const [register, methods] = useForm();

    await methods.setFieldsValue({ title: '初值', type: 2 });
    await methods.setFieldsValue({ title: '改后' });

    const form = createFakeForm();
    register(form);
    await Promise.resolve();

    expect(form.model).toEqual({ title: '改后', type: 2 });
  });

  it('resetFields 把待写入值一起清掉', async () => {
    const [register, methods] = useForm();

    await methods.setFieldsValue({ title: '别回填' });
    await methods.resetFields();

    const form = createFakeForm();
    register(form);
    await Promise.resolve();

    expect(form.model).toEqual({});
  });

  it('待写入值只兑现一次，不会被下次挂载重复使用', async () => {
    const [register, methods] = useForm();

    await methods.setFieldsValue({ title: '一次性' });
    const first = createFakeForm();
    register(first);
    await Promise.resolve();
    expect(first.model).toEqual({ title: '一次性' });

    first.alive = false;
    const second = createFakeForm();
    register(second);
    await Promise.resolve();
    expect(second.model).toEqual({});
  });

  it('不带 isMounted 的老实例按"活着"处理，行为不变', async () => {
    const [register, methods] = useForm();
    const form = createFakeForm();
    // @ts-expect-error 故意去掉可选契约
    delete form.isMounted;
    const spy = vi.spyOn(form, 'setFieldsValue');
    register(form);

    await methods.setFieldsValue({ title: '直接写' });

    expect(spy).toHaveBeenCalled();
    expect(form.model).toEqual({ title: '直接写' });
  });
});
