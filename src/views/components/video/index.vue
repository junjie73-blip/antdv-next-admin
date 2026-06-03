<script setup lang="ts">
import { VideoPlayer } from '@videojs-player/vue'
import { cn } from '@/utils/cn'
import 'video.js/dist/video-js.css'
import '@videojs/http-streaming'

const containerClassName = cn('space-y-6')
const labelClassName = cn('text-sm', 'text-gray-500', 'mb-3')
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
)
const playerWrapperClassName = cn(
  'rounded-lg',
  'overflow-hidden',
  'border',
  'border-gray-200',
  'dark:border-gray-700',
)

const mp4Src = 'https://vjs.zencdn.net/v/oceans.mp4'
const mp4Poster = 'https://vjs.zencdn.net/v/oceans.png'

const hlsSrc = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'

const loopSrc = 'https://www.w3schools.com/html/mov_bbb.mp4'

const baseOptions = {
  controls: true,
  fluid: true,
  playbackRates: [0.5, 1, 1.5, 2],
  controlBar: {
    volumePanel: { inline: false },
  },
}

const mp4PlayerOptions = {
  ...baseOptions,
  autoplay: false,
  preload: 'auto',
  poster: mp4Poster,
}

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
}

const loopPlayerOptions = {
  ...baseOptions,
  autoplay: true,
  muted: true,
  loop: true,
  controls: false,
  preload: 'auto',
  poster: mp4Poster,
}
</script>

<template>
  <div :class="containerClassName">
    <a-card
      title="MP4 视频播放"
      variant="borderless"
    >
      <div :class="labelClassName">
        标准 MP4 格式视频，提供完整的播放控制栏，支持倍速播放、画中画等功能
      </div>
      <div :class="playerWrapperClassName">
        <VideoPlayer
          :src="mp4Src"
          :options="mp4PlayerOptions"
        />
      </div>
    </a-card>

    <a-card
      title="HLS 流媒体播放"
      variant="borderless"
    >
      <div :class="labelClassName">
        HLS (m3u8) 自适应码率流媒体视频，可根据网络状况自动切换清晰度
      </div>
      <div :class="noticeClassName">
        <span>💡 提示：HLS 播放依赖 Media Source Extensions (MSE)，推荐使用 Chrome、Firefox 或 Edge 浏览器</span>
      </div>
      <div
        :class="playerWrapperClassName"
        class="mt-3"
      >
        <VideoPlayer
          :src="hlsSrc"
          :options="hlsPlayerOptions"
        />
      </div>
    </a-card>

    <a-card
      title="自动循环播放"
      variant="borderless"
    >
      <div :class="labelClassName">
        静音自动循环播放模式，适合用作背景视频或演示场景
      </div>
      <div :class="playerWrapperClassName">
        <VideoPlayer
          :src="loopSrc"
          :options="loopPlayerOptions"
        />
      </div>
    </a-card>
  </div>
</template>
