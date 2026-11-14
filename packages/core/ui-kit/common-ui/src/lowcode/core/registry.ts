import type {
  ComponentMeta,
  MaterialComponent,
  MaterialEntry,
  NodeId,
  NodeSchema,
  PropMeta,
} from './types';

import { createNodeId, NODE_ID_PREFIX } from './dsl';

/**
 * 组件物料注册表：type -> （组件对象 + 元数据）。
 *
 * 分层位置：`core/`，纯 TS。这里**不 import vue**：组件对象只以 `MaterialComponent`
 * （一个对象）的形状存在，`markRaw` 由预设层与组件层负责（它们本来就认识 vue）。
 *
 * 设计口径：
 * - 组件与元数据**成对登记**，避免出现「能渲染但面板里没属性」的半截物料；
 * - 查不到 type 时返回 `undefined` 而不是抛错：渲染层要降级成可诊断占位，
 *   体检层（`dsl.validatePageSchema`）负责把同一件事报成 `unknown-type`，两边不重复崩；
 * - 同 type 重复登记按后到者胜：宿主常用它覆盖内置物料（换成自己的按钮实现）。
 */

/** 物料面板的兜底分组名 */
export const DEFAULT_MATERIAL_GROUP = '未分组';

export interface MaterialGroup {
  group: string;
  items: MaterialEntry[];
}

export interface ComponentRegistry {
  /** 取组件对象；未知 type 返回 `undefined`，由调用方决定降级形态 */
  get: (type: string) => MaterialComponent | undefined;
  /** 自定义占位组件（宿主可换成自己的「物料缺失」卡片）；没配则 `undefined` */
  getFallback: () => MaterialComponent | undefined;
  getMeta: (type: string) => ComponentMeta | undefined;
  has: (type: string) => boolean;
  /** 按登记顺序列出全部条目 */
  list: () => MaterialEntry[];
  /** 按 `meta.group` 分组：组名按首次出现顺序、组内按登记顺序，面板直接照此渲染 */
  listByGroup: () => MaterialGroup[];
  register: (entry: MaterialEntry) => void;
  registerAll: (entries: Iterable<MaterialEntry>) => void;
  setFallback: (component: MaterialComponent | undefined) => void;
  types: () => string[];
  unregister: (type: string) => boolean;
}

export class LowCodeRegistryError extends Error {
  readonly code: 'invalid-entry';

  constructor(message: string) {
    super(message);
    this.code = 'invalid-entry';
    this.name = 'LowCodeRegistryError';
  }
}

/** 元数据补齐：面板与体检都假定 `props` 是数组，缺了在这里补，而不是到处判空 */
function normalizeMeta(meta: ComponentMeta): ComponentMeta {
  return { ...meta, props: Array.isArray(meta.props) ? meta.props : [] };
}

export interface RegistryOptions {
  /** 未知 type 的占位组件；不传则由渲染器用内置占位 */
  fallback?: MaterialComponent;
}

export function createComponentRegistry(
  entries: Iterable<MaterialEntry> = [],
  options: RegistryOptions = {},
): ComponentRegistry {
  const byType = new Map<string, MaterialEntry>();
  // 登记顺序单独存一份：Map 删除后重排会让面板顺序跳动，设计器里这属于「莫名抖一下」的坏体验
  const order: string[] = [];
  let fallback = options.fallback;

  const snapshot = (): MaterialEntry[] =>
    order.map((type) => byType.get(type)!);

  const register = (entry: MaterialEntry) => {
    const meta = entry?.meta;
    if (!meta || typeof meta.type !== 'string' || meta.type.trim() === '') {
      throw new LowCodeRegistryError(
        `物料条目缺少合法的 meta.type（收到 ${JSON.stringify(meta?.type ?? null)}）`,
      );
    }
    if (!entry.component)
      throw new LowCodeRegistryError(`物料「${meta.type}」没有组件对象`);
    const existed = byType.has(meta.type);
    byType.set(meta.type, {
      component: entry.component,
      meta: normalizeMeta(meta),
    });
    if (!existed) order.push(meta.type);
  };

  for (const entry of entries) register(entry);

  return {
    get: (type) => byType.get(type)?.component,
    getFallback: () => fallback,
    getMeta: (type) => byType.get(type)?.meta,
    has: (type) => byType.has(type),
    list: snapshot,
    listByGroup: () => {
      const groups: MaterialGroup[] = [];
      const buckets = new Map<string, MaterialGroup>();
      for (const entry of snapshot()) {
        const name = entry.meta.group?.trim() || DEFAULT_MATERIAL_GROUP;
        let bucket = buckets.get(name);
        if (!bucket) {
          bucket = { group: name, items: [] };
          buckets.set(name, bucket);
          groups.push(bucket);
        }
        bucket.items.push(entry);
      }
      return groups;
    },
    register,
    registerAll: (items) => {
      for (const item of items) register(item);
    },
    setFallback: (component) => {
      fallback = component;
    },
    types: () => [...order],
    unregister: (type) => {
      const hit = byType.delete(type);
      const at = order.indexOf(type);
      if (at !== -1) order.splice(at, 1);
      return hit;
    },
  };
}

/* ------------------------------ 元数据展开 ------------------------------ */

/**
 * 由 `ComponentMeta.props` 的 `default` 拼出新实例的初值。
 * `initialProps` 优先级更高：物料作者常常想给一组成套的默认值（卡片的标题 + 描述）。
 */
export function initialPropsOf(meta: ComponentMeta): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const prop of meta.props) {
    if (prop.default !== undefined) out[prop.key] = prop.default;
  }
  return { ...out, ...meta.initialProps };
}

/** 属性面板按 key 找元数据；找不到返回 `undefined`，调用方据此跳过该字段 */
export function propMetaOf(
  meta: ComponentMeta | undefined,
  key: string,
): PropMeta | undefined {
  return meta?.props.find((item) => item.key === key);
}

/**
 * 面板里点一下物料要落进树的那个节点。
 * id 在这里生成，保证「一次点击一个 id」；不写 `children: []` ——
 * 本包统一口径是「空列表不落地」（见 `dsl.pruneKeys`），免得体检和 diff 两套真相。
 */
export function createMaterialNode(
  entry: MaterialEntry,
  options: {
    id?: NodeId;
    idFactory?: (prefix: string) => NodeId;
    props?: Record<string, unknown>;
  } = {},
): NodeSchema {
  const props = { ...initialPropsOf(entry.meta), ...options.props };
  // 前缀也交出去：自定义 idFactory 的宿主（设计器要按物料类型发号）才接得住这个参数
  const node: NodeSchema = {
    id: options.id ?? (options.idFactory ?? createNodeId)(NODE_ID_PREFIX),
    type: entry.meta.type,
  };
  if (Object.keys(props).length > 0) node.props = props;
  return node;
}
