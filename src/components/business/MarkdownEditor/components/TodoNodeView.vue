<script setup lang="ts">
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'

const props = defineProps(nodeViewProps)

function handleToggle(event: Event) {
  props.updateAttributes({ checked: (event.target as HTMLInputElement).checked })
}
</script>

<template>
  <NodeViewWrapper class="md-todo" data-w-e-type="todo">
    <input
      type="checkbox"
      class="md-todo-checkbox"
      :checked="node.attrs.checked"
      :disabled="!editor.isEditable"
      @change="handleToggle"
    />
    <NodeViewContent as="div" class="md-todo-content" />
  </NodeViewWrapper>
</template>

<style scoped>
.md-todo {
  display: flex;
  align-items: flex-start;
  gap: 0.375rem;
  margin: 0.25rem 0;
}

.md-todo-checkbox {
  margin-top: 0.3rem;
  cursor: pointer;
}

.md-todo-checkbox:disabled {
  cursor: not-allowed;
}

.md-todo-content {
  flex: 1;
  min-width: 0;
}
</style>
