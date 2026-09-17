import type { MenuType } from "./types";

import { cn } from "@/utils/cn";

// ========== 样式类名 ==========
export const containerClassName = cn("space-y-4 h-full");
export const cardClassName = cn("shadow-sm");
export const tagClassName = cn("inline-flex items-center gap-1");

// ========== 菜单类型映射 ==========
export const MENU_TYPE_COLOR_MAP: Record<MenuType, string> = {
  1: "blue",
  2: "green",
  3: "orange",
};

export const MENU_TYPE_LABEL_MAP: Record<MenuType, string> = {
  1: "目录",
  2: "菜单",
  3: "按钮",
};

export const MENU_TYPE_ICON_MAP: Record<MenuType, string> = {
  1: "carbon:folder",
  2: "carbon:document",
  3: "carbon:cu3",
};

/** 菜单类型选项（表单用） */
export const MENU_TYPE_OPTIONS = [
  { label: "目录", value: 1 as MenuType },
  { label: "菜单", value: 2 as MenuType },
  { label: "按钮", value: 3 as MenuType },
];

// ========== 状态映射 ==========
export const MENU_STATUS_COLOR_MAP: Record<string, string> = {
  "1": "green",
  "0": "red",
};

export const MENU_STATUS_LABEL_MAP: Record<string, string> = {
  "1": "正常",
  "0": "停用",
};

export const MENU_STATUS_ICON_MAP: Record<string, string> = {
  "1": "carbon:checkmark-outline",
  "0": "carbon:close-outline",
};

// ========== useCRUD 表单联动校验规则 ==========
/**
 * 菜单表单的业务校验
 * 返回 false 表示校验不通过，会中断提交
 */
export function validateMenuForm(
  values: Partial<{
    menuName: string;
    menuType: number;
    path: string;
    component: string;
  }>,
): true | string {
  if (!values.menuName) return "请填写菜单名称";
  if (values.menuType === 2 && (!values.path || !values.component)) {
    return "菜单类型必须填写路由地址和组件路径";
  }
  return true;
}

export const MENU_EMPTY_VALUES = {
  parentId: undefined,
  menuType: 1,
  menuName: "",
  icon: "",
  path: "",
  component: "",
  permission: "",
  sortOrder: 0,
  status: "1",
};
