<script setup lang="ts">
import { ref } from 'vue'

import { cn } from '~/utils/cn'

const containerClassName = cn('space-y-6')
const scrollContentClassName = cn('p-4 rounded-lg bg-gray-50 dark:bg-gray-800')

const basicItems = Array.from({ length: 30 }, (_, i) => ({
  id: i + 1,
  title: `Item ${i + 1}`,
  desc: `Description for item ${i + 1}`,
}))

const horizontalItems = ['Vue', 'React', 'Angular', 'Svelte', 'Solid', 'Qwik', 'Astro', 'Nuxt', 'Next.js', 'Remix']

const chatMessages = ref([
  { id: 1, text: 'Hello, how are you?', time: '10:30', self: false },
  { id: 2, text: 'I am fine, thank you! What about you?', time: '10:31', self: true },
  { id: 3, text: 'Great! Working on a new project.', time: '10:32', self: false },
  { id: 4, text: 'That sounds exciting! What kind of project?', time: '10:33', self: true },
  { id: 5, text: 'A Vue 3 admin system with antdv-next.', time: '10:34', self: false },
  {
    id: 6,
    text: 'Using Scrollbar component for smooth scrolling.',
    time: '10:35',
    self: true,
  },
  { id: 7, text: 'The performance is really good!', time: '10:36', self: false },
  { id: 8, text: 'Glad to hear that. Keep up the good work!', time: '10:37', self: true },
])

const newMessage = ref('')

function sendMessage() {
  if (!newMessage.value.trim()) return
  chatMessages.value.push({
    id: Date.now(),
    text: newMessage.value.trim(),
    time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    self: true,
  })
  newMessage.value = ''
}
</script>

<template>
  <div :class="containerClassName">
    <a-card title="Basic Scroll" variant="borderless">
      <div class="space-y-4">
        <a-button
          @click="
            basicItems.push({
              id: basicItems.length + 1,
              title: `New Item ${basicItems.length + 1}`,
              desc: 'Newly added item',
            })
          "
        >
          Add Item
        </a-button>
        <div
          class="h-80 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700"
          :class="scrollContentClassName"
        >
          <Scrollbar>
            <div
              v-for="item in basicItems"
              :key="item.id"
              class="flex items-center gap-3 border-b border-gray-100 px-4 py-2.5 last:border-0 dark:border-gray-700"
            >
              <span
                class="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
              >
                {{ item.id }}
              </span>
              <div>
                <p class="font-medium text-gray-800 dark:text-gray-200">
                  {{ item.title }}
                </p>
                <p class="text-xs text-gray-500">
                  {{ item.desc }}
                </p>
              </div>
            </div>
          </Scrollbar>
        </div>
      </div>
    </a-card>

    <a-card title="Horizontal Scroll" variant="borderless">
      <div class="h-32 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
        <Scrollbar>
          <div class="flex min-w-max gap-3 p-4">
            <div
              v-for="(item, index) in horizontalItems"
              :key="item"
              class="flex h-20 w-28 cursor-pointer flex-col items-center justify-center rounded-lg border border-gray-200 bg-white transition-all hover:border-blue-400 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800"
            >
              <span class="text-lg font-semibold text-gray-800 dark:text-gray-200">{{ item }}</span>
              <span class="mt-1 text-xs text-gray-400">#{{ index + 1 }}</span>
            </div>
          </div>
        </Scrollbar>
      </div>
    </a-card>

    <a-card title="Chat Scroll" variant="borderless">
      <div class="space-y-3">
        <div class="flex h-80 flex-col overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
          <Scrollbar class="flex-1 p-4">
            <div
              v-for="msg in chatMessages"
              :key="msg.id"
              class="mb-3 flex"
              :class="[msg.self ? 'justify-end' : 'justify-start']"
            >
              <div
                class="max-w-[70%] rounded-2xl px-4 py-2 text-sm"
                :class="[
                  msg.self
                    ? 'rounded-br-md bg-blue-500 text-white'
                    : 'rounded-bl-md bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
                ]"
              >
                {{ msg.text }}
                <div class="mt-1 text-xs" :class="[msg.self ? 'text-blue-100' : 'text-gray-400']">
                  {{ msg.time }}
                </div>
              </div>
            </div>
          </Scrollbar>
          <div class="flex gap-2 border-t border-gray-200 p-3 dark:border-gray-700">
            <a-input v-model:value="newMessage" placeholder="Type a message..." @pressEnter="sendMessage" />
            <a-button type="primary" @click="sendMessage"> Send </a-button>
          </div>
        </div>
      </div>
    </a-card>
  </div>
</template>
