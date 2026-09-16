import * as XLSX from "xlsx";

export interface TemplateColumn {
  /** 列标题（Excel 表头） */
  header: string;
  /** 示例值（第二行，可选） */
  example?: string | number;
  /** 列宽（字符数） */
  width?: number;
  /** 列键名（Excel 表格中使用） */
  key?: string;
}

/**
 * 生成并下载 Excel 导入模板
 *
 * @param filename 文件名（不含扩展名）
 * @param columns  列定义
 * @param sheetName 工作表名
 *
 * @example
 * ```ts
 * generateTemplate("用户导入模板", [
 *   { header: "用户名*", example: "zhangsan", width: 16 },
 *   { header: "真实姓名*", example: "张三", width: 14 },
 *   { header: "邮箱", example: "zhangsan@example.com", width: 24 },
 * ]);
 * ```
 */
export function generateTemplate(
  filename: string,
  columns: TemplateColumn[],
  sheetName = "Sheet1",
): void {
  // 表头
  const headers = columns.map((c) => c.header);
  // 示例行（非必填也带示例，便于用户理解）
  const exampleRow = columns.map((c) => c.example ?? "");

  const aoa = [headers, exampleRow];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // 设置列宽
  ws["!cols"] = columns.map((c) => ({ wch: c.width ?? 18 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  XLSX.writeFile(wb, `${filename}.xlsx`);
}
