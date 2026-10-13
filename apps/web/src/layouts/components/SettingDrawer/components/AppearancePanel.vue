<script setup lang="ts">
import type { Color, ColorPickerProps } from 'antdv-next';

import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { cn } from '@antdv/shared';
import { Icon } from '@iconify/vue';
import { InputNumber as AInputNumber, Switch as ASwitch, ColorPicker } from 'antdv-next';
import { useThemeTransition } from '~/composables/web/useThemeTransition';
import ThemeToggle from '~/layouts/widgets/ThemeToggle.vue';
import { useAppStore } from '~/stores/modules/app';

import {
  BORDER_RADIUS_OPTIONS,
  PRIMARY_COLORS,
  sectionStyles,
  THEME_MODE_OPTIONS,
} from '../constants';
import SettingGroup from './SettingGroup.vue';
import SettingItem from './SettingItem.vue';

defineOptions({ name: 'AppearancePanel' });
const appStore = useAppStore();
const { t } = useI18n({ useScope: 'global' });
const { toggleThemeWithAnimation } = useThemeTransition();
const color_presets = computed<ColorPickerProps['presets']>(() => [
  {
    label: t('preferences.recommended'),
    colors: PRIMARY_COLORS.map((c) => c.value),
  },
]);
const customColor = ref(appStore.primaryColor || '#1677ff');
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
function handleThemeModeChange(mode: number | string, event?: MouseEvent) {
  if (mode === appStore.themeMode) return;
  toggleThemeWithAnimation(event);
}
const handleChangeColor = (color: Color) => {
  appStore.updateSetting({ primaryColor: color.toRgbString() });
};
</script>

<template>
  <div class="space-y-6">
    <SettingGroup :title="t('preferences.themeMode')" icon="carbon:contrast">
      <ThemeToggle
        :value="appStore.themeMode"
        :options="THEME_MODE_OPTIONS"
        :styles="sectionStyles"
        block
        @change="handleThemeModeChange"
      />

      <SettingItem
        :label="t('preferences.darkSidebar')"
        :desc="t('preferences.darkSidebarDesc')"
        class="mt-4"
      >
        <ASwitch
          :checked="appStore.darkSidebar"
          size="small"
          @change="appStore.toggles.darkSidebar"
        />
      </SettingItem>

      <SettingItem
        :label="t('preferences.darkHeader')"
        :desc="t('preferences.darkHeaderDesc')"
      >
        <ASwitch
          :checked="appStore.darkHeader"
          size="small"
          @change="appStore.toggles.darkHeader"
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

        <ColorPicker
          v-model:value="customColor"
          :presets="color_presets"
          class="w-full"
          @change-complete="handleChangeColor"
        >
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
        </ColorPicker>
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
        <AInputNumber
          :value="appStore.fontSize"
          :min="12"
          :max="18"
          :step="1"
          size="small"
          class="!w-24"
          @change="
            (v: number | null) =>
              v !== null && appStore.updateSetting({ fontSize: v })
          "
        />
      </SettingItem>
    </SettingGroup>

    <SettingGroup :title="t('preferences.other')" icon="carbon:settings-adjust">
      <SettingItem
        :label="t('preferences.colorWeak')"
        :desc="t('preferences.colorWeakDesc')"
      >
        <ASwitch
          :checked="appStore.colorWeak"
          size="small"
          @change="appStore.toggles.colorWeak"
        />
      </SettingItem>

      <SettingItem
        :label="t('preferences.grayMode')"
        :desc="t('preferences.grayModeDesc')"
      >
        <ASwitch
          :checked="appStore.grayMode"
          size="small"
          @change="appStore.toggles.grayMode"
        />
      </SettingItem>
    </SettingGroup>
  </div>
</template>
