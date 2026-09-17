
import * as XLSX from "xlsx";

import { USER_EXPORT_HEADERS, USER_EXPORT_SHEET_NAME, USER_STATUS_LABEL_MAP } from "./constants";

import type { DeptTreeNode, FlatDeptNode, UserRecord } from "./types";

import { usePrint } from "@/utils/print";

/**
 * 转换后端部门树为前端展示结构
 */
export function convertDeptTree(nodes: any[]): DeptTreeNode[] {
  return nodes.map((node) => {
    const item: DeptTreeNode = {
      deptId: node.deptId,
      deptName: node.deptName,
    };
    if (node.children?.length) {
      item.children = convertDeptTree(node.children);
    }
    return item;
  });
}

/**
 * 扁平化部门树
 */
export function flattenDeptTree(nodes: DeptTreeNode[]): FlatDeptNode[] {
  const result: FlatDeptNode[] = [];
  function walk(items: DeptTreeNode[]) {
    for (const item of items) {
      result.push({ deptId: item.deptId, deptName: item.deptName });
      if (item.children?.length) walk(item.children);
    }
  }
  walk(nodes);
  return result;
}

/**
 * 获取用户角色名（逗号分隔）
 */
export function getUserRoleNames(record: UserRecord): string {
  return record.roles?.map((r) => r.roleName).join(",") || "-";
}

/**
 * 导出选中用户为 Excel
 */
export function exportUsers(records: UserRecord[]) {
  const rows = records.map((i) => [
    i.username,
    i.realName,
    i.email,
    i.phone,
    i.deptName || "",
    i.roles?.map((r) => r.roleName).join(",") || "",
    USER_STATUS_LABEL_MAP[i.status] || i.status,
  ]);
  const ws = XLSX.utils.aoa_to_sheet([USER_EXPORT_HEADERS, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, USER_EXPORT_SHEET_NAME);
  XLSX.writeFile(wb, `${USER_EXPORT_SHEET_NAME}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * 打印用户列表
 */
export function printUserList() {
  usePrint({ title: "用户列表", target: ".ant-card-body" });
}
