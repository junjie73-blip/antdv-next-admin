import type { ActionItem } from '~/components/business/Table';

import { isFunction } from 'es-toolkit';

export interface CrudActionOptions<T> {
  onEdit?: (record: T) => void;
  onDelete?: (record: T) => Promise<void> | void;
  onView?: (record: T) => void;
  extra?: (record: T) => ActionItem[];
  deleteTitle?: string;
  deleteContent?: (record: T) => string;
  deleteLabel?: string;
}

export function createCrudActions<T extends Record<string, unknown>>(
  record: T,
  options: CrudActionOptions<T>,
  permissions?: Record<string, string | string[]>,
): ActionItem[] {
  const {
    onEdit,
    onDelete,
    onView,
    extra,
    deleteTitle = '确认删除',
    deleteContent,
    deleteLabel = '删除',
  } = options;

  const actions: ActionItem[] = [];

  if (isFunction(onView)) {
    actions.push({
      label: '查看',
      icon: 'ant-design:eye-outlined',
      auth: permissions?.detail,
      onClick: () => onView(record),
    });
  }

  if (isFunction(onEdit)) {
    actions.push({
      label: '编辑',
      icon: 'ant-design:edit-outlined',
      auth: permissions?.update,
      onClick: () => onEdit(record),
    });
  }

  if (isFunction(extra)) {
    actions.push(...extra(record));
  }

  if (isFunction(onDelete)) {
    actions.push({
      label: deleteLabel,
      icon: 'ant-design:delete-outlined',
      auth: permissions?.delete,
      danger: true,
      popConfirm: {
        title: deleteTitle,
        content: isFunction(deleteContent) ? deleteContent(record) : undefined,
        confirm: () => onDelete(record),
      },
    });
  }

  return actions;
}
