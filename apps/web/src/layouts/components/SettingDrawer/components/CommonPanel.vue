<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { Input, Segmented, Select, Switch } from 'antdv-next';
import { useAppStore } from '~/stores/modules/app';

import {
  NOTIFICATION_POSITION_OPTIONS,
  POPUP_CONTAINER,
  sectionStyles,
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
          :value="appStore.timezone"
          :options="TIMEZONE_OPTIONS"
          size="small"
          class="!w-48"
          :get-popup-container="POPUP_CONTAINER"
          @change="(v: string) => appStore.updateSetting({ timezone: v })"
        />
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
          :checked="appStore.enableWatermark"
          size="small"
          @change="appStore.toggles.enableWatermark"
        />
      </SettingItem>

      <SettingItem
        v-if="appStore.enableWatermark"
        :label="t('preferences.watermarkContent')"
      >
        <Input
          :value="appStore.watermarkContent"
          :placeholder="t('preferences.pleaseInput')"
          size="small"
          class="!w-40"
          @update:value="
            (v: string) => appStore.updateSetting({ watermarkContent: v })
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
          :checked="appStore.enableWaterRipple"
          size="small"
          @change="appStore.toggles.enableWaterRipple"
        />
      </SettingItem>

      <SettingItem
        :label="t('preferences.progressBar')"
        :desc="t('preferences.progressBarDesc')"
      >
        <Switch
          :checked="appStore.showProgressBar"
          size="small"
          @change="appStore.toggles.showProgressBar"
        />
      </SettingItem>

      <SettingItem
        :label="t('preferences.routeLoading')"
        :desc="t('preferences.routeLoadingDesc')"
      >
        <Switch
          :checked="appStore.showLoading"
          size="small"
          @change="appStore.toggles.showLoading"
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
          :value="appStore.transitionEffect"
          :options="TRANSITION_OPTIONS"
          size="small"
          class="!w-40"
          :get-popup-container="POPUP_CONTAINER"
          @change="
            (v: string) =>
              appStore.updateSetting({ transitionEffect: v as never })
          "
        />
      </SettingItem>
    </SettingGroup>

    <!-- ============================================================ -->
    <!-- 消息通知                                                        -->
    <!-- ============================================================ -->
    <SettingGroup :title="t('notice.title')" icon="carbon:notification">
      <SettingItem
        :label="t('preferences.notificationPosition')"
        :desc="t('preferences.notificationPositionDesc')"
      >
        <Segmented
          :value="appStore.notificationPosition"
          :options="NOTIFICATION_POSITION_OPTIONS"
          :styles="sectionStyles"
          size="small"
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
