<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import {
  Input,
  NumberField,
  NumberFieldContent,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Switch,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared';
import { Icon } from '@iconify/vue';
import ThemeToggle from '~/layouts/widgets/ThemeToggle.vue';
import { useAppStore } from '~/stores/modules/app';

import { parseColor, toHex, toRgbString } from '@antdv/shared/color';
import { BORDER_RADIUS_OPTIONS, PRIMARY_COLORS } from '../constants';
import SettingGroup from './SettingGroup.vue';
import SettingItem from './SettingItem.vue';

defineOptions({ name: 'AppearancePanel' });
const appStore = useAppStore();
const { t } = useI18n({ useScope: 'global' });

function isColorActive(color: string): boolean {
  return appStore.primaryColor?.toLowerCase() === color.toLowerCase();
}

const isPresetColor = computed(() => {
  const cur = appStore.primaryColor?.toLowerCase();
  if (!cur) return false;
  return PRIMARY_COLORS.some((c) => c.value.toLowerCase() === cur);
});
function handleColorSelect(color: string) {
  appStore.updateSetting({ primaryColor: color });
}

/**
 * 取色器写回 rgb 串（见 `../color`），输入框里的十六进制只是个中间态。
 */
const hexColor = ref(toHex(appStore.primaryColor));

function applyCustomColor(value: string) {
  const rgb = parseColor(value);
  if (!rgb) return;
  hexColor.value = toHex(value);
  appStore.updateSetting({ primaryColor: toRgbString(rgb) });
}
</script>

<template>
  <div class="space-y-6">
    <SettingGroup :title="t('preferences.themeMode')" icon="carbon:contrast">
      <ThemeToggle />

      <SettingItem
        :label="t('preferences.darkSidebar')"
        :desc="t('preferences.darkSidebarDesc')"
        class="mt-4"
      >
        <Switch
          :model-value="appStore.darkSidebar"
          @update:model-value="appStore.toggles.darkSidebar"
        />
      </SettingItem>

      <SettingItem
        :label="t('preferences.darkHeader')"
        :desc="t('preferences.darkHeaderDesc')"
      >
        <Switch
          :model-value="appStore.darkHeader"
          @update:model-value="appStore.toggles.darkHeader"
        />
      </SettingItem>
    </SettingGroup>

    <SettingGroup
      :title="t('preferences.primaryColor')"
      icon="carbon:color-palette"
    >
      <div class="grid grid-cols-3 gap-2.5">
        <!-- 预设色 -->
        <button
          v-for="opt in PRIMARY_COLORS"
          :key="opt.value"
          type="button"
          :class="
            cn(
              'group relative flex flex-col items-center gap-2 rounded-lg border-2 bg-white p-2 transition-all duration-200',
              'dark:bg-slate-800',
              isColorActive(opt.value)
                ? 'border-ant-primary'
                : 'hover:border-ant-primary/40 border-slate-200 dark:border-slate-700',
            )
          "
          @click="handleColorSelect(opt.value)"
        >
          <!-- 色块 -->
          <div
            class="h-8 w-12 rounded-md transition-transform duration-200 group-hover:scale-105"
            :style="{ backgroundColor: opt.value }"
          ></div>

          <!-- 名称 -->
          <span
            :class="
              cn(
                'text-[11px] leading-none',
                isColorActive(opt.value)
                  ? 'text-ant-primary font-medium'
                  : 'text-slate-500 dark:text-slate-400',
              )
            "
          >
            {{ opt.label }}
          </span>
        </button>

        <Popover>
          <PopoverTrigger as-child>
            <button
              type="button"
              :class="
                cn(
                  'group relative flex flex-col items-center gap-2 rounded-lg border-2 bg-white p-2 transition-all duration-200',
                  'cursor-pointer dark:bg-slate-800',
                  !isPresetColor
                    ? 'border-ant-primary'
                    : 'hover:border-ant-primary/40 border-slate-200 dark:border-slate-700',
                )
              "
            >
              <!-- 非预设色时显示当前色，否则显示图标 -->
              <div
                v-if="!isPresetColor"
                class="h-8 w-12 rounded-md transition-transform duration-200 group-hover:scale-105"
                :style="{ backgroundColor: appStore.primaryColor }"
              ></div>
              <div
                v-else
                class="flex h-8 w-12 items-center justify-center rounded-md bg-slate-100 transition-transform duration-200 group-hover:scale-105 dark:bg-slate-700"
              >
                <Icon
                  icon="carbon:color-palette"
                  class="text-base text-slate-500 dark:text-slate-400"
                />
              </div>

              <span
                :class="
                  cn(
                    'text-[11px] leading-none',
                    !isPresetColor
                      ? 'text-ant-primary font-medium'
                      : 'text-slate-500 dark:text-slate-400',
                  )
                "
              >
                {{ t('preferences.custom') }}
              </span>
            </button>
          </PopoverTrigger>

          <PopoverContent align="start" :side-offset="6" class="w-60 gap-3">
            <div class="text-[13px] font-medium">
              {{ t('preferences.custom') }}
            </div>
            <input
              :value="hexColor"
              type="color"
              class="h-9 w-full cursor-pointer rounded-md border border-slate-200 bg-transparent p-1 dark:border-slate-700"
              @input="
                applyCustomColor(($event.target as HTMLInputElement).value)
              "
            />
            <Input
              v-model="hexColor"
              type="text"
              class="h-8"
              placeholder="#1677FF"
              @keyup.enter="applyCustomColor(hexColor)"
              @blur="applyCustomColor(hexColor)"
            />
          </PopoverContent>
        </Popover>
      </div>
    </SettingGroup>

    <!-- ============================================================ -->
    <!-- 圆角 + 字号                                                    -->
    <!-- ============================================================ -->
    <SettingGroup :title="t('preferences.radiusAndFont')" icon="carbon:ruler">
      <!-- ⭐ 圆角：上下布局 -->
      <div
        class="rounded-xl bg-white p-3 outline outline-1 outline-slate-200 dark:bg-slate-800 dark:outline-slate-700"
      >
        <div class="mb-2.5">
          <div
            class="text-[13px] font-medium text-slate-700 dark:text-slate-200"
          >
            {{ t('preferences.borderRadius') }}
          </div>
          <div class="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
            {{ t('preferences.borderRadiusDesc') }}
          </div>
        </div>

        <div class="grid grid-cols-5 gap-1.5">
          <button
            v-for="opt in BORDER_RADIUS_OPTIONS"
            :key="opt.value"
            type="button"
            class="h-8 rounded-md text-xs font-medium transition-all duration-200"
            :class="
              appStore.borderRadius === opt.value
                ? 'bg-ant-primary text-white shadow-sm'
                : 'hover:outline-ant-primary/40 bg-slate-50 text-slate-600 outline outline-1 outline-slate-200 hover:bg-slate-100 dark:bg-slate-700 dark:text-slate-300 dark:outline-slate-600'
            "
            @click="appStore.updateSetting({ borderRadius: opt.value })"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <!-- 字号：保持左右布局 -->
      <SettingItem
        :label="t('preferences.fontSize')"
        :desc="t('preferences.fontSizeDesc')"
      >
        <NumberField
          :model-value="appStore.fontSize"
          :min="12"
          :max="18"
          :step="1"
          class="w-24"
          @update:model-value="
            (v: number | undefined) =>
              v !== undefined && appStore.updateSetting({ fontSize: v })
          "
        >
          <NumberFieldContent>
            <NumberFieldDecrement />
            <NumberFieldInput class="h-8" />
            <NumberFieldIncrement />
          </NumberFieldContent>
        </NumberField>
      </SettingItem>
    </SettingGroup>

    <SettingGroup :title="t('preferences.other')" icon="carbon:settings-adjust">
      <SettingItem
        :label="t('preferences.colorWeak')"
        :desc="t('preferences.colorWeakDesc')"
      >
        <Switch
          :model-value="appStore.colorWeak"
          @update:model-value="appStore.toggles.colorWeak"
        />
      </SettingItem>

      <SettingItem
        :label="t('preferences.grayMode')"
        :desc="t('preferences.grayModeDesc')"
      >
        <Switch
          :model-value="appStore.grayMode"
          @update:model-value="appStore.toggles.grayMode"
        />
      </SettingItem>
    </SettingGroup>
  </div>
</template>
