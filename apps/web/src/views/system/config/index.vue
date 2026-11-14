<script setup lang="ts">
import type { ConfigField, ConfigPanel, ConfigValues } from '~/api/monitor';

import { computed, onMounted, ref } from 'vue';

import {
  Alert,
  Card,
  PageHeader,
  Popconfirm,
  Segmented,
} from '@antdv/common-ui';
import { message } from '@antdv/popup-ui';
import { Button, Input, Switch } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { Icon } from '@iconify/vue';
import {
  getSystemConfig,
  resetSystemConfig,
  saveSystemConfig,
} from '~/api/monitor';
import { unwrapApi } from '~/utils/log-format';

import AsyncState from '../components/AsyncState.vue';
import SettingsPanel from '../components/SettingsPanel.vue';

/**
 * 系统配置：左侧七个面板 + 右侧按定义渲染的表单。
 *
 * 字段定义与默认值都来自 backend-mock 的 `/system/config/list`，页面不硬编码
 * 任何运营配置项；保存与恢复默认走真实接口，提交期间按钮即刻上锁，finally 对称释放。
 */
defineOptions({ name: 'SystemConfig' });

const containerClassName = cn('space-y-4');
const cardClassName = cn('shadow-sm');
const layoutClassName = cn(
  'grid grid-cols-1 gap-4 lg:grid-cols-[240px_minmax(0,1fr)]',
);
const navClassName = cn('flex flex-col gap-1');
const navButtonClassName = cn('justify-start');
const fieldGridClassName = cn('grid grid-cols-1 gap-4 md:grid-cols-2');
const fieldLabelClassName = cn(
  'text-muted-foreground mb-1.5 block text-xs font-medium',
);
const fieldControlClassName = cn('w-full');
const footerClassName = cn(
  'border-border mt-6 flex items-center justify-between gap-3 border-t pt-4',
);
const hintClassName = cn('text-muted-foreground text-xs');

const panels = ref<ConfigPanel[]>([]);
const draft = ref<ConfigValues>({});
const activeKey = ref('');
const loading = ref(false);
const error = ref('');
const saving = ref(false);
const resetting = ref(false);

const activePanel = computed(
  () => panels.value.find((item) => item.key === activeKey.value) ?? null,
);
const busy = computed(() => saving.value || resetting.value);

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const res = await getSystemConfig();
    const data = unwrapApi<null | {
      panels: ConfigPanel[];
      values: ConfigValues;
    }>(res);
    // 「系统设置」的键值型 CRUD 抽成可复用组件 SettingsPanel，作为本页的第八个
    // 面板嵌入，使 系统配置 / 系统设置 两类运营参数在同一入口维护，消除重复菜单项。
    panels.value = [
      ...(data?.panels ?? []),
      {
        key: 'settings',
        title: '参数设置',
        icon: 'carbon:settings',
        description: '键值型运营参数，集中在这里维护系统开关与扩展配置',
        fields: [],
      },
    ];
    draft.value = structuredClone(data?.values ?? {});
    if (!panels.value.some((item) => item.key === activeKey.value)) {
      activeKey.value = panels.value[0]?.key ?? '';
    }
  } catch (error) {
    error.value =
      error instanceof Error ? error.message : '系统配置接口暂不可用';
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function setValue(field: ConfigField, raw: unknown) {
  const key = activeKey.value;
  if (!key) return;
  const current = { ...draft.value[key] };
  if (field.type === 'switch') current[field.key] = Boolean(raw);
  else if (field.type === 'number') current[field.key] = Number(raw) || 0;
  else current[field.key] = String(raw ?? '');
  draft.value = { ...draft.value, [key]: current };
}

function valueOf(field: ConfigField): boolean | number | string {
  const value = draft.value[activeKey.value]?.[field.key];
  if (field.type === 'switch') return Boolean(value);
  if (field.type === 'number') return Number(value ?? 0);
  return String(value ?? '');
}

async function handleSave() {
  if (!activePanel.value || busy.value) return;
  const panel = activePanel.value;
  saving.value = true;
  try {
    await saveSystemConfig({
      panel: panel.key,
      values: draft.value[panel.key] ?? {},
    });
    message.success(`${panel.title}已保存`);
  } catch (error) {
    message.error(
      error instanceof Error ? error.message : '保存失败，请稍后重试',
    );
  } finally {
    saving.value = false;
  }
}

async function handleReset() {
  if (!activePanel.value || busy.value) return;
  const panel = activePanel.value;
  resetting.value = true;
  try {
    const res = await resetSystemConfig({ panel: panel.key });
    const payload = unwrapApi<null | {
      values?: Record<string, boolean | number | string>;
    }>(res);
    draft.value = { ...draft.value, [panel.key]: payload?.values ?? {} };
    message.success(`${panel.title}已恢复默认`);
  } catch (error) {
    message.error(
      error instanceof Error ? error.message : '恢复默认失败，请稍后重试',
    );
  } finally {
    resetting.value = false;
  }
}
</script>

<template>
  <div data-page-view :class="containerClassName">
    <PageHeader
      title="系统配置"
      description="站点、安全、登录、邮件、短信、存储与客户端七类配置，按面板分组维护"
      icon="carbon:settings-adjust"
    />

    <AsyncState
      :loading="loading"
      :error="error"
      :empty="!loading && panels.length === 0"
      empty-text="暂无可配置面板"
      @retry="load"
    >
      <div :class="layoutClassName">
        <Card title="配置分类" :class="cardClassName">
          <nav :class="navClassName" aria-label="配置分类">
            <Button
              v-for="panel in panels"
              :key="panel.key"
              :variant="panel.key === activeKey ? 'default' : 'ghost'"
              size="sm"
              :class="navButtonClassName"
              @click="activeKey = panel.key"
            >
              <Icon :icon="panel.icon" />
              {{ panel.title }}
            </Button>
          </nav>
        </Card>

        <Card :class="cardClassName">
          <SettingsPanel v-if="activePanel?.key === 'settings'" />
          <template v-else-if="activePanel">
            <div class="flex items-start gap-3">
              <Icon
                :icon="activePanel.icon"
                class="mt-0.5 text-xl text-primary"
              />
              <div>
                <p class="text-sm font-medium text-foreground">
                  {{ activePanel.title }}
                </p>
                <p :class="hintClassName">
                  {{ activePanel.description }} · 共
                  {{ activePanel.fields.length }} 项
                </p>
              </div>
            </div>

            <div :class="fieldGridClassName" class="mt-5">
              <div v-for="field in activePanel.fields" :key="field.key">
                <label :class="fieldLabelClassName" :for="`cfg-${field.key}`">{{
                  field.label
                }}</label>

                <Switch
                  v-if="field.type === 'switch'"
                  :model-value="Boolean(valueOf(field))"
                  :disabled="busy"
                  @update:model-value="(v: boolean) => setValue(field, v)"
                />

                <Segmented
                  v-else-if="field.type === 'select'"
                  :value="String(valueOf(field))"
                  :options="field.options ?? []"
                  size="small"
                  @update:value="(v: string | number) => setValue(field, v)"
                />

                <Input
                  v-else
                  :id="`cfg-${field.key}`"
                  :class="fieldControlClassName"
                  :type="
                    field.type === 'password'
                      ? 'password'
                      : field.type === 'number'
                        ? 'number'
                        : 'text'
                  "
                  :model-value="String(valueOf(field))"
                  :placeholder="field.placeholder ?? `请输入${field.label}`"
                  :disabled="busy"
                  @update:model-value="
                    (v: string | number) => setValue(field, v)
                  "
                />
              </div>
            </div>

            <div :class="footerClassName">
              <Alert
                type="info"
                show-icon
                message="配置保存在 mock 服务内存中，重启后回到默认值；切换面板不会丢失当前编辑内容。"
              />
              <div class="flex shrink-0 items-center gap-2">
                <Popconfirm
                  title="恢复当前面板的默认配置？"
                  danger
                  @confirm="handleReset"
                >
                  <Button variant="outline" :disabled="busy">
                    <Icon icon="carbon:reset" />
                    恢复默认
                  </Button>
                </Popconfirm>
                <Button :disabled="busy" @click="handleSave">
                  <Icon
                    :icon="busy ? 'carbon:circle-dash' : 'carbon:save'"
                    :class="busy ? 'animate-spin' : ''"
                  />
                  {{ saving ? '保存中' : '保存配置' }}
                </Button>
              </div>
            </div>
          </template>
          <p v-else :class="hintClassName">请从左侧选择一个配置面板。</p>
        </Card>
      </div>
    </AsyncState>
  </div>
</template>
