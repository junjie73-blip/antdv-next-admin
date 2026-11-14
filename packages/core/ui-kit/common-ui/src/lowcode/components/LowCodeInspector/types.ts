/**
 * 属性面板的对外类型。
 *
 * 分层位置：`components/LowCodeInspector/`。单独放一个文件是因为 SFC 里只留默认导出最稳，
 * 而面板抛给宿主的事件载荷需要一个能被 `index.ts` 转出的名字。
 */

/**
 * 一次属性改动：`key` 是 `PropMeta.key`，`value` 是已经解释成 Schema 形状的值
 * （不是编辑器里的原始文本 —— JSON 已解析、空串已转 `undefined`）。
 * 面板**只抛不改**，回写 Schema 是宿主（设计器）的活。
 */
export interface InspectorChange {
  key: string;
  value: unknown;
}
