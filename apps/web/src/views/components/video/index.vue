<script setup lang="ts">
import { computed, ref } from 'vue';

import { cn } from '@antdv/shared/cn';
import { VideoPlayer } from '@videojs-player/vue';

import { detectHlsSupport } from './media-capability';

import '@videojs/http-streaming';

import 'video.js/dist/video-js.css';

const containerClassName = cn('space-y-6');
const labelClassName = cn('text-sm', 'text-gray-500', 'mb-3');
const noticeClassName = cn(
  'p-3',
  'rounded-lg',
  'bg-blue-50',
  'dark:bg-blue-900/20',
  'border',
  'border-blue-200',
  'dark:border-blue-800',
  'text-blue-700',
  'dark:text-blue-300',
  'text-sm',
);
/**
 * 播放失败的说明条。
 *
 * 与上面那条蓝色提示区分开：提示是"这类源的通用知识"，这里是"这台环境真的播不了"，
 * 语气要按问题处理走（琥珀色），别把两者混成一种视觉噪音。
 */
const failureClassName = cn(
  'p-3',
  'rounded-lg',
  'bg-amber-50',
  'dark:bg-amber-900/20',
  'border',
  'border-amber-200',
  'dark:border-amber-800',
  'text-amber-700',
  'dark:text-amber-300',
  'text-sm',
);
const playerWrapperClassName = cn(
  'rounded-lg',
  'overflow-hidden',
  'border',
  'border-gray-200',
  'dark:border-gray-700',
);

const mp4Src = 'https://vjs.zencdn.net/v/oceans.mp4';
const mp4Poster = 'https://vjs.zencdn.net/v/oceans.png';

const hlsSrc = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';

/**
 * 循环静音示例用的第二个源。
 * 原来指向 w3schools 的 mov_bbb.mp4，该地址对非浏览器请求返回 403，
 * 在本机 curl / Playwright 下永远加载失败，换成 W3C 的 sintel 预告片
 * （支持 Range 请求，且已在 index.html 的 `media-src` 里登记）。
 */
const loopSrc = 'https://media.w3.org/2010/05/sintel/trailer.mp4';

const baseOptions = {
  controls: true,
  fluid: true,
  playbackRates: [0.5, 1, 1.5, 2],
  controlBar: {
    volumePanel: { inline: false },
  },
  /**
   * video.js 默认给的是英文的 "No compatible source was found for this media."，
   * 全站中文界面里夹一句厂商标案，用户既不知道发生了什么也不知道该做什么。
   * 换成说清"哪一种情况会这样 + 下一步怎么办"的中文。
   */
  notSupportedMessage:
    '当前浏览器或环境无法播放这个源：可能是网络取不到，也可能是不支持该封装/编码。可换成下面的 MP4 直链，或改用 Chrome / Edge 打开。',
};

const mp4PlayerOptions = {
  ...baseOptions,
  autoplay: false,
  preload: 'auto',
  poster: mp4Poster,
};

const hlsPlayerOptions = {
  ...baseOptions,
  autoplay: false,
  preload: 'auto',
  html5: {
    hls: {
      overrideNative: true,
    },
    nativeAudioTracks: false,
    nativeVideoTracks: false,
  },
};

const loopPlayerOptions = {
  ...baseOptions,
  autoplay: true,
  muted: true,
  loop: true,
  controls: false,
  preload: 'auto',
  poster: mp4Poster,
};

/**
 * HLS 这条卡片在"根本没有能力播"的环境里就不该挂播放器。
 *
 * m3u8 有两种活法：Safari 系原生支持；其他浏览器靠 @videojs/http-streaming
 * 走 MSE 把切片拼成 mp4 缓冲。两条都不通还挂个黑框，用户看到的就是"点了没反应"。
 *
 * ⚠️ 这个判定只挡"能力缺失"，挡不住"能力有但这条流取不到"（离线、CSP、CDN 挂了），
 * 所以下面的 `@error` 兜底仍然要留。
 */
const hlsSupport = detectHlsSupport();

/** 每张卡片各记各的失败，避免 HLS 挂了把 MP4 卡片也标成坏的 */
const failed = ref<Record<'hls' | 'loop' | 'mp4', boolean>>({
  hls: false,
  loop: false,
  mp4: false,
});

const failureText = computed(() => ({
  hls: '这条 HLS 流没能播起来（取不到切片，或当前环境不支持 MSE 拼接）。',
  loop: '这条循环视频没能播起来（可能是网络取不到该地址）。',
  mp4: '这条 MP4 没能播起来（可能是网络取不到该地址）。',
}));
</script>

<template>
  <div :class="containerClassName">
    <a-card title="MP4 视频播放" variant="borderless">
      <div :class="labelClassName">
        标准 MP4 格式视频，提供完整的播放控制栏，支持倍速播放、画中画等功能
      </div>
      <div v-if="failed.mp4" :class="failureClassName" class="mb-3">
        {{ failureText.mp4 }}
      </div>
      <div :class="playerWrapperClassName">
        <VideoPlayer
          :src="mp4Src"
          :options="mp4PlayerOptions"
          @error="failed.mp4 = true"
        />
      </div>
    </a-card>

    <a-card title="HLS 流媒体播放" variant="borderless">
      <div :class="labelClassName">
        HLS (m3u8) 自适应码率流媒体视频，可根据网络状况自动切换清晰度
      </div>
      <div v-if="!hlsSupport.playable" :class="failureClassName">
        当前环境既没有原生 HLS，也不支持 MSE 拼接 mp4 切片，这个演示无法播放。
        换用 Chrome / Edge / Safari 即可查看自适应码率的效果，下面的 MP4 卡片不受影响。
      </div>
      <template v-else>
        <div :class="noticeClassName">
          <span>💡 提示：HLS 播放依赖 Media Source Extensions (MSE)，推荐使用
            Chrome、Firefox 或 Edge 浏览器</span>
        </div>
        <div v-if="failed.hls" :class="failureClassName" class="mt-3">
          {{ failureText.hls }}
        </div>
        <div :class="playerWrapperClassName" class="mt-3">
          <VideoPlayer
            :src="hlsSrc"
            :options="hlsPlayerOptions"
            @error="failed.hls = true"
          />
        </div>
      </template>
    </a-card>

    <a-card title="自动循环播放" variant="borderless">
      <div :class="labelClassName">
        静音自动循环播放模式，适合用作背景视频或演示场景
      </div>
      <div v-if="failed.loop" :class="failureClassName" class="mb-3">
        {{ failureText.loop }}
      </div>
      <div :class="playerWrapperClassName">
        <VideoPlayer
          :src="loopSrc"
          :options="loopPlayerOptions"
          @error="failed.loop = true"
        />
      </div>
    </a-card>
  </div>
</template>
