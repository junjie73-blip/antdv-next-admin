<script setup lang="ts">
import { useAuthStyles } from '../composables/useAuthStyles'

defineOptions({ name: 'AuthBackground' })

const {
  bgLayerClassName,
  bgGradientClassName,
  blob1ClassName,
  blob2ClassName,
  blob3ClassName,
  blob4ClassName,
  gridClassName,
  dotsClassName,
  ring1ClassName,
  ring2ClassName,
  ring3ClassName,
  raysClassName,
  cornerGlowTopClassName,
  cornerGlowBottomClassName,
  sparklesClassName,
  noiseClassName,
} = useAuthStyles()
</script>

<template>
  <div :class="bgLayerClassName" aria-hidden="true">
    <!-- 1. 基础径向渐变底 -->
    <div :class="bgGradientClassName" />

    <!-- 2. 顶部 + 底部角落光晕 -->
    <div :class="cornerGlowTopClassName" />
    <div :class="cornerGlowBottomClassName" />

    <!-- 3. 4 个流动光斑 -->
    <div :class="blob1ClassName" />
    <div :class="blob2ClassName" />
    <div :class="blob3ClassName" />
    <div :class="blob4ClassName" />

    <!-- 4. 装饰性同心圆环 -->
    <div :class="ring1ClassName" />
    <div :class="ring2ClassName" />
    <div :class="ring3ClassName" />

    <!-- 5. 对角光束 -->
    <div :class="raysClassName" />

    <!-- 6. 细网格（中部区域） -->
    <div :class="gridClassName" />

    <!-- 7. 点阵图案 -->
    <div :class="dotsClassName" />

    <!-- 8. 漂浮小点 -->
    <div :class="sparklesClassName" />

    <!-- 9. 噪点纹理（增加质感） -->
    <div :class="noiseClassName" />
  </div>
</template>
