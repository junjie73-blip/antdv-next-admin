import { http } from "@/utils";
import { del, get, post, put } from "./request";

// ============================================================
// 字典类型
// ============================================================

export function getDictList(params?: Record<string, unknown>) {
  return get<{ list: any[]; total: number }>("/dict-type/list", params);
}

export function getDictTypeDetail(id: string) {
  return get<any>(`/dict-type/${id}`);
}

export function addDict(data: Record<string, any>) {
  return post<any>("/dict-type", data);
}

export function updateDict(id: string, data: Record<string, any>) {
  return put<any>(`/dict-type/${id}`, data);
}

export function deleteDict(id: string) {
  return del<void>(`/dict-type/${id}`);
}

export function batchRemoveDictType(ids: string[]) {
  return http.Post("/dict-type/batch-remove", { ids });
}

// ============================================================
// 字典数据
// ============================================================

export function getDictItems(params?: Record<string, unknown>) {
  return get<{ list: any[]; total: number }>("/dict-data/list", params);
}

export function getDictDataDetail(id: string) {
  return get<any>(`/dict-data/${id}`);
}

export function getDictDataByCode(code: string, dictTypeId?: string) {
  return get<any[]>(`/dict-data/by-code/${code}`, dictTypeId ? { dictTypeId } : undefined);
}

export function addDictItem(data: Record<string, any>) {
  return post<any>("/dict-data", data);
}

export function updateDictItem(id: string, data: Record<string, any>) {
  return put<any>(`/dict-data/${id}`, data);
}

export function deleteDictItem(id: string) {
  return del<void>(`/dict-data/${id}`);
}

export function batchRemoveDictData(ids: string[]) {
  return http.Post("/dict-data/batch-remove", { ids });
}

export function getDictTree(params?: Record<string, unknown>) {
  return get<any[]>("/dict-data/code/tree", params);
}
