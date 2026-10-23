import type { Ref } from 'vue';

import type { FormProps, FormValidateError, Recordable } from '../../../types';
import type { ErrorField } from '../helpers/validate';
import type { FormSchema, NamePath } from '../schema';
import type { TanstackForm } from './useFormModel';

import { unref } from 'vue';

import { buildValidateError, readErrorMessages } from '../helpers/validate';
import { formatDateFields, handleRangeValue } from '../utils';

export interface UseFormValidateOptions {
  /** 只挑点名字段（值来自 `useFormModel`） */
  collectValues: (nameList?: NamePath[]) => Recordable;
  form: TanstackForm;
  /** schema 里所有字段名，`validate()` 不带参数时的默认作用范围 */
  getAllFieldNames: () => string[];
  getProps: Ref<FormProps> | { value: FormProps };
  /** 表单根节点，`scrollToField` 从它往下找字段 */
  getRoot: () => HTMLElement | undefined;
  schemaRef: Ref<FormSchema[]>;
  /** 置为 true 之后，字段错误信息才会显示出来 */
  submitAttempted: Ref<boolean>;
}

/**
 * 校验：逐字段跑一遍 TanStack 的 `validateField`，再把结果汇总成 antd 形状的失败对象。
 *
 * 为什么不用 `form.validate()`：TanStack 的表单级校验只看它自己注册的 validators，
 * 而本包的规则挂在 schema 上，且 `nameList` 要能只校验部分字段。
 * 单字段 `validateField` 的 rejection 已经在内部写进 meta，这里忽略掉，
 * 统一从 meta 读错误来判定成败，避免"第一个失败就把整轮打断"。
 */
export function useFormValidate(options: UseFormValidateOptions) {
  const {
    collectValues,
    form,
    getAllFieldNames,
    getProps,
    getRoot,
    schemaRef,
    submitAttempted,
  } = options;

  async function scrollToField(
    name: NamePath,
    scrollOptions?: ScrollIntoViewOptions,
  ) {
    const el = getRoot()?.querySelector(
      `[data-field="${CSS.escape(String(name))}"]`,
    );
    el?.scrollIntoView?.(
      scrollOptions ?? { behavior: 'smooth', block: 'center' },
    );
  }

  async function validate(nameList?: NamePath[]): Promise<Recordable> {
    const schemas = unref(schemaRef) || [];
    const candidateFields =
      nameList && nameList.length > 0
        ? nameList.map(String)
        : getAllFieldNames();

    submitAttempted.value = true;

    await Promise.all(
      candidateFields.map(async (field) => {
        try {
          await form.validateField(field as any, 'submit');
        } catch {
          // validateField 内部已把错误写入 meta，这里忽略 rejection
        }
      }),
    );

    const errorFields: ErrorField[] = [];
    candidateFields.forEach((field) => {
      const meta = form.getFieldMeta(field as any);
      const unique = readErrorMessages(meta?.errors);
      if (unique.length > 0) {
        errorFields.push({ errors: unique, name: field });
      }
    });

    const values = collectValues(nameList);

    if (errorFields.length > 0) {
      if (getProps.value.scrollToFirstError !== false) {
        void scrollToField(errorFields[0]?.name ?? '');
      }
      const failure: FormValidateError = buildValidateError(
        errorFields,
        values,
      );
      throw failure;
    }

    const fieldMapToTime = getProps.value.fieldMapToTime;
    // 先拆区间再格式化：`handleRangeValue` 拿到的是控件原值（dayjs/Date），
    // 反过来会先出串再 `new Date(串)`，Safari 对 `'YYYY-MM-DD HH:mm:ss'` 不友好。
    const ranged = fieldMapToTime
      ? handleRangeValue(values, fieldMapToTime)
      : values;
    return formatDateFields(ranged, schemas);
  }

  /** 与 `validate` 同一个实现，留着是因为 antd 的对外 API 有这个名字 */
  async function validateFields(nameList?: NamePath[]): Promise<Recordable> {
    return validate(nameList);
  }

  return { scrollToField, validate, validateFields };
}

export type UseFormValidateReturn = ReturnType<typeof useFormValidate>;
