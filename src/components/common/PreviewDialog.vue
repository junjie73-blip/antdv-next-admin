<template>
  <a-modal
    v-model:open="visible"
    :title="fileName"
    width="80%"
    :footer="null"
    :destroy-on-close="true"
    :mask-closable="false"
    @cancel="handleClosed"
    :body-style="{ height: '75vh' }"
  >
    <a-spin :spinning="loading" class="w-full" wrapperClassName="h-full" classes="h-full">
      <PerfectScrollbar class="h-full">
        <div class="h-full">
          <!-- 图片 -->
          <div v-if="category === 'image'" class="flex justify-center items-center">
            <a-image
              :src="previewUrl"
              :preview="true"
              class="max-w-full"
              :style="{ maxHeight: '70vh' }"
            />
          </div>

          <!-- PDF -->
          <PdfViewer
            v-else-if="category === 'pdf' && previewUrl"
            :source="previewUrl"
            annotation-layer
            text-layer
            class="w-full h-full"
            @rendered="onRendered"
            @error="onError"
          />

          <!-- Word -->
          <VueDocx
            v-else-if="category === 'word'"
            :src="previewUrl"
            class="w-full h-full"
            @rendered="onRendered"
            @error="onError"
          />

          <!-- Excel -->
          <VueExcel
            v-else-if="category === 'excel'"
            :src="previewUrl"
            class="w-full h-full"
            @rendered="onRendered"
            @error="onError"
          />
          <VuePptx
            v-else-if="category === 'pptx'"
            :src="previewUrl"
            class="w-full h-full"
            @rendered="onRendered"
            @error="onError"
          />
          <div v-else-if="category === 'video'" class="w-full h-full">
            <video-player
              :src="previewUrl"
              controls
              :autoplay="false"
              :volume="0.6"
              :playback-rates="[0.5, 1.0, 1.25, 1.5, 2.0]"
              class="w-full h-full"
              @mounted="onVideoMounted"
              @ready="onRendered"
              @error="onError"
            />
          </div>

          <div
            v-else-if="category === 'audio'"
            class="flex flex-col items-center justify-center gap-4 py-12 h-full"
          >
            <div class="text-6xl text-gray-300">🎵</div>
            <p class="max-w-full truncate text-gray-600" :title="fileName">
              {{ fileName }}
            </p>
            <audio
              ref="audioRef"
              :src="previewUrl"
              controls
              preload="metadata"
              class="w-full max-w-2xl"
              @loadedmetadata="onRendered"
              @error="onError"
            >
              您的浏览器不支持音频播放。
            </audio>
          </div>
          <!-- Markdown -->
          <div
            v-else-if="category === 'markdown'"
            class="markdown-body max-h-[70vh] overflow-auto rounded bg-gray-50 p-4"
            v-safe-html="renderedMarkdown"
          />

          <!-- 纯文本 -->
          <pre
            v-else-if="category === 'text'"
            class="max-h-[70vh] overflow-auto whitespace-pre-wrap break-all rounded bg-gray-50 p-4 font-mono text-sm"
            >{{ textContent }}</pre
          >

          <!-- 不支持预览的类型 -->
          <div v-else class="py-16 text-center">
            <p class="mb-4 text-gray-500">该文件类型暂不支持在线预览</p>
            <a-button type="primary" @click="handleDownload">下载文件</a-button>
          </div>
        </div>
      </PerfectScrollbar>
    </a-spin>
  </a-modal>
</template>

<script setup lang="ts">
import { VideoPlayer } from "@videojs-player/vue";
import VueDocx from "@vue-office/docx";
import VueExcel from "@vue-office/excel";
import VuePptx from "@vue-office/pptx";
import { message } from "antdv-next";
import MarkdownIt from "markdown-it";
import { computed, ref, watch } from "vue";

import "video.js/dist/video-js.css";
import "@vue-office/docx/lib/index.css";
import "@vue-office/excel/lib/index.css";
import { downloadFile, previewFile } from "~/api";
import { getFileCategory } from "~/utils/file-category";

// ⚠️ 下面两个请求方法按你项目 alova 的实际组织方式替换
const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true,
});

const props = defineProps<{
  /** v-model 控制显示 */
  modelValue: boolean;
  /** 文件 ID（与 url 二选一，优先 fileId） */
  fileId?: string;
  /** 文件原始 url（数据库里的，可能需要重新签名） */
  url?: string;
  /** 文件名，用于标题和下载名 */
  fileName: string;
  /** mime 类型（可选，用于兜底分类） */
  mimeType?: string;
  /** 后端返回的分类（推荐传，避免重复判断） */
  category?: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

const loading = ref(false);
const previewUrl = ref("");
const textContent = ref("");
const audioRef = ref<HTMLAudioElement | null>(null);
const renderedMarkdown = computed(() => md.render(textContent.value || ""));

const category = computed(() => getFileCategory(props.fileName));

/** 组装请求参数：fileId 优先，否则用 url */
function buildParams() {
  const params: Record<string, string> = {};
  if (props.fileId) params.fileId = props.fileId;
  return params;
}

async function loadPreview() {
  if (!props.fileId) return;
  loading.value = true;
  try {
    const params = buildParams();
    const res: any = await previewFile(params);
    // 按你后端返回结构调整，例如 res.data.url
    previewUrl.value = res.url ?? res.data?.url;

    // 文本 / markdown 需要拉文件内容
    if (category.value === "text" || category.value === "markdown") {
      const r = await fetch(previewUrl.value);
      textContent.value = await r.text();
    }
  } catch (e: any) {
    message.error("加载预览失败：" + (e?.message ?? ""));
    visible.value = false;
  } finally {
    loading.value = false;
  }
}

function onRendered() {
  loading.value = false;
}

function onError(err: any) {
  console.log("[preview] error", err);
  message.error("文件渲染失败");
  loading.value = false;
}

async function handleDownload() {
  const params = { ...buildParams(), fileName: props.fileName };
  const res: any = await downloadFile(params);
  const url = res.url ?? res.data?.url;
  window.open(url, "_blank");
}

function handleClosed() {
  previewUrl.value = "";
  textContent.value = "";
}
function onVideoMounted(player: any) {
  // player 是 video.js 实例
  try {
    player.volume(0.6);
  } catch (_e) {
    // 忽略错误
  }
}
watch(
  () => [props.modelValue, props.fileId, props.url],
  ([open]) => {
    if (open) loadPreview();
  },
  { immediate: true },
);
</script>
<style scoped>
:deep(.ant-spin-container) {
  height: 100%;
}
</style>
