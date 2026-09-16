import { http } from "@/utils";
import { del, get, post, put } from "./request";
import type { FetchParams } from "@/components/business/Table";

// ============================================================
// 通知公告
// ============================================================

export function getNoticeList(params?: FetchParams) {
  return get<{ list: any[]; total: number }>("/notice/list", params as any);
}

export function saveNotice(data: Record<string, any>) {
  return post<void>("/notice", data);
}

export function updateNotice(id: string, data: Record<string, any>) {
  return put<void>(`/notice/${id}`, data);
}

export function getNoticeDetail(id: string) {
  return get<any>(`/notice/detail/${id}`);
}

export function deleteNotice(id: string) {
  return del<void>(`/notice/remove/${id}`);
}

export function sendNotice(id: string) {
  return post<void>(`/notice/${id}/send`);
}

export function revokeNotice(id: string) {
  return post<void>(`/notice/${id}/revoke`);
}

export function exportNotices(params?: Record<string, unknown>) {
  return get<any>("/notice/export", params);
}

// ============================================================
// 我的消息
// ============================================================

export function getMyNoticeList(params?: Record<string, unknown>) {
  return get<{ list: any[]; total: number }>("/notice/my", params);
}

export function markNoticeRead(noticeId: string) {
  return put<void>(`/notice/${noticeId}/read`);
}

export function markAllNoticeRead(noticeIds?: string[]) {
  return put<void>("/notice/read-all", noticeIds ? { noticeIds } : {});
}

export function getNoticeUnreadCount() {
  return get<number>("/notice/unread-count");
}
