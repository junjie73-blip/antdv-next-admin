<script setup lang="ts">
import type {
  ChunkUploadInstance,
  ChunkUploadProps,
  ChunkUploadTask,
} from './types';

import { computed } from 'vue';

import { message } from '@antdv/popup-ui';
import { cn } from '@antdv/shared/utils/cn';
import { Icon } from '@iconify/vue';

import { Tag } from '../tag';
import { useChunkUploader } from './composables/useChunkUploader';
import { classifyUploadError, STATUS_COLOR } from './constants';
import { formatBytes, formatDuration } from './utils';

defineOptions({ name: 'ChunkUpload' });

const props = withDefaults(defineProps<ChunkUploadProps>(), {
  chunkSize: 0,
  concurrency: 3,
  maxRetry: 3,
  autoStart: true,
  resume: true,
  multiple: true,
});
const emit = defineEmits<{
  success: [task: ChunkUploadTask];
  error: [task: ChunkUploadTask];
  change: [tasks: ChunkUploadTask[]];
  complete: [tasks: ChunkUploadTask[]];
}>();
const bandwidthLimit = defineModel<number>('limit', {
  default: 0,
});
// ============================================================
// 核心
// ============================================================
const uploader = useChunkUploader({
  bandwidth: bandwidthLimit.value,
  chunkSize: props.chunkSize,
  concurrency: props.concurrency,
  createWorker: props.createWorker,
  maxRetry: props.maxRetry,

  onUpdate: (task) => {
    emit('change', uploader.getTasks());
    if (task.status === 'success') {
      emit('success', task);
      notifyCompleteIfAllDone();
    }
  },

  onError: (task) => emit('error', task),
  onMergeStart: (task) => {
    message.success(`文件 ${task.filename} 已进入合并阶段`);
  },
});

function getErrorHint(task: ChunkUploadTask): string {
  if (task.error) return task.error;
  if (task.errorCode) {
    const info = classifyUploadError({ message: task.errorCode });
    return info.message;
  }
  return '上传失败';
}
function canRetry(task: ChunkUploadTask): boolean {
  return task.status === 'error' && task.errorRetryable !== false;
}
function notifyCompleteIfAllDone() {
  const all = uploader.getTasks();
  const allSettled = all.every(
    (t) =>
      t.status === 'success' || t.status === 'error' || t.status === 'canceled',
  );
  if (allSettled && all.some((t) => t.status === 'success')) {
    emit('complete', all);
  }
}

const tasks = computed(() => [...uploader.tasks.value.values()]);

// ============================================================
// 选择文件
// ============================================================
function handleSelectFiles(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = [...(input.files ?? [])];
  if (files.length === 0) return;

  if (props.maxCount && tasks.value.length + files.length > props.maxCount) {
    message.warning(`最多同时上传 ${props.maxCount} 个文件`);
    input.value = '';
    return;
  }

  const valid: File[] = [];
  for (const f of files) {
    if (props.maxSize && f.size > props.maxSize * 1024 * 1024) {
      message.warning(`${f.name} 超过 ${props.maxSize}MB，已跳过`);
      continue;
    }
    valid.push(f);
  }

  if (valid.length === 0) {
    input.value = '';
    return;
  }

  uploader.addFiles(valid);
  if (props.autoStart) uploader.start();
  input.value = '';
}

// ============================================================
// 展示辅助
// ============================================================
function getPercent(task: ChunkUploadTask): number {
  if (task.total === 0) return 0;
  return Math.min(100, Math.round((task.loaded / task.total) * 100));
}

/** 状态文案 */
function getStatusText(task: ChunkUploadTask): string {
  switch (task.status) {
    case 'waiting': {
      return '等待中';
    }
    case 'hashing': {
      return '计算中';
    }
    case 'uploading': {
      return '上传中';
    }
    case 'paused': {
      return '已暂停';
    }
    case 'merging': {
      return getMergeStatusText(task.mergeStatus);
    }
    case 'success': {
      return '已完成';
    }
    case 'error': {
      return '上传失败';
    }
    case 'canceled': {
      return '已取消';
    }
    default: {
      return task.status;
    }
  }
}

/** 合并阶段细分文案 */
function getMergeStatusText(
  status?: 'completed' | 'failed' | 'merging' | 'pending' | 'uploading',
): string {
  switch (status) {
    case 'pending': {
      return '准备合并';
    }
    case 'merging': {
      return '合并中';
    }
    case 'uploading': {
      return '上传中';
    }
    case 'completed': {
      return '已完成';
    }
    case 'failed': {
      return '合并失败';
    }
    default: {
      return '合并中';
    }
  }
}

/** STATUS_COLOR 用的是语义色名，映射到 common-ui Tag 的预设色板，保持状态色一致 */
const TAG_PRESET: Record<string, string> = {
  default: 'default',
  error: 'red',
  processing: 'blue',
  success: 'green',
  warning: 'gold',
};

function getStatusColor(task: ChunkUploadTask): string {
  const semantic = STATUS_COLOR[task.status] ?? 'default';
  return TAG_PRESET[semantic] ?? 'default';
}

// ============================================================
// 操作
// ============================================================
function handlePause(uid: string) {
  uploader.pause(uid);
}
function handleResume(uid: string) {
  uploader.resume(uid);
}
function handleRetry(uid: string) {
  uploader.retry(uid);
}
function handleRemove(uid: string) {
  uploader.remove(uid);
}
function handleStartOne(uid: string) {
  uploader.start(uid);
}
function handleStartAll() {
  uploader.start();
}
function handlePauseAll() {
  uploader.pause();
}
function handleResumeAll() {
  uploader.resume();
}
function handleClear() {
  uploader.clear();
}

// ============================================================
// 暴露实例
// ============================================================
const instance: ChunkUploadInstance = {
  addFiles: (files) => uploader.addFiles(files),
  start: (uid) => uploader.start(uid),
  pause: (uid) => uploader.pause(uid),
  resume: (uid) => uploader.resume(uid),
  cancel: (uid) => uploader.cancel(uid),
  remove: (uid) => uploader.remove(uid),
  retry: (uid) => uploader.retry(uid),
  clear: () => uploader.clear(),
  getTasks: () => uploader.getTasks(),
};
defineExpose(instance);

// ============================================================
// 按钮可见性
// ============================================================
const hasWaiting = computed(() =>
  tasks.value.some((t) => t.status === 'waiting'),
);
const hasActive = computed(() =>
  tasks.value.some((t) =>
    ['hashing', 'merging', 'uploading'].includes(t.status),
  ),
);
const hasPaused = computed(() =>
  tasks.value.some((t) => t.status === 'paused'),
);
</script>

<template>
  <div class="space-y-3">
    <!-- 工具栏 -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <label
        class="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-card-foreground transition-colors hover:border-primary hover:text-primary"
      >
        <Icon icon="carbon:upload" />
        <span>选择文件</span>
        <input
          type="file"
          class="hidden"
          :multiple="multiple"
          :accept="accept"
          @change="handleSelectFiles"
        />
      </label>
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-if="hasWaiting"
          type="button"
          class="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          @click="handleStartAll"
        >
          开始全部
        </button>
        <button
          v-if="hasActive"
          type="button"
          class="rounded-md bg-warning px-3 py-1.5 text-sm text-white hover:bg-warning/90"
          @click="handlePauseAll"
        >
          暂停全部
        </button>
        <button
          v-if="hasPaused"
          type="button"
          class="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
          @click="handleResumeAll"
        >
          继续全部
        </button>
        <button
          v-if="tasks.length > 0"
          type="button"
          class="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          @click="handleClear"
        >
          清空
        </button>
      </div>
    </div>

    <!-- 空状态 -->
    <div
      v-if="tasks.length === 0"
      class="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-muted-foreground"
    >
      <Icon icon="carbon:cloud-upload" class="mb-2 text-4xl" />
      <p class="text-sm">点击"选择文件"开始上传</p>
    </div>

    <!-- 任务列表 -->
    <div v-else class="space-y-2">
      <div
        v-for="task in tasks"
        :key="task.uid"
        class="rounded-lg border border-border bg-card p-3"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="flex min-w-0 flex-1 items-start gap-2">
            <Icon
              icon="carbon:document"
              class="mt-0.5 shrink-0 text-base text-muted-foreground"
            />
            <div class="min-w-0 flex-1">
              <div
                class="truncate text-sm font-medium text-card-foreground"
                :title="task.filename"
              >
                {{ task.filename }}
              </div>
              <div
                class="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
              >
                <span class="text-muted-foreground">
                  {{ formatBytes(task.loaded) }} / {{ formatBytes(task.total) }}
                </span>
                <span
                  v-if="task.status !== 'merging'"
                  class="text-muted-foreground"
                >
                  {{ getPercent(task) }}%
                </span>
                <Tag
                  :color="getStatusColor(task)"
                  class="m-0 text-[10px] leading-4"
                >
                  {{ getStatusText(task) }}
                </Tag>

                <span class="text-muted-foreground">
                  {{ formatBytes(task.chunkSize) }} × {{ task.totalChunks }} 片
                </span>

                <span
                  v-if="task.status === 'hashing'"
                  class="text-purple-500 dark:text-purple-400"
                >
                  hash {{ task.hashProgress }}%
                </span>

                <span
                  v-if="task.status === 'uploading' && task.speed > 0"
                  class="text-muted-foreground"
                >
                  {{ formatBytes(task.speed) }}/s · 剩余
                  {{ formatDuration(task.remaining) }}
                </span>
                <span
                  v-if="task.retryCount > 0 && task.status === 'uploading'"
                  class="text-warning"
                >
                  重试 {{ task.retryCount }} 次
                </span>
              </div>
            </div>
          </div>

          <div class="flex shrink-0 items-center gap-1">
            <button
              v-if="task.status === 'waiting'"
              type="button"
              class="text-primary rounded p-1 hover:bg-primary/10"
              title="开始"
              @click="handleStartOne(task.uid)"
            >
              <Icon icon="carbon:play" />
            </button>

            <!-- 合并中不显示暂停（后端无法中断） -->
            <button
              v-if="['uploading', 'hashing'].includes(task.status)"
              type="button"
              class="rounded p-1 text-warning hover:bg-warning/10"
              title="暂停"
              @click="handlePause(task.uid)"
            >
              <Icon icon="carbon:pause" />
            </button>

            <button
              v-if="task.status === 'paused'"
              type="button"
              class="text-primary rounded p-1 hover:bg-primary/10"
              title="继续"
              @click="handleResume(task.uid)"
            >
              <Icon icon="carbon:play" />
            </button>
            <div
              v-if="task.status === 'error'"
              class="mt-2 flex items-center justify-between rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs"
            >
              <div class="flex items-center gap-1.5 text-destructive">
                <Icon icon="carbon:warning-alt" class="shrink-0" />
                <span>{{ getErrorHint(task) }}</span>
                <span
                  v-if="task.retryCount > 0"
                  class="rounded bg-destructive/15 px-1.5 py-0.5 text-[10px]"
                >
                  已重试 {{ task.retryCount }} 次
                </span>
              </div>
              <button
                v-if="canRetry(task)"
                type="button"
                class="shrink-0 rounded px-2 py-0.5 text-destructive hover:bg-destructive/15"
                @click="handleRetry(task.uid)"
              >
                重试
              </button>
            </div>
            <button
              type="button"
              class="rounded p-1 text-muted-foreground hover:bg-accent"
              title="移除"
              @click="handleRemove(task.uid)"
            >
              <Icon icon="carbon:close" />
            </button>
          </div>
        </div>

        <!-- 进度条 -->
        <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <!-- 合并中：脉动动画（无具体进度） -->
          <div
            v-if="task.status === 'merging'"
            class="h-full w-full animate-pulse rounded-full bg-purple-500"
          ></div>
          <div
            v-else-if="task.status === 'success'"
            class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
          >
            <span class="text-success">✓ 已上传并入库</span>
            <a
              v-if="task.result?.url"
              :href="task.result.url"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary hover:text-primary/80"
            >
              查看文件
            </a>
            <span
              v-if="task.hash"
              class="text-muted-foreground"
              :title="task.hash"
            >
              MD5: {{ task.hash.slice(0, 8) }}...
            </span>
          </div>
          <!-- 其他状态：按百分比 -->
          <div
            v-else
            :class="
              cn(
                'h-full rounded-full transition-all duration-300',
                task.status === 'error' && 'bg-destructive',
                task.status === 'paused' && 'bg-warning',
                task.status === 'hashing' && 'bg-purple-500',
                task.status === 'uploading' && 'bg-primary',
                task.status === 'waiting' && 'bg-muted-foreground/60',
                task.status === 'canceled' && 'bg-muted-foreground/60',
              )
            "
            :style="{
              width: `${task.status === 'hashing' ? task.hashProgress : getPercent(task)}%`,
            }"
          ></div>
        </div>
        <div
          v-if="task.status === 'uploading' && task.retryCount > 0"
          class="mt-1 text-xs text-warning"
        >
          重试第 {{ task.retryCount }} 轮…
        </div>

        <!-- 错误提示 -->
        <div
          v-if="task.status === 'error'"
          class="mt-2 flex items-center justify-between rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs"
        >
          <div class="flex items-center gap-1.5 text-destructive">
            <Icon icon="carbon:warning-alt" class="shrink-0" />
            <span>{{ task.error || '上传失败' }}</span>
          </div>
          <button
            v-if="task.errorRetryable !== false"
            type="button"
            class="shrink-0 rounded px-2 py-0.5 text-destructive hover:bg-destructive/15"
            @click="handleRetry(task.uid)"
          >
            重试
          </button>
        </div>

        <!-- 成功提示：显示文件信息 -->
        <div
          v-if="task.status === 'success'"
          class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
        >
          <span class="text-success">已上传并入库</span>
          <a
            v-if="task.result?.url"
            :href="task.result.url"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary hover:text-primary/80"
          >
            查看文件
          </a>
          <span
            v-if="task.hash"
            class="text-muted-foreground"
            :title="task.hash"
          >
            MD5: {{ task.hash.slice(0, 8) }}...
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
