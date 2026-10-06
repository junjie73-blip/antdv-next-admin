<script setup lang="ts">
import { useAuthStyles } from '../composables/useAuthStyles';

defineOptions({ name: 'AuthBackground' });

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
} = useAuthStyles();
</script>

<template>
  <div :class="bgLayerClassName" aria-hidden="true">
    <!-- 1. 基础径向渐变底 -->
    <div :class="bgGradientClassName"></div>

    <!-- 2. 顶部 + 底部角落光晕 -->
    <div :class="cornerGlowTopClassName"></div>
    <div :class="cornerGlowBottomClassName"></div>

    <!-- 3. 4 个流动光斑 -->
    <div :class="blob1ClassName"></div>
    <div :class="blob2ClassName"></div>
    <div :class="blob3ClassName"></div>
    <div :class="blob4ClassName"></div>

    <!-- 4. 装饰性同心圆环 -->
    <div :class="ring1ClassName"></div>
    <div :class="ring2ClassName"></div>
    <div :class="ring3ClassName"></div>

    <!-- 5. 对角光束 -->
    <div :class="raysClassName"></div>

    <!-- 6. 细网格（中部区域） -->
    <div :class="gridClassName"></div>

    <!-- 7. 点阵图案 -->
    <div :class="dotsClassName"></div>

    <!-- 8. 漂浮小点 -->
    <div :class="sparklesClassName"></div>

    <!-- 9. 噪点纹理（增加质感） -->
    <div :class="noiseClassName"></div>
  </div>
</template>
