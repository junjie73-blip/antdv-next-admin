<script setup lang="ts">
import type { NormalTreeNode, TreeContext, TreeFieldNames, TreeKey } from './types';

import { computed, ref } from 'vue';

import TreeNodes from './TreeNodes.vue';
import { treeKey } from './types';

defineOptions({ name: 'Tree' });

const props = withDefaults(
  defineProps<{
    blockNode?: boolean;
    checkable?: boolean;
    checkedKeys?: TreeKey[];
    defaultCheckedKeys?: TreeKey[];
    defaultExpandAll?: boolean;
    defaultExpandedKeys?: TreeKey[];
    defaultSelectedKeys?: TreeKey[];
    expandedKeys?: TreeKey[];
    fieldNames?: TreeFieldNames;
    selectable?: boolean;
    selectedKeys?: TreeKey[];
    treeData?: Record<string, any>[];
  }>(),
  {
    blockNode: false,
    checkable: false,
    checkedKeys: undefined,
    defaultCheckedKeys: () => [],
    defaultExpandAll: false,
    defaultExpandedKeys: () => [],
    defaultSelectedKeys: () => [],
    expandedKeys: undefined,
    fieldNames: undefined,
    selectable: true,
    selectedKeys: undefined,
    treeData: () => [],
  },
);

const emit = defineEmits<{
  check: [TreeKey[], { checkedNodes: Record<string, any>[] }];
  expand: [TreeKey[]];
  select: [TreeKey[], { node: Record<string, any>; selected: boolean }];
  'update:checkedKeys': [TreeKey[]];
  'update:expandedKeys': [TreeKey[]];
  'update:selectedKeys': [TreeKey[]];
}>();

const fields = computed(() => ({
  children: props.fieldNames?.children ?? 'children',
  key: props.fieldNames?.key ?? 'key',
  title: props.fieldNames?.title ?? 'title',
}));

function normalize(list: Record<string, any>[] | undefined, path: string) {
  return (list ?? []).map((data, index): NormalTreeNode => {
    const nodePath = `${path}-${index}`;
    const children = normalize(
      data[fields.value.children] as Record<string, any>[] | undefined,
      nodePath,
    );
    return {
      children,
      data,
      disabled: Boolean(data.disabled),
      hasChildren: children.length > 0,
      key: (data[fields.value.key] ?? nodePath) as TreeKey,
      title: String(data[fields.value.title] ?? ''),
    };
  });
}

const roots = computed(() => normalize(props.treeData, 'n'));

function parentKeys(nodes: NormalTreeNode[], out: TreeKey[] = []) {
  for (const node of nodes) {
    if (node.hasChildren) {
      out.push(node.key);
      parentKeys(node.children, out);
    }
  }
  return out;
}

/** null = 还没人手动开合过，跟随 `defaultExpandAll` / 初始键 */
const innerExpanded = ref<null | TreeKey[]>(null);
const innerSelected = ref<TreeKey[]>([...props.defaultSelectedKeys]);
const innerChecked = ref<TreeKey[]>([...props.defaultCheckedKeys]);

const expandedList = computed(() => {
  if (props.expandedKeys !== undefined) return props.expandedKeys;
  if (innerExpanded.value !== null) return innerExpanded.value;
  if (props.defaultExpandAll) return parentKeys(roots.value);
  return props.defaultExpandedKeys;
});

const selectedList = computed(
  () => props.selectedKeys ?? innerSelected.value,
);
const checkedList = computed(() => props.checkedKeys ?? innerChecked.value);

const expandedSet = computed(
  () => new Set(expandedList.value.map(treeKey)),
);
const selectedSet = computed(
  () => new Set(selectedList.value.map(treeKey)),
);
const checkedSet = computed(() => new Set(checkedList.value.map(treeKey)));

/** 父节点不写在 checkedKeys 里也算选中：由子树推导，同时得到半选集合 */
function deriveChecked(source: Set<string>) {
  const checked = new Set(source);
  const half = new Set<string>();

  function walk(node: NormalTreeNode): boolean {
    if (!node.hasChildren) return checked.has(treeKey(node.key));
    let all = true;
    let any = false;
    for (const child of node.children) {
      const childChecked = walk(child);
      if (childChecked) any = true;
      else if (!child.disabled) all = false;
    }
    const id = treeKey(node.key);
    if (all) checked.add(id);
    else if (any) half.add(id);
    return all;
  }
  for (const node of roots.value) walk(node);

  return { checked, half };
}

function flattenKeys(source: Set<string>) {
  const out: TreeKey[] = [];
  function walk(nodes: NormalTreeNode[]) {
    for (const node of nodes) {
      if (source.has(treeKey(node.key))) out.push(node.key);
      walk(node.children);
    }
  }
  walk(roots.value);
  return out;
}

function findData(key: TreeKey) {
  function walk(nodes: NormalTreeNode[]): Record<string, any> | undefined {
    for (const node of nodes) {
      if (treeKey(node.key) === treeKey(key)) return node.data;
      const found = walk(node.children);
      if (found) return found;
    }
    return undefined;
  }
  return walk(roots.value);
}

const checkState = computed(() => deriveChecked(checkedSet.value));

function onExpand(node: NormalTreeNode) {
  const id = treeKey(node.key);
  const next = new Set(expandedSet.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  const keys = [...next];
  if (props.expandedKeys === undefined) innerExpanded.value = keys;
  emit('update:expandedKeys', keys);
  emit('expand', keys);
}

function onSelect(node: NormalTreeNode) {
  if (!props.selectable || node.disabled) return;
  const id = treeKey(node.key);
  const selected = !selectedSet.value.has(id);
  const keys = selected ? [node.key] : [];
  if (props.selectedKeys === undefined) innerSelected.value = keys;
  emit('update:selectedKeys', keys);
  emit('select', keys, { node: node.data, selected });
}

function onCheck(node: NormalTreeNode, checked: boolean) {
  const next = new Set(checkedSet.value);
  function apply(current: NormalTreeNode) {
    if (!current.disabled) {
      const id = treeKey(current.key);
      if (checked) next.add(id);
      else next.delete(id);
    }
    current.children.forEach(apply);
  }
  apply(node);

  const keys = flattenKeys(deriveChecked(next).checked);
  if (props.checkedKeys === undefined) innerChecked.value = keys;
  emit('update:checkedKeys', keys);
  emit('check', keys, {
    checkedNodes: keys
      .map((key) => findData(key))
      .filter(Boolean) as Record<string, any>[],
  });
}

const context = computed<TreeContext>(() => ({
  blockNode: props.blockNode,
  checkable: props.checkable,
  checkedKeys: checkState.value.checked,
  expandedKeys: expandedSet.value,
  halfCheckedKeys: checkState.value.half,
  onCheck,
  onExpand,
  onSelect,
  selectable: props.selectable,
  selectedKeys: selectedSet.value,
}));
</script>

<template>
  <div data-common-tree class="w-full text-sm">
    <TreeNodes :context="context" :depth="0" :nodes="roots" />
  </div>
</template>
