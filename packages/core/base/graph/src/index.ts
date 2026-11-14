/**
 * `@antdv/graph` —— 五个企业模块共用的图内核。
 *
 * 边界很窄，只有三件事：顶点的形状与索引（`dag`）、结构体检与拓扑（`dag`）、
 * 条件表达式（`expression`）。**节点语义不在这里** ——
 * 「审批节点怎么加签」「LLM 节点怎么流式输出」属于各自的模块包，
 * 否则 graph 会变成两个模块互相牵制的汇聚点。
 *
 * 本包不 import vue、没有 .vue 模板，因此不登记 `@source`（Tailwind 内容扫描对它无意义）。
 */
export * from './dag';
export * from './expression';
export * from './id';
export * from './types';
