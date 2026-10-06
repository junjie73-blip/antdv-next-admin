<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue';

import { VideoPlayer } from '@videojs-player/vue';
import { message } from 'antdv-next';
import { isError } from 'es-toolkit';
import MarkdownIt from 'markdown-it';
import { downloadFile, previewFile } from '~/api';
import { getFileCategory } from '~/utils/file-category';

import 'video.js/dist/video-js.css';
import '@vue-office/docx/lib/index.css';
import '@vue-office/excel/lib/index.css';

const props = defineProps<{
  modelValue: boolean;
  fileId?: string;
  url?: string;
  fileName: string;
  mimeType?: string;
  category?: string;
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
}>();
const VueDocx = defineAsyncComponent(() => import('@vue-office/docx'));
const VuePptx = defineAsyncComponent(() => import('@vue-office/pptx'));
const VueExcel = defineAsyncComponent(() => import('@vue-office/excel'));

const md = new MarkdownIt({ html: true, linkify: true, breaks: true });

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const loading = ref(false);
const previewUrl = ref('');
const textContent = ref('');
const audioRef = ref<HTMLAudioElement | null>(null);

const renderedMarkdown = computed(() => md.render(textContent.value || ''));
const category = computed(() => getFileCategory(props.fileName));

function buildParams() {
  const params: Record<string, string> = {};
  if (props.fileId) params.fileId = props.fileId;
  return params;
}

async function loadPreview() {
  if (!props.fileId) return;
  loading.value = true;
  try {
    const res: any = await previewFile(buildParams());
    previewUrl.value = res.url ?? res.data?.url;

    if (category.value === 'text' || category.value === 'markdown') {
      const r = await fetch(previewUrl.value);
      textContent.value = await r.text();
    }
  } catch (error) {
    // isError 收窄类型
    const msg = isError(error) ? error.message : String(error);
    message.error(`加载预览失败：${msg}`);
    visible.value = false;
  } finally {
    loading.value = false;
  }
}

function onRendered() {
  loading.value = false;
}

function onError(err: unknown) {
  console.log('[preview] error', err);
  message.error('文件渲染失败');
  loading.value = false;
}

async function handleDownload() {
  const params = { ...buildParams(), fileName: props.fileName };
  const res: any = await downloadFile(params);
  const url = res.url ?? res.data?.url;
  window.open(url, '_blank');
}

function handleClosed() {
  previewUrl.value = '';
  textContent.value = '';
}

function onVideoMounted(player: any) {
  try {
    player.volume(0.6);
  } catch {
    // ignore
  }
}

watch(
  () => [props.modelValue, props.fileId, props.url] as const,
  ([open]) => {
    if (open) loadPreview();
  },
  { immediate: true },
);
</script>

<template>
  <a-modal
    v-model:open="visible"
    :title="fileName"
    width="80%"
    :footer="null"
    :destroy-on-close="true"
    :mask-closable="false"
    :body-style="{ height: '75vh' }"
    @cancel="handleClosed"
  >
    <a-spin
      :spinning="loading"
      class="w-full"
      wrapper-class-name="h-full"
      classes="h-full"
    >
      <PerfectScrollbar class="h-full">
        <div class="h-full">
          <div
            v-if="category === 'image'"
            class="flex items-center justify-center"
          >
            <a-image
              :src="previewUrl"
              :preview="true"
              class="max-w-full"
              :style="{ maxHeight: '70vh' }"
            />
          </div>

          <PdfViewer
            v-else-if="category === 'pdf' && previewUrl"
            :source="previewUrl"
            annotation-layer
            text-layer
            class="h-full w-full"
            @rendered="onRendered"
            @error="onError"
          />

          <VueDocx
            v-else-if="category === 'word'"
            :src="previewUrl"
            class="h-full w-full"
            @rendered="onRendered"
            @error="onError"
          />

          <VueExcel
            v-else-if="category === 'excel'"
            :src="previewUrl"
            class="h-full w-full"
            @rendered="onRendered"
            @error="onError"
          />
          <VuePptx
            v-else-if="category === 'pptx'"
            :src="previewUrl"
            class="h-full w-full"
            @rendered="onRendered"
            @error="onError"
          />
          <div v-else-if="category === 'video'" class="h-full w-full">
            <VideoPlayer
              :src="previewUrl"
              controls
              :autoplay="false"
              :volume="0.6"
              :playback-rates="[0.5, 1.0, 1.25, 1.5, 2.0]"
              class="h-full w-full"
              @mounted="onVideoMounted"
              @ready="onRendered"
              @error="onError"
            />
          </div>

          <div
            v-else-if="category === 'audio'"
            class="flex h-full flex-col items-center justify-center gap-4 py-12"
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

          <div
            v-else-if="category === 'markdown'"
            class="markdown-body max-h-[70vh] overflow-auto rounded bg-gray-50 p-4"
            v-safe-html="renderedMarkdown"
          ></div>

          <pre
            v-else-if="category === 'text'"
            class="max-h-[70vh] overflow-auto rounded bg-gray-50 p-4 font-mono text-sm break-all whitespace-pre-wrap"
            >{{ textContent }}</pre>

          <div v-else class="py-16 text-center">
            <p class="mb-4 text-gray-500">该文件类型暂不支持在线预览</p>
            <a-button type="primary" @click="handleDownload">下载文件</a-button>
          </div>
        </div>
      </PerfectScrollbar>
    </a-spin>
  </a-modal>
</template>

<style scoped>
:deep(.ant-spin-container) {
  height: 100%;
}
</style>
