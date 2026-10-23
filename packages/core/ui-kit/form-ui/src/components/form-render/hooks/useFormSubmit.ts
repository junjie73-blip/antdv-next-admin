import type { ComputedRef } from 'vue';

import type { FormProps, Recordable } from '../../../types';

export interface UseFormSubmitOptions {
  /** 组件上的透传属性：`onFinish` 就是从这儿拿到父级监听器的 */
  attrs: Recordable;
  emitReset: (values: Recordable) => void;
  emitSubmit: (values: Recordable) => void;
  getFieldsValue: () => Recordable;
  getProps: ComputedRef<FormProps>;
  resetFields: () => Promise<void>;
  validate: () => Promise<Recordable>;
}

/**
 * 提交与重置的编排：优先级都是"**父级给的钩子优先，没有才自己干活**"。
 *
 * - 提交：`attrs.onFinish`（父级直接监听）> `props.submitFunc`（受控提交）> 抛 `submit` 事件。
 *   这个顺序不能换：`submitFunc` 存在的意义就是"我自己来提交，你别再抛事件"。
 * - 重置：`props.resetFunc` 存在就完全交给它，连默认重置都不做。
 *   否则先取一份重置前的值快照 —— `submitOnReset` 为真时要把**新值**（已清空的）
 *   交给提交，为假时把**旧值**报给 `reset` 事件，让调用方知道被清掉了什么。
 */
export function useFormSubmit(options: UseFormSubmitOptions) {
  const {
    attrs,
    emitReset,
    emitSubmit,
    getFieldsValue,
    getProps,
    resetFields,
    validate,
  } = options;

  async function handleSubmit() {
    try {
      const values = await validate();
      if (values) {
        if (typeof attrs.onFinish === 'function') {
          (attrs.onFinish as (v: Recordable) => void)(values);
        } else if (getProps.value.submitFunc) {
          await getProps.value.submitFunc();
        } else {
          emitSubmit(values);
        }
      }
    } catch (error) {
      console.error('Form submit error:', error);
    }
  }

  async function handleReset() {
    if (getProps.value.resetFunc) {
      await getProps.value.resetFunc();
      return;
    }
    const values = getFieldsValue();
    await resetFields();
    if (getProps.value.submitOnReset) {
      await handleSubmit();
    } else {
      emitReset(values);
    }
  }

  return { handleReset, handleSubmit };
}

export type UseFormSubmitReturn = ReturnType<typeof useFormSubmit>;
