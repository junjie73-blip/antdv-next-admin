import type { VNode } from 'vue';

import type { BasicColumn, Recordable } from '../types';

import { h, isVNode } from 'vue';

import TableEditableCell from '../components/TableEditableCell.vue';
import TableImg from '../components/TableImg.vue';
import { formatCellValue, isImageList } from '../helper';

/** 可编辑单元格抛回的载荷（与 `TableEditableCell` 的 emit 形状一致） */
export interface CellEditPayload {
  column: BasicColumn;
  dataIndex: string | string[];
  record: Recordable;
  value: any;
}

/**
 * `resolveCellContent` 需要向外通知的三类编辑事件。
 *
 * 为什么要外面传进来而不是这里 `emit`：这个函数是**纯渲染逻辑**，
 * `emit` 只存在于组件 setup 作用域里。把它做成入参，BasicTable 里就只剩
 * `emit('cellSave', payload)` 一行，而这个函数可以脱离组件实例单测。
 */
export interface CellContentHandlers {
  onChange: (payload: CellEditPayload) => void;
  onCancel: (payload: Omit<CellEditPayload, 'value'>) => void;
  onSave: (payload: CellEditPayload) => void;
}

/**
 * 统一单元格渲染的优先级：`customRender` > `format` > 可编辑 > 图片 > 默认。
 *
 * 不处理 `cell-*` 插槽 —— 插槽在模板里优先拦截（模板先判 `$slots['cell-x']`，
 * 走到这里说明调用方没给插槽）。
 */
export function resolveCellContent(
  column: BasicColumn,
  text: any,
  record: Recordable,
  index: number,
  handlers: CellContentHandlers,
): number | string | VNode {
  // 1. customRender 完全接管
  if (column.customRender) {
    return column.customRender({ column, index, record, text });
  }

  // 2. format 既可以是字符串模板也可以是函数，返回值可能是 VNode
  if (column.format) {
    const formatted = formatCellValue(column.format, text, record, index);
    return isVNode(formatted)
      ? h('span', formatted)
      : h('span', { innerHTML: formatted });
  }

  // 3. 可编辑单元格（column.edit 单格可编辑 / column.editRow 整行可编辑）
  if (column.edit || column.editRow) {
    return h(TableEditableCell, {
      column,
      dataIndex: column.dataIndex,
      onChange: handlers.onChange,
      onCancel: handlers.onCancel,
      record,
      onSave: handlers.onSave,
      value: text,
    });
  }

  // 4. 值是图片数组时走缩略图组
  if (isImageList(text)) {
    return h(TableImg, { imgList: text, size: 40, simpleShow: true });
  }

  // 5. 默认：VNode 原样渲染，其余转字符串（`null`/`undefined` 要给空串，不能显示成 "null"）
  return isVNode(text) ? h(() => text) : h('span', text ?? '');
}
