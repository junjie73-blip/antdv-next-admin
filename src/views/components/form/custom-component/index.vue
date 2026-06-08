<script setup lang="ts">
import { ref } from 'vue'
import { cn } from '@/utils/cn'

const containerClassName = cn('space-y-6')

const cardTitle = ref('Custom component example')

const formData = ref({
  username: '',
  password: '',
  tags: [] as string[],
  color: '#1677ff',
  sliderValue: 50,
  switchValue: false,
  rateValue: 3,
})

const tagInputValue = ref('')

function addTag() {
  if (tagInputValue.value.trim()) {
    formData.value.tags = [...formData.value.tags, tagInputValue.value.trim()]
    tagInputValue.value = ''
  }
}

function removeTag(index: number) {
  formData.value.tags = formData.value.tags.filter((_, i) => i !== index)
}

const colorPresets = ['#1677ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1', '#13c2c2']

function handleSubmit() {
  message.success('Form submitted successfully')
}
</script>

<template>
  <div :class="containerClassName">
    <a-card
      :title="cardTitle"
      variant="borderless"
    >
      <a-form
        :model="formData"
        layout="vertical"
      >
        <a-form-item label="Color Picker">
          <a-space>
            <a-input
              v-model:value="formData.color"
              type="color"
              style="width: 60px; height: 40px; padding: 4px; cursor: pointer"
            />
            <span class="text-gray-600">{{ formData.color }}</span>
          </a-space>
          <div class="mt-2 flex gap-1">
            <button
              v-for="preset in colorPresets"
              :key="preset"
              class="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 cursor-pointer"
              :class="formData.color === preset ? 'border-gray-800 dark:border-white' : 'border-transparent'"
              :style="{ backgroundColor: preset }"
              @click="formData.color = preset"
            />
          </div>
        </a-form-item>

        <a-form-item label="Tags Input">
          <a-space>
            <a-input
              v-model:value="tagInputValue"
              placeholder="Enter tag and press Add"
              style="width: 200px"
              @pressEnter="addTag"
            />
            <a-button
              size="small"
              @click="addTag"
            >
              Add
            </a-button>
          </a-space>
          <div class="mt-2 flex flex-wrap gap-1">
            <a-tag
              v-for="(tag, index) in formData.tags"
              :key="index"
              closable
              @close="removeTag(index)"
            >
              {{ tag }}
            </a-tag>
          </div>
        </a-form-item>

        <a-form-item label="Rate">
          <a-rate v-model:value="formData.rateValue" />
          <span class="ml-2 text-gray-500">{{ formData.rateValue }} / 5</span>
        </a-form-item>

        <a-form-item label="Slider">
          <a-slider v-model:value="formData.sliderValue" />
          <span class="ml-2 text-gray-500">{{ formData.sliderValue }}</span>
        </a-form-item>

        <a-form-item label="Switch">
          <a-switch v-model:checked="formData.switchValue" />
          <span
            class="ml-2"
            :class="formData.switchValue ? 'text-green-600' : 'text-gray-400'"
          >
            {{ formData.switchValue ? 'Enabled' : 'Disabled' }}
          </span>
        </a-form-item>

        <a-form-item>
          <a-button
            type="primary"
            @click="handleSubmit"
          >
            Submit
          </a-button>
        </a-form-item>
      </a-form>
    </a-card>
  </div>
</template>
