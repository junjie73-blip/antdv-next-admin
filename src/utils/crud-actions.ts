import type { ActionItem } from "@/components/business/Table";

export interface CrudActionOptions<T> {
  onEdit?: (record: T) => void;
  onDelete?: (record: T) => void | Promise<void>;
  onView?: (record: T) => void;
  /** 额外操作（会拼在编辑之后、删除之前） */
  extra?: (record: T) => ActionItem[];
  /** 删除确认标题 */
  deleteTitle?: string;
  /** 删除确认内容（record 由函数提供） */
  deleteContent?: (record: T) => string;
  /** 删除按钮文案 */
  deleteLabel?: string;
}

/**
 * 生成通用的 CRUD 行操作项
 */
export function createCrudActions<T extends Record<string, any>>(
  record: T,
  options: CrudActionOptions<T>,
): ActionItem[] {
  const {
    onEdit,
    onDelete,
    onView,
    extra,
    deleteTitle = "确认删除",
    deleteContent,
    deleteLabel = "删除",
  } = options;

  const actions: ActionItem[] = [];

  if (onView) {
    actions.push({
      label: "查看",
      icon: "ant-design:eye-outlined",
      onClick: () => onView(record),
    });
  }

  if (onEdit) {
    actions.push({
      label: "编辑",
      icon: "ant-design:edit-outlined",
      onClick: () => onEdit(record),
    });
  }

  if (extra) {
    actions.push(...extra(record));
  }

  if (onDelete) {
    actions.push({
      label: deleteLabel,
      icon: "ant-design:delete-outlined",
      danger: true,
      popConfirm: {
        title: deleteTitle,
        content: deleteContent?.(record),
        confirm: () => onDelete(record),
      },
    });
  }

  return actions;
}
