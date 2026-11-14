/**
 * 大纲面板对外的事件载荷。
 *
 * 分层位置：`components/LowCodeOutline/`。`<script setup>` 里不能有具名导出，
 * 所以这些形状单独放一份，供宿主接线与 `index.ts` 转出。
 */

/** 上移 / 下移：面板只说「动哪个、往哪动」，怎么动（`dsl.shiftNode`）由宿主决定 */
export interface OutlineMovePayload {
  direction: 'down' | 'up';
  nodeId: string;
}

/**
 * 拖放落点。
 * `materialType` 与 `nodeId` 互斥：前者是从物料面板拖进来的新物料，后者是在树里挪已有节点。
 * `refId` 为 `undefined` 表示落在页面根级。
 */
export interface OutlineDropPayload {
  materialType?: string;
  nodeId?: string;
  position: 'after' | 'before' | 'inside';
  /** 落点参照节点；根级投放时省略 */
  refId?: string;
  /** 落点插槽：`children` 用 `'children'` 表达，与 `dsl` 的口径一致 */
  slot?: string;
}
