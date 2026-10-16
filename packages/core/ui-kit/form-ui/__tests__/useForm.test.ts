import type { FormActionType } from '../src/types';

import { describe, expect, it, vi } from 'vitest';

import { useForm } from '../src/use-vben-form';

function createMockInstance(isMounted = true): FormActionType {
  return {
    appendSchemaByField: vi.fn(async () => {}),
    clearValidate: vi.fn(async () => {}),
    getFieldsValue: vi.fn(() => ({ a: 1 })),
    getForm: vi.fn(() => null),
    isMounted: () => isMounted,
    removeSchemaByField: vi.fn(async () => {}),
    resetFields: vi.fn(async () => {}),
    scrollToField: vi.fn(async () => {}),
    setFieldsValue: vi.fn(async () => {}),
    setProps: vi.fn(async () => {}),
    submit: vi.fn(async () => {}),
    updateSchema: vi.fn(async () => {}),
    validate: vi.fn(async () => ({})),
    validateFields: vi.fn(async () => ({})),
  } as unknown as FormActionType;
}

describe('useForm', () => {
  it('register 时把缓存 props 灌给实例', () => {
    const [register, methods] = useForm({ labelWidth: 100 });
    const instance = createMockInstance();
    register(instance);
    expect(instance.setProps).toHaveBeenCalledWith(
      expect.objectContaining({ labelWidth: 100 }),
    );
    void methods;
  });

  it('未挂载时 setFieldsValue 进入待写入队列，register 后兑现', async () => {
    const [register, methods] = useForm();
    await methods.setFieldsValue({ a: 1 });
    await methods.setFieldsValue({ b: 2, a: 9 });

    const instance = createMockInstance();
    register(instance);
    expect(instance.setFieldsValue).toHaveBeenCalledWith({ a: 9, b: 2 });

    // 队列兑现后清空：再次挂载不会重复写入
    const second = createMockInstance();
    register(second);
    expect(second.setFieldsValue).not.toHaveBeenCalled();
  });

  it('实例已卸载（isMounted=false）时写入转队列而不是静默丢失', async () => {
    const [register, methods] = useForm();
    const alive = createMockInstance(true);
    register(alive);

    const dead = createMockInstance(false);
    register(dead as any);
    await methods.setFieldsValue({ x: 1 });
    expect(alive.setFieldsValue).not.toHaveBeenCalled();

    const fresh = createMockInstance(true);
    register(fresh);
    expect(fresh.setFieldsValue).toHaveBeenCalledWith({ x: 1 });
  });

  it('resetFields 清空待写入队列', async () => {
    const [register, methods] = useForm();
    await methods.setFieldsValue({ a: 1 });
    await methods.resetFields();
    const instance = createMockInstance();
    register(instance);
    expect(instance.setFieldsValue).not.toHaveBeenCalled();
  });

  it('setProps 缓存 schemas 为替换而不是合并', async () => {
    const [register, methods] = useForm();
    await methods.setProps({ schemas: [{ field: 'a' }] as any });
    await methods.setProps({ schemas: [{ field: 'b' }] as any });

    const instance = createMockInstance();
    register(instance);
    const callArgs = (instance.setProps as any).mock.calls[0][0];
    expect(callArgs.schemas).toEqual([{ field: 'b' }]);
  });

  it('无实例时读方法返回安全默认值', async () => {
    const [, methods] = useForm();
    expect(methods.getFieldsValue()).toEqual({});
    await expect(methods.validate()).resolves.toEqual({});
    expect(methods.getForm()).toBeNull();
  });
});
