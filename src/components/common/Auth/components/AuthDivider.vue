<script setup lang="ts">
defineOptions({ name: "AuthDivider" });
</script>

<template>
  <div class="relative my-6">
    <div class="absolute inset-0 flex items-center">
      <div class="w-full border-t border-white/50 dark:border-white/[0.06]" />
    </div>
    <div class="relative flex justify-center">
      <span class="bg-transparent px-3 text-[11px] text-slate-400">
        <slot>或</slot>
      </span>
    </div>
  </div>
</template>
