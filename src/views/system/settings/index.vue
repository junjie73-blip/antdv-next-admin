<script setup lang="ts">
import PasswordPolicyPanel from "./components/PasswordPolicyPanel.vue";
import SiteInfoPanel from "./components/SiteInfoPanel.vue";
import UploadConfigPanel from "./components/UploadConfigPanel.vue";

defineOptions({ name: "SystemSettings" });
</script>

<template>
  <div class="p-4">
    <a-card :bordered="false">
      <a-tabs>
        <a-tab-pane key="password" tab="密码策略">
          <PasswordPolicyPanel />
        </a-tab-pane>
        <a-tab-pane key="site" tab="网站信息">
          <SiteInfoPanel />
        </a-tab-pane>
        <a-tab-pane key="upload" tab="上传配置">
          <UploadConfigPanel />
        </a-tab-pane>
      </a-tabs>
    </a-card>
  </div>
</template>
