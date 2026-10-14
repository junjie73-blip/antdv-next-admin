<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { Segmented } from '@antdv/common-ui';
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@antdv/shadcn-ui';
import { useAppStore } from '~/stores/modules/app';

import {
  NOTIFICATION_POSITION_OPTIONS,
  TIMEZONE_OPTIONS,
  TRANSITION_OPTIONS,
} from '../constants';
import SettingGroup from './SettingGroup.vue';
import SettingItem from './SettingItem.vue';

defineOptions({ name: 'CommonPanel' });

const appStore = useAppStore();
const { t } = useI18n({ useScope: 'global' });
</script>

<template>
  <div class="space-y-6">
    <!-- ============================================================ -->
    <!-- 时区                                                            -->
    <!-- ============================================================ -->
    <SettingGroup :title="t('preferences.timezone')" icon="carbon:time">
      <SettingItem
        :label="t('preferences.systemTimezone')"
        :desc="t('preferences.systemTimezoneDesc')"
      >
        <Select
          :model-value="appStore.timezone"
          @update:model-value="
            (v: unknown) => appStore.updateSetting({ timezone: String(v) })
          "
        >
          <SelectTrigger class="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="opt in TIMEZONE_OPTIONS"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </SettingItem>
    </SettingGroup>

    <!-- ============================================================ -->
    <!-- 水印                                                            -->
    <!-- ============================================================ -->
    <SettingGroup :title="t('preferences.watermark')" icon="carbon:stamp">
      <SettingItem
        :label="t('preferences.showWatermark')"
        :desc="t('preferences.showWatermarkDesc')"
      >
        <Switch
          :model-value="appStore.enableWatermark"
          @update:model-value="appStore.toggles.enableWatermark"
        />
      </SettingItem>

      <SettingItem
        v-if="appStore.enableWatermark"
        :label="t('preferences.watermarkContent')"
      >
        <Input
          :model-value="appStore.watermarkContent"
          :placeholder="t('preferences.pleaseInput')"
          class="h-8 w-40"
          @update:model-value="
            (v: string | number) => appStore.updateSetting({ watermarkContent: String(v) })
          "
        />
      </SettingItem>
    </SettingGroup>

    <!-- ============================================================ -->
    <!-- 交互效果                                                        -->
    <!-- ============================================================ -->
    <SettingGroup
      :title="t('preferences.interaction')"
      icon="carbon:magic-wand"
    >
      <SettingItem
        :label="t('preferences.waterRipple')"
        :desc="t('preferences.waterRippleDesc')"
      >
        <Switch
          :model-value="appStore.enableWaterRipple"
          @update:model-value="appStore.toggles.enableWaterRipple"
        />
      </SettingItem>

      <SettingItem
        :label="t('preferences.progressBar')"
        :desc="t('preferences.progressBarDesc')"
      >
        <Switch
          :model-value="appStore.showProgressBar"
          @update:model-value="appStore.toggles.showProgressBar"
        />
      </SettingItem>

      <SettingItem
        :label="t('preferences.routeLoading')"
        :desc="t('preferences.routeLoadingDesc')"
      >
        <Switch
          :model-value="appStore.showLoading"
          @update:model-value="appStore.toggles.showLoading"
        />
      </SettingItem>
    </SettingGroup>

    <!-- ============================================================ -->
    <!-- 页面切换动画                                                    -->
    <!-- ============================================================ -->
    <SettingGroup :title="t('preferences.transition')" icon="carbon:flash">
      <SettingItem
        :label="t('preferences.transitionType')"
        :desc="t('preferences.transitionTypeDesc')"
      >
        <Select
          :model-value="appStore.transitionEffect"
          @update:model-value="
            (v: unknown) =>
              appStore.updateSetting({ transitionEffect: String(v) as never })
          "
        >
          <SelectTrigger class="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="opt in TRANSITION_OPTIONS"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </SettingItem>
    </SettingGroup>

    <!-- ============================================================ -->
    <!-- 消息通知                                                        -->
    <!-- ============================================================ -->
    <SettingGroup :title="t('notice.title')" icon="carbon:notification">
      <SettingItem
        :label="t('preferences.notificationPosition')"
        :desc="t('preferences.notificationPositionDesc')"
        stacked
      >
        <Segmented
          :value="appStore.notificationPosition"
          :options="NOTIFICATION_POSITION_OPTIONS"
          size="small"
          block
          @change="
            (v: string | number) =>
              appStore.updateSetting({
                notificationPosition: v as never,
              })
          "
        />
      </SettingItem>
    </SettingGroup>
  </div>
</template>
