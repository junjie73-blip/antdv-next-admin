import { del, get, post, put } from "./request";

// ============================================================
// 菜单管理
// ============================================================

export function getMenuTree() {
  return get<any[]>("/menu/tree");
}

export function getMenuList(params?: Record<string, unknown>) {
  return get<{ list: any[]; total: number }>("/menu/list", params);
}

export function getMenuDetail(id: string) {
  return get<any>(`/menu/detail/${id}`);
}

export function getMenuButtons(parentId: string) {
  return get<any[]>("/menu/buttons", { parentId });
}

export function createMenu(data: Record<string, any>) {
  return post<any>("/menu", data);
}

export function updateMenu(id: string, data: Record<string, any>) {
  return put<any>(`/menu/${id}`, data);
}

export function deleteMenu(id: string) {
  return del<void>(`/menu/${id}`);
}

export function exportMenus() {
  return get<any>("/menu/export");
}
export function changeMenuStatus(id: string, status: string) {
  return put<any>(`/menu/${id}/status`, { status });
}
