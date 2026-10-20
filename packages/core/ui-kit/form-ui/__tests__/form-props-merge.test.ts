import type { FormActionType } from '../src/types';

import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import BasicForm from '../src/components/form-render/form.vue';

/** 每行两个字段（span 12），n 个字段就是 ceil(n/2) 行 */
function fields(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    colProps: { span: 12 },
    component: 'Input',
    field: `f${i}`,
    label: `字段${i}`,
  }));
}

function mountForm(props: Record<string, any> = {}) {
  const wrapper = mount(BasicForm as any, {
    props: { schemas: fields(6), ...props },
  });
  const registered = wrapper.emitted('register')?.[0]?.[0];
  if (!registered) throw new Error('BasicForm 没有 emit register');
  return { instance: registered as FormActionType, wrapper };
}

describe('BasicForm 配置优先级', () => {
  it('useForm/setProps 的布尔开关能生效（Vue 把未传的 Boolean prop cast 成 false）', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { instance, wrapper } = mountForm();
    // 不给开关时 6 个字段铺满 3 行，也没有展开/收起按钮
    expect(wrapper.findAll('.form-row')).toHaveLength(3);
    expect(wrapper.find('[data-form-actions]').text()).not.toContain('展开');

    await instance.setProps({ alwaysShowLines: 1, showAdvancedButton: true });
    await flushPromises();

    expect(wrapper.findAll('.form-row')).toHaveLength(1);
    expect(wrapper.find('[data-form-actions]').text()).toContain('展开');
    wrapper.unmount();
  });

  it('模板上显式绑定的 prop 优先于 setProps', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { instance, wrapper } = mountForm({ showAdvancedButton: false });
    await instance.setProps({ alwaysShowLines: 1, showAdvancedButton: true });
    await flushPromises();
    expect(wrapper.findAll('.form-row')).toHaveLength(3);
    wrapper.unmount();
  });

  it('后一次 setProps 覆盖前一次（标量不留住旧值）', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { instance, wrapper } = mountForm();
    await instance.setProps({ showActionButtonGroup: true });
    await flushPromises();
    expect(wrapper.find('[data-form-actions]').exists()).toBe(true);

    await instance.setProps({ showActionButtonGroup: false });
    await flushPromises();
    expect(wrapper.find('[data-form-actions]').exists()).toBe(false);
    wrapper.unmount();
  });
});
