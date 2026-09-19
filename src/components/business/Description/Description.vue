<script setup lang="ts">
import { Descriptions, type DescriptionsProps } from "antdv-next";
import { Image } from "antdv-next";
import dayjs from "dayjs";
import { computed, h, useSlots } from "vue";

import type { VNodeChild } from "vue";

import type { DescriptionInstance, DescriptionItem, DescriptionProps } from "./types";

import { cn } from "~/utils/cn";
import { getDictLabel, getDictLabels } from "~/utils/dict";

const props = withDefaults(defineProps<DescriptionProps>(), {
  column: 3,
  layout: "horizontal",
  bordered: false,
  colon: true,
  loading: false,
  emptyText: "-",
});

const slots = useSlots();

// ========== 数据源 ==========
const dataRef = computed(() => props.data || {});

// ========== 过滤 schema ==========
const filteredSchema = computed(() => (props.schema || []).filter((item) => item.show !== false));

// ========== 取值 ==========
function getFieldValue(item: DescriptionItem): any {
  const value = item.value !== undefined ? item.value : dataRef.value[item.field];
  if (value === undefined || value === null || value === "") {
    return props.emptyText;
  }
  return value;
}

/** 标签 */
function renderLabel(item: DescriptionItem): VNodeChild {
  const slotName = `${item.field}-label`;
  if (slots[slotName]) {
    return slots[slotName]!({ item, data: dataRef.value });
  }
  if (item.renderLabel) {
    return item.renderLabel(item.label || item.field, dataRef.value);
  }
  return item.label || item.field;
}

/** 单张图片 */
function renderImage(value: any, size = 60): VNodeChild {
  if (!value || value === props.emptyText) return h("span", props.emptyText);
  const url = typeof value === "string" ? value : value.url;
  return h(Image, {
    src: url,
    width: size,
    preview: true,
  });
}

/** 多张图片 */
function renderImages(value: any, size = 60): VNodeChild {
  if (!value || value === props.emptyText) return h("span", props.emptyText);
  const list: string[] = Array.isArray(value)
    ? value.map((v: any) => (typeof v === "string" ? v : v.url))
    : String(value).split(",").filter(Boolean);
  return h(
    "div",
    {},
    {
      default: () =>
        list.map((url, i) =>
          h(Image, {
            key: i,
            src: url,
            width: size,
            height: size,
          }),
        ),
    },
  );
}

/** 主内容渲染 */
function renderValue(item: DescriptionItem): VNodeChild {
  const slotName = item.field;
  const value = getFieldValue(item);

  // 1. slot 优先
  if (slots[slotName]) {
    return slots[slotName]!({ item, data: dataRef.value, value });
  }

  // 2. 自定义 render 优先
  if (item.render) {
    const result = item.render(value, dataRef.value);
    if (typeof result === "string" || typeof result === "number") {
      return h("span", result);
    }
    return result;
  }

  // 3. 按 type 分发
  switch (item.type) {
    case "dict": {
      if (!item.dictType) return h("span", value);
      // 值是数组或逗号分隔时，用 getDictLabels
      const isMulti = Array.isArray(value) || String(value).includes(",");
      const label = isMulti
        ? getDictLabels(item.dictType, value)
        : getDictLabel(item.dictType, value);
      return h("span", label);
    }

    case "image":
      return renderImage(value, item.imageSize || 60);

    case "images":
      return renderImages(value, item.imageSize || 60);

    case "date":
      return h(
        "span",
        value === props.emptyText ? value : dayjs(value).format(item.dateFormat || "YYYY-MM-DD"),
      );

    case "datetime":
      return h(
        "span",
        value === props.emptyText
          ? value
          : dayjs(value).format(item.dateFormat || "YYYY-MM-DD HH:mm:ss"),
      );

    case "tag":
      return h("span", value);

    case "text":
    default:
      if (typeof value === "string" || typeof value === "number") {
        return h("span", value);
      }
      return value;
  }
}

// ========== 转成 a-descriptions 的 items 格式 ==========
const items = computed<DescriptionsProps["items"]>(() => {
  return filteredSchema.value.map((item) => ({
    key: item.field,
    label: renderLabel(item),
    content: renderValue(item),
    span: item.span || 1,
    labelStyle: item.labelStyle,
    contentStyle: item.contentStyle,
  })) as DescriptionsProps["items"];
});

// ========== size 映射（antdv-next 只接受 default / middle / small） ==========
const antSize = computed<"default" | "middle" | "small">(() => {
  if (props.size === "small") return "small";
  return "default";
});

// ========== 实例方法 ==========
const instance: DescriptionInstance = {
  getData: () => props.data,
  setData: () => {
    console.warn("[Description] setData 不支持在只读模式下使用");
  },
};
defineExpose(instance);
</script>

<template>
  <div :class="cn('description-wrapper', className)" :style="style">
    <!-- 加载中 -->
    <div v-if="loading" class="description-loading flex items-center justify-center py-8">
      <div
        class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"
      />
    </div>

    <!-- 描述列表 -->
    <Descriptions
      v-else
      :title="title"
      :items="items"
      :column="column"
      :size="antSize"
      :layout="layout"
      :bordered="bordered"
      :colon="colon"
    />
  </div>
</template>
