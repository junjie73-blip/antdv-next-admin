<script setup lang="ts">
import { Input, Segmented, Select, Switch } from 'antdv-next'

import { useAppStore } from '~/stores/modules/app'

import {
  NOTIFICATION_POSITION_OPTIONS,
  POPUP_CONTAINER,
  sectionStyles,
  TIMEZONE_OPTIONS,
  TRANSITION_OPTIONS,
} from '../constants'
import SettingGroup from './SettingGroup.vue'
import SettingItem from './SettingItem.vue'

defineOptions({ name: 'CommonPanel' })

const appStore = useAppStore()
</script>

<template>
  <div class="space-y-6">
    <!-- ============================================================ -->
    <!-- 时区                                                            -->
    <!-- ============================================================ -->
    <SettingGroup title="时区" icon="carbon:time">
      <SettingItem label="系统时区" desc="影响时间显示">
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
    <SettingGroup title="水印" icon="carbon:watermark">
      <SettingItem label="显示全局水印" desc="覆盖整个管理后台页面">
        <Switch :checked="appStore.enableWatermark" size="small" @change="appStore.toggles.enableWatermark" />
      </SettingItem>

      <SettingItem v-if="appStore.enableWatermark" label="水印内容">
        <Input
          :value="appStore.watermarkContent"
          placeholder="请输入"
          size="small"
          class="!w-40"
          @update:value="(v: string) => appStore.updateSetting({ watermarkContent: v })"
        />
      </SettingItem>
    </SettingGroup>

    <!-- ============================================================ -->
    <!-- 交互效果                                                        -->
    <!-- ============================================================ -->
    <SettingGroup title="交互效果" icon="carbon:magic-wand">
      <SettingItem label="水波纹效果" desc="按钮点击涟漪反馈">
        <Switch :checked="appStore.enableWaterRipple" size="small" @change="appStore.toggles.enableWaterRipple" />
      </SettingItem>

      <SettingItem label="页面切换进度条" desc="顶部 NProgress 进度条">
        <Switch :checked="appStore.showProgressBar" size="small" @change="appStore.toggles.showProgressBar" />
      </SettingItem>

      <SettingItem label="页面切换 Loading" desc="路由跳转加载动画">
        <Switch :checked="appStore.showLoading" size="small" @change="appStore.toggles.showLoading" />
      </SettingItem>
    </SettingGroup>

    <!-- ============================================================ -->
    <!-- 页面切换动画                                                    -->
    <!-- ============================================================ -->
    <SettingGroup title="页面切换动画" icon="carbon:animation">
      <SettingItem label="动画类型" desc="基于 VueUse Motion 库实现">
        <Select
          :value="appStore.transitionEffect"
          :options="TRANSITION_OPTIONS"
          size="small"
          class="!w-40"
          :get-popup-container="POPUP_CONTAINER"
          @change="(v: string) => appStore.updateSetting({ transitionEffect: v as never })"
        />
      </SettingItem>
    </SettingGroup>

    <!-- ============================================================ -->
    <!-- 消息通知                                                        -->
    <!-- ============================================================ -->
    <SettingGroup title="消息通知" icon="carbon:notification">
      <SettingItem label="通知位置" desc="全局消息弹出位置">
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
