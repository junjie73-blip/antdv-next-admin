import type { Ref } from 'vue';

import type { FormSchema } from '../schema';

import { watch } from 'vue';

import { deepMerge } from '../utils';

export interface UseFormSchemaOptions {
  /** schema 换了一批之后的收尾（灌默认值） */
  onSchemasChanged: () => void;
  schemaRef: Ref<FormSchema[]>;
  /** 模板上声明式给的 `schemas`：单向输入，变化时整批替换 */
  sourceSchemas: () => FormSchema[] | undefined;
}

/**
 * schema 的命令式增删改（对外 API 的 `updateSchema` / `appendSchemaByField` /
 * `removeSchemaByField` 三条）。
 *
 * 三条都只动 `schemaRef`，不回写 `props.schemas`：模板上的声明式配置是单向输入，
 * 反向写会触发 `props.schemas` 的 watcher，把刚做的修改又被外部覆盖一次。
 */
export function useFormSchema(options: UseFormSchemaOptions) {
  const { onSchemasChanged, schemaRef, sourceSchemas } = options;

  // 去掉 deep: true，避免深层监听引起重复触发
  // 外部若需原地修改 schema，请改用 setProps / updateSchema
  watch(
    sourceSchemas,
    (schemas) => {
      if (schemas) {
        schemaRef.value = schemas;
        onSchemasChanged();
      }
    },
    { immediate: true },
  );

  async function updateSchema(
    data: Partial<FormSchema> | Partial<FormSchema>[],
  ) {
    const updateData = Array.isArray(data) ? data : [data];
    updateData.forEach((item) => {
      if (!item || !item.field) return;
      const index = schemaRef.value.findIndex(
        (s) => s && s.field === item.field,
      );
      if (index !== -1 && schemaRef.value[index]) {
        schemaRef.value[index] = deepMerge(
          schemaRef.value[index],
          item,
        ) as FormSchema;
      }
    });
  }

  async function removeSchemaByField(field: string | string[]) {
    const fields = Array.isArray(field) ? field : [field];
    schemaRef.value = schemaRef.value.filter(
      (s) => s && !fields.includes(s.field),
    );
  }

  async function appendSchemaByField(
    schema: FormSchema,
    prefixField?: string,
    first?: boolean,
  ) {
    if (!schema) return;
    if (prefixField) {
      const index = schemaRef.value.findIndex(
        (s) => s && s.field === prefixField,
      );
      if (index !== -1) {
        schemaRef.value.splice(first ? index : index + 1, 0, schema);
      }
    } else {
      if (first) schemaRef.value.unshift(schema);
      else schemaRef.value.push(schema);
    }
    onSchemasChanged();
  }

  return { appendSchemaByField, removeSchemaByField, updateSchema };
}

export type UseFormSchemaReturn = ReturnType<typeof useFormSchema>;
