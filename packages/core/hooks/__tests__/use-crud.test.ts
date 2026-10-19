import type { FormActionType } from '@antdv/form-ui';
import type { TableActionType } from '@antdv/table-ui';
import type { ModalMethods } from '@antdv/popup-ui';

import { ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCRUD } from '../src/use-crud';

/**
 * `useCRUD` 是「表格增删改查」示例页（`views/components/table/crud`）的骨架，
 * 它把后台页面里最容易被抄错的一条序列收敛住了：
 * 校验 → 清洗空字段 → 按 `isEditing` 选 create/update → 提示 → 关窗 → 刷新表格。
 *
 * 用例围着"抄漏了会静默坏掉"的分支写，而不是把每个 if 都覆盖一遍：
 * - 保存失败不能顺手关窗（用户填的半张表单没了，比报错更糟）；
 * - 编辑要拿详情而不是行数据回填（列表接口常裁字段，回填成空再提交就等于删数据）；
 * - 批量删除的确认框里那条 `onOk` 必须自带 catch —— 它的 reject 到不了外层 try，
 *   漏了就是"点了删除没反应"；
 * - 未选中、未配置 API 这些边界要给提示，不能静默 return。
 */

const { confirms, notifies } = vi.hoisted(() => ({
  /** `confirm` 的入参：用例自己调 `onOk` / `onCancel`，因为确认框是非阻塞的 */
  confirms: [] as Array<{
    content?: unknown;
    onCancel?: () => void;
    onOk?: () => Promise<void> | void;
    title?: unknown;
  }>,
  notifies: [] as Array<{ text: string; type: string }>,
}));

vi.mock('@antdv/popup-ui', () => ({
  /** `confirm` 在这里只当"被请求过一次"的记录器用，用例自己调 `onOk` / `onCancel` */
  confirm: (options: (typeof confirms)[number]) => {
    confirms.push(options);
    return Promise.resolve(false);
  },
  message: {
    error: (text: string) => notifies.push({ text, type: 'error' }),
    info: (text: string) => notifies.push({ text, type: 'info' }),
    success: (text: string) => notifies.push({ text, type: 'success' }),
    warning: (text: string) => notifies.push({ text, type: 'warning' }),
  },
}));

interface Row {
  id: number;
  name: string;
  remark?: string;
}

/** 表单值：新增时只填了一部分字段，所以是 `Partial<Row>`（示例页同理） */
type Values = Partial<Row>;

interface Harness {
  calls: string[];
  crud: ReturnType<typeof useCRUD<Row, Values>>;
  form: Record<
    'clearValidate' | 'resetFields' | 'setFieldsValue' | 'validate',
    ReturnType<typeof vi.fn>
  >;
  getSelectRows: ReturnType<typeof vi.fn>;
  modal: Record<'closeModal' | 'openModal', ReturnType<typeof vi.fn>>;
  reload: ReturnType<typeof vi.fn>;
}

/**
 * 三个依赖组件（Modal / Form / Table）都用最小替身：
 * `useCRUD` 只依赖那几个方法名，替身按方法名记调用顺序，
 * 于是"先 resetFields 再 setFieldsValue"这类**顺序**要求也能被断言住
 * （顺序错了的表现就是弹窗打开时闪一下上一个人的数据）。
 */
function createHarness(
  options: {
    getEmptyValues?: () => Values;
    messages?: Record<string, string>;
    onCreate?: (values: Values) => Promise<unknown>;
    onFetchDetail?: (id: string) => Promise<Row>;
    onUpdate?: (id: string, values: Values) => Promise<unknown>;
    onDelete?: (record: Row) => Promise<unknown>;
    onBatchDelete?: (records: Row[]) => Promise<unknown>;
    beforeCreate?: (values: Values) => boolean;
    beforeDelete?: (record: Row) => boolean;
    onSaved?: (isEdit: boolean, values: Values) => void;
    selectedRows?: Row[];
    tableMethods?: { value: null | TableActionType };
  } = {},
): Harness {
  const calls: string[] = [];

  const form = {
    clearValidate: vi.fn(async () => {
      calls.push('clearValidate');
    }),
    resetFields: vi.fn(async () => {
      calls.push('resetFields');
    }),
    setFieldsValue: vi.fn(async (values: unknown) => {
      calls.push('setFieldsValue', `set:${JSON.stringify(values)}`);
    }),
    // 默认给一份"能过校验"的值，个别用例再改成 reject / 空串
    validate: vi.fn(async () => ({ name: '甲' })),
  };

  const modal = {
    closeModal: vi.fn(async () => {
      calls.push('closeModal');
    }),
    openModal: vi.fn(async () => {
      calls.push('openModal');
    }),
  };

  const reload = vi.fn(() => {
    calls.push('reload');
  });
  const getSelectRows = vi.fn(() => options.selectedRows ?? []);
  const tableMethods =
    options.tableMethods ??
    ({
      value: { getSelectRows, reload } as unknown as TableActionType,
    } as { value: null | TableActionType });

  const crud = useCRUD<Row, Values>({
    containerType: 'modal',
    formMethods: form as unknown as Pick<
      FormActionType,
      'clearValidate' | 'resetFields' | 'setFieldsValue' | 'validate'
    >,
    modalMethods: modal as unknown as Pick<
      ModalMethods,
      'closeModal' | 'openModal'
    >,
    tableMethods,
    ...options,
  });

  return { calls, crud, form, getSelectRows, modal, reload };
}

beforeEach(() => {
  confirms.length = 0;
  notifies.length = 0;
});

describe('useCRUD —— 保存', () => {
  it('新增：清洗空字符串字段、调 onCreate、提示、关窗并刷新表格', async () => {
    const onCreate = vi.fn(async (values: Values) => values);
    const harness = createHarness({
      getEmptyValues: () => ({ name: '' }),
      onCreate,
    });

    await harness.crud.handleAdd();
    await vi.waitFor(() =>
      expect(
        harness.calls.filter((item) => item.startsWith('set:')),
      ).not.toEqual([]),
    );

    // `remark: ''` 必须被删掉：空串提交上去，后端会把可选字段整个覆盖成空
    harness.form.validate.mockResolvedValue({ name: '甲', remark: '' });
    await harness.crud.handleSave();

    expect(onCreate).toHaveBeenCalledWith({ name: '甲' });
    expect(notifies).toEqual([{ text: '创建成功', type: 'success' }]);
    expect(harness.modal.closeModal).toHaveBeenCalled();
    expect(harness.reload).toHaveBeenCalled();
    expect(harness.crud.isEditing.value).toBe(false);
  });

  it('编辑：走 onUpdate 并带上主键，编辑态由 isEditing 持有', async () => {
    const onUpdate = vi.fn(async (_id: string, values: Values) => values);
    const harness = createHarness({ onUpdate });

    await harness.crud.handleEdit({ id: 7, name: '乙' });
    expect(harness.crud.isEditing.value).toBe(true);
    expect(harness.crud.currentRecord.value?.id).toBe(7);

    await harness.crud.handleSave();
    expect(onUpdate).toHaveBeenCalledWith(7, { name: '甲' });
    expect(notifies.map((item) => item.text)).toContain('更新成功');
    // 编辑保存成功后不该再是编辑态以外的状态
    expect(harness.crud.isEditing.value).toBe(true);
  });

  it('有详情接口时，回填表单用的是详情而不是行数据', async () => {
    const detail = { id: 7, name: '乙', remark: '完整备注' };
    const onFetchDetail = vi.fn(async () => detail);
    const harness = createHarness({ onFetchDetail });

    // 行数据被列表接口裁掉了 remark：拿它回填再提交，备注就没了
    await harness.crud.handleEdit({ id: 7, name: '乙' });
    await vi.waitFor(() =>
      expect(harness.form.setFieldsValue).toHaveBeenCalled(),
    );

    expect(onFetchDetail).toHaveBeenCalledWith(7);
    expect(harness.form.setFieldsValue).toHaveBeenLastCalledWith(detail);
    expect(harness.crud.currentRecord.value).toEqual(detail);
  });

  it('详情接口挂了不阻塞编辑：降级用行数据回填', async () => {
    const harness = createHarness({
      onFetchDetail: (async () => {
        throw new Error('详情 500');
      }) as (id: string) => Promise<Row>,
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await harness.crud.handleEdit({ id: 7, name: '乙' });
    await vi.waitFor(() =>
      expect(harness.form.setFieldsValue).toHaveBeenCalled(),
    );

    expect(harness.form.setFieldsValue).toHaveBeenLastCalledWith({
      id: 7,
      name: '乙',
    });
    expect(harness.modal.openModal).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('校验不通过时不提交、不关窗', async () => {
    const onCreate = vi.fn();
    const harness = createHarness({ onCreate });
    harness.form.validate.mockRejectedValue(new Error('必填项未填'));

    await harness.crud.handleSave();

    expect(onCreate).not.toHaveBeenCalled();
    expect(harness.modal.closeModal).not.toHaveBeenCalled();
    expect(harness.reload).not.toHaveBeenCalled();
    expect(notifies).toEqual([{ text: '必填项未填', type: 'error' }]);
  });

  it('接口报错时保留弹窗：用户填的半张表单不能被一次失败吞掉', async () => {
    const harness = createHarness({
      onCreate: async () => {
        throw new Error('名称重复');
      },
    });

    await harness.crud.handleSave();

    expect(notifies).toEqual([{ text: '名称重复', type: 'error' }]);
    expect(harness.modal.closeModal).not.toHaveBeenCalled();
    expect(harness.reload).not.toHaveBeenCalled();
    expect(harness.crud.loading.value).toBe(false);
  });

  it('没配 onCreate / onUpdate 时报错而不是静默成功', async () => {
    const harness = createHarness();
    await harness.crud.handleSave();
    expect(notifies).toEqual([{ text: '未配置创建 API', type: 'error' }]);

    await harness.crud.handleEdit({ id: 1, name: '甲' });
    await harness.crud.handleSave();
    expect(notifies[notifies.length - 1]).toEqual({
      text: '未配置更新 API',
      type: 'error',
    });
  });

  it('beforeCreate 返回 false 时整条新增流程不启动', async () => {
    const harness = createHarness({ beforeCreate: () => false });
    await harness.crud.handleAdd();

    expect(harness.modal.openModal).not.toHaveBeenCalled();
    expect(harness.crud.isEditing.value).toBe(false);
  });

  it('自定义文案与保存后回调都生效：messages 覆盖默认提示、onSaved 收到编辑态', async () => {
    const onSaved = vi.fn();
    const harness = createHarness({
      messages: { createSuccess: '已入库' },
      onSaved,
      onCreate: async (values: Values) => values,
    });

    await harness.crud.handleSave();
    expect(notifies).toEqual([{ text: '已入库', type: 'success' }]);
    expect(onSaved).toHaveBeenCalledWith(false, { name: '甲' });
  });
});

describe('useCRUD —— 删除', () => {
  it('单条删除：调接口、提示、刷新表格', async () => {
    const onDelete = vi.fn(async () => null);
    const harness = createHarness({ onDelete });

    await harness.crud.handleDelete({ id: 3, name: '丙' });
    expect(onDelete).toHaveBeenCalledWith({ id: 3, name: '丙' });
    expect(notifies).toEqual([{ text: '删除成功', type: 'success' }]);
    expect(harness.reload).toHaveBeenCalled();
  });

  it('删除失败：给错误提示且不刷新', async () => {
    const harness = createHarness({
      onDelete: async () => {
        throw new Error('已被引用');
      },
    });

    await harness.crud.handleDelete({ id: 3, name: '丙' });
    expect(notifies).toEqual([{ text: '已被引用', type: 'error' }]);
    expect(harness.reload).not.toHaveBeenCalled();
  });

  it('beforeDelete 能否决删除', async () => {
    const onDelete = vi.fn();
    const harness = createHarness({ beforeDelete: () => false, onDelete });

    await harness.crud.handleDelete({ id: 3, name: '丙' });
    expect(onDelete).not.toHaveBeenCalled();
    expect(notifies).toEqual([]);
  });

  it('批量删除：确认后才动手，未配置 onBatchDelete 时逐条并发', async () => {
    const onDelete = vi.fn(async (record: Row) => record);
    const harness = createHarness({ onDelete });

    await harness.crud.handleBatchDelete([
      { id: 1, name: '甲' },
      { id: 2, name: '乙' },
    ]);

    expect(confirms).toHaveLength(1);
    expect(onDelete).not.toHaveBeenCalled();

    await confirms[0]!.onOk?.();
    expect(onDelete).toHaveBeenCalledTimes(2);
    expect(harness.reload).toHaveBeenCalled();
    expect(notifies.map((item) => item.text)).toContain('批量删除成功（2 条）');
  });

  it('确认文案带上实际条数，不传参时向表格要选中行', async () => {
    const harness = createHarness({
      messages: { batchDeleteConfirm: '确定删除选中行吗？' },
      onDelete: async () => null,
      selectedRows: [{ id: 5, name: '戊' }],
    });

    await harness.crud.handleBatchDelete();
    expect(harness.getSelectRows).toHaveBeenCalled();
    expect(confirms[0]?.content).toBe('确定删除选中行吗？（1 条）');
  });

  it('批量删除没选中时只给提示，不弹确认框', async () => {
    const onDelete = vi.fn();
    const harness = createHarness({ onDelete });

    await harness.crud.handleBatchDelete();
    expect(notifies).toEqual([
      { text: '请先选择要删除的数据', type: 'warning' },
    ]);
    expect(confirms).toEqual([]);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('批量删除里 onOk 的失败要报出来：它的 reject 到不了外层 try', async () => {
    const harness = createHarness({
      onDelete: async () => {
        throw new Error('只读数据');
      },
    });

    await harness.crud.handleBatchDelete([{ id: 1, name: '甲' }]);
    await confirms[0]!.onOk?.();

    expect(notifies).toEqual([{ text: '只读数据', type: 'error' }]);
    expect(harness.reload).not.toHaveBeenCalled();
    expect(harness.crud.loading.value).toBe(false);
  });

  it('批量删除未配置任何删除 API：确认框里报错而不是静默', async () => {
    const harness = createHarness();
    await harness.crud.handleBatchDelete([{ id: 1, name: '甲' }]);
    await confirms[0]!.onOk?.();

    expect(notifies).toEqual([{ text: '未配置删除 API', type: 'error' }]);
  });

  it('取消确认框：不删除，并把 loading 收回去', async () => {
    const onDelete = vi.fn();
    const harness = createHarness({ onDelete });

    await harness.crud.handleBatchDelete([{ id: 1, name: '甲' }]);
    confirms[0]!.onCancel?.();

    expect(onDelete).not.toHaveBeenCalled();
    expect(harness.crud.loading.value).toBe(false);
    expect(notifies).toEqual([]);
  });

  it('beforeDelete 命中任一行就中断整批', async () => {
    const onDelete = vi.fn();
    const harness = createHarness({
      beforeDelete: (record: Row) => record.id !== 2,
      onDelete,
    });

    await harness.crud.handleBatchDelete([
      { id: 1, name: '甲' },
      { id: 2, name: '乙' },
    ]);

    expect(confirms).toEqual([]);
    expect(onDelete).not.toHaveBeenCalled();
  });
});

describe('useCRUD —— 容器与状态', () => {
  it('新增：开容器 → 复位表单 → 灌入空值与初值（初值覆盖空值）', async () => {
    const harness = createHarness({
      getEmptyValues: () => ({ name: '默认名' }),
    });

    await harness.crud.handleAdd({ name: '带过去的初值' });
    await vi.waitFor(() =>
      expect(harness.form.setFieldsValue).toHaveBeenCalled(),
    );

    expect(harness.modal.openModal).toHaveBeenCalled();
    expect(harness.form.setFieldsValue).toHaveBeenCalledWith({
      name: '带过去的初值',
    });
    expect(harness.crud.currentRecord.value).toBeNull();
    // 复位在填值之前：反过来的话新默认值会被 reset 抹掉
    expect(harness.calls.indexOf('resetFields')).toBeLessThan(
      harness.calls.findIndex((item) => item.startsWith('set:')),
    );
  });

  it('drawer 容器：走 openDrawer / closeDrawer 而不是 modal', async () => {
    const openDrawer = vi.fn(async () => undefined);
    const closeDrawer = vi.fn(async () => undefined);
    const harness = createHarness({
      onCreate: async (values: Values) => values,
    });

    const drawerCrud = useCRUD<Row, Values>({
      containerType: 'drawer',
      drawerMethods: { closeDrawer, openDrawer } as never,
      formMethods: harness.form as never,
      onCreate: async (values: Values) => values,
    });

    await drawerCrud.handleAdd();
    expect(openDrawer).toHaveBeenCalled();

    await drawerCrud.handleSave();
    expect(closeDrawer).toHaveBeenCalled();
  });

  it('表格实例还没挂上（ref 为 null）时刷新不炸', async () => {
    const harness = createHarness({
      onDelete: async () => null,
      tableMethods: ref(null) as unknown as { value: null | TableActionType },
    });

    await harness.crud.handleDelete({ id: 1, name: '甲' });
    expect(notifies.map((item) => item.text)).toContain('删除成功');
  });

  it('reset 把编辑态、当前行与 loading 一并清掉（换页 / 换账号时用）', async () => {
    const harness = createHarness();
    await harness.crud.handleEdit({ id: 9, name: '己' });
    expect(harness.crud.isEditing.value).toBe(true);

    harness.crud.reset();
    expect(harness.crud.isEditing.value).toBe(false);
    expect(harness.crud.currentRecord.value).toBeNull();
    expect(harness.crud.loading.value).toBe(false);
  });
});
