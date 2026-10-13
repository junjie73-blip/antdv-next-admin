<script setup lang="ts">
import { computed, ref } from 'vue';

import { cn } from '@antdv/shared/cn';
import { Alert as AAlert, Button as AButton, Card as ACard, Input as AInput, Space as ASpace, message } from 'antdv-next';
import cronstrue from 'cronstrue';
import CronEditor from '~/components/common/CronEditor/index.vue';

import 'cronstrue/locales/zh_CN';

/** check() 的返回结构：可读描述 + 校验错误（二者互斥） */
interface CronCheck {
  text: string;
  error: string;
}

// 根容器无内边距，仅负责纵向间距
const containerClassName = cn('space-y-6');
const hintClassName = cn('mb-4', 'text-sm', 'leading-relaxed', 'text-gray-500');
const resultBoxClassName = cn(
  'mt-4',
  'rounded-lg',
  'border',
  'border-gray-200',
  'bg-gray-50',
  'p-3',
);
const exprCodeClassName = cn(
  'rounded-sm',
  'bg-blue-50',
  'px-2',
  'py-0.5',
  'font-mono',
  'text-sm',
  'text-blue-700',
);
const descClassName = cn('text-sm', 'text-gray-700');
const presetRowClassName = cn('mb-4', 'flex', 'flex-wrap', 'gap-2');
const fieldListClassName = cn('flex', 'flex-wrap', 'gap-x-6', 'gap-y-2');
const fieldItemClassName = cn('flex', 'items-center', 'gap-1', 'text-sm');
const fieldKeyClassName = cn('text-gray-500');
const fieldValueClassName = cn('font-mono', 'font-medium', 'text-gray-800');

/**
 * 解析并生成中文描述。cronstrue 对非法表达式会 throw，这里统一兜底成
 * { text, error }，让调用方既能拿到可读描述，也能拿到校验错误。
 */
function check(expr: string): CronCheck {
  if (!expr || !expr.trim()) {
    return { text: '', error: '表达式为空' };
  }
  try {
    return { text: cronstrue.toString(expr, { locale: 'zh_CN' }), error: '' };
  } catch (error) {
    return {
      text: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ========== 1. 基础用法 ==========
const basicExpr = ref('0 */5 * * * *');
const basicCheck = computed(() => check(basicExpr.value));
function onBasicChange(value: string) {
  const { error } = check(value);
  if (error) {
    message.warning(`当前表达式无法解析：${error}`);
  }
}

// ========== 2. 预设表达式 ==========
const presetExpr = ref('0 * * * * *');
const presetCheck = computed(() => check(presetExpr.value));
const presets = [
  { label: '每分钟', value: '0 * * * * *' },
  { label: '每 5 分钟', value: '0 */5 * * * *' },
  { label: '每小时', value: '0 0 * * * *' },
  { label: '每天 0 点', value: '0 0 0 * * *' },
  { label: '每周一 9 点', value: '0 0 9 * * 1' },
  { label: '每月 1 号', value: '0 0 0 1 * *' },
];
function applyPreset(preset: { label: string; value: string }) {
  const { text, error } = check(preset.value);
  if (error) {
    message.warning(`预设「${preset.label}」表达式无效：${error}`);
    return;
  }
  presetExpr.value = preset.value;
  message.success(`已应用「${preset.label}」：${text}`);
}
function onPresetChange(value: string) {
  const { error } = check(value);
  if (error) {
    message.warning(`当前表达式无法解析：${error}`);
  }
}

// ========== 3. 校验与回显 ==========
// appliedExpr 是「受控」值（真正生效、并回显给编辑器）；draftExpr 是输入框里的草稿（非受控编辑）。
const appliedExpr = ref('0 0 0 * * *');
const draftExpr = ref('0 0 0 * * *');
const draftCheck = computed(() => check(draftExpr.value));
const appliedCheck = computed(() => check(appliedExpr.value));
function applyDraft() {
  const { text, error } = check(draftExpr.value);
  if (error) {
    message.error(`表达式无效，未应用：${error}`);
    return;
  }
  appliedExpr.value = draftExpr.value.trim();
  message.success(`已应用生效表达式，描述：${text}`);
}
function resetDraft() {
  draftExpr.value = appliedExpr.value;
  message.info('已丢弃草稿，重置为当前生效的表达式');
}
// 通过编辑器自身修改时，让草稿与生效值保持同步
function onAppliedChange(value: string) {
  draftExpr.value = value;
}

// ========== 4. 描述预览 ==========
// 说明：本项目仅安装了 cronstrue（只能生成文字描述），没有可计算「下次运行时间」的调度库，
// 也没有真实后端，因此这里诚实展示表达式的字段解析 + 文字描述预览，而不是伪造一份运行时间表。
const previewExpr = ref('0 0 9 * * 1');
const previewCheck = computed(() => check(previewExpr.value));
const previewFields = computed<Array<[string, string]>>(() => {
  const parts = previewExpr.value.trim().split(/\s+/);
  if (parts.length === 5) {
    const [, mi, h, dom, mon, dow] = parts;
    return [
      ['分', mi],
      ['时', h],
      ['日', dom],
      ['月', mon],
      ['周', dow],
    ];
  }
  if (parts.length >= 6) {
    const [, s, mi, h, dom, mon, dow] = parts;
    return [
      ['秒', s],
      ['分', mi],
      ['时', h],
      ['日', dom],
      ['月', mon],
      ['周', dow],
    ];
  }
  return [];
});
</script>

<template>
  <div :class="containerClassName">
    <!-- 1. 基础用法 -->
    <ACard title="基础用法" variant="borderless">
      <p :class="hintClassName">
        页面级的表达式字符串通过 <code>v-model</code> 双向绑定内置的
        <code>CronEditor</code> 组件；组件的
        <code>modelValue</code> 一旦变化（无论来自预设还是自定义字段），
        下方描述由
        <code>cronstrue.toString(expr)</code>
        实时重算。试试切换编辑器里的「常用预设 / 自定义」按钮。
      </p>
      <CronEditor v-model="basicExpr" @change="onBasicChange" />
      <div :class="resultBoxClassName">
        <div :class="descClassName">
          当前表达式：<span :class="exprCodeClassName">{{
            basicExpr || '（空）'
          }}</span>
        </div>
        <p v-if="basicCheck.text" :class="cn(descClassName, 'mt-2')">
          含义：<strong>{{ basicCheck.text }}</strong>
        </p>
        <AAlert
          v-else
          type="error"
          show-icon
          class="mt-2"
          :message="`表达式无效：${basicCheck.error}`"
        />
      </div>
    </ACard>

    <!-- 2. 预设表达式 -->
    <ACard title="预设表达式" variant="borderless">
      <p :class="hintClassName">
        点击下面的预设按钮会把对应表达式写入编辑器并刷新描述。所有预设都做了合法性校验——
        万一某个值无法被 <code>cronstrue</code> 解析，会捕获异常并弹出 warning
        提示，而不是抛出未处理错误。
      </p>
      <div :class="presetRowClassName">
        <AButton
          v-for="preset in presets"
          :key="preset.value"
          size="small"
          :type="presetExpr === preset.value ? 'primary' : 'default'"
          @click="applyPreset(preset)"
        >
          {{ preset.label }}
        </AButton>
      </div>
      <CronEditor v-model="presetExpr" @change="onPresetChange" />
      <div :class="resultBoxClassName">
        <div :class="descClassName">
          当前表达式：<span :class="exprCodeClassName">{{
            presetExpr || '（空）'
          }}</span>
        </div>
        <p v-if="presetCheck.text" :class="cn(descClassName, 'mt-2')">
          含义：<strong>{{ presetCheck.text }}</strong>
        </p>
        <AAlert
          v-else
          type="error"
          show-icon
          class="mt-2"
          :message="`表达式无效：${presetCheck.error}`"
        />
      </div>
    </ACard>

    <!-- 3. 校验与回显 -->
    <ACard title="校验与回显" variant="borderless">
      <p :class="hintClassName">
        编辑器自带的输入框是只读的，因此这里额外提供一个可手动输入的受控输入框演示校验与受控/非受控取值。
        「应用」只把<strong>合法</strong>草稿提交为生效值（受控），非法时可见地标红并给出错误；「重置」丢弃未提交的
        草稿，回到当前生效值（非受控编辑的回退）。试着输入
        <code>* * *</code> 这类非法表达式看看效果。
      </p>
      <ASpace direction="vertical" :size="12" class="w-full">
        <AInput
          v-model:value="draftExpr"
          :status="draftCheck.error ? 'error' : undefined"
          placeholder="手动输入 Cron 表达式，例如 0 30 4 * * *"
          class="font-mono"
        />
        <div>
          <ASpace>
            <AButton type="primary" @click="applyDraft"> 应用 </AButton>
            <AButton @click="resetDraft"> 重置 </AButton>
          </ASpace>
        </div>
        <AAlert
          v-if="draftCheck.error"
          type="error"
          show-icon
          :message="`草稿无效：${draftCheck.error}`"
          description="修正前不会写入生效值。"
        />
        <AAlert
          v-else
          type="success"
          show-icon
          :message="`草稿可解析：${draftCheck.text}`"
        />
      </ASpace>
      <div :class="resultBoxClassName">
        <div :class="descClassName">
          生效表达式：<span :class="exprCodeClassName">{{ appliedExpr }}</span>
        </div>
        <p v-if="appliedCheck.text" :class="cn(descClassName, 'mt-2')">
          含义：<strong>{{ appliedCheck.text }}</strong>
        </p>
        <div class="mt-3">
          <CronEditor v-model="appliedExpr" @change="onAppliedChange" />
        </div>
      </div>
    </ACard>

    <!-- 4. 描述预览 -->
    <ACard title="描述预览" variant="borderless">
      <AAlert
        type="info"
        show-icon
        class="mb-4"
        message="关于「下次运行时间」的诚实说明"
        description="本项目只安装了 cronstrue（仅能生成文字描述），没有可计算下次运行时间的调度库（如 cron-parser），也不伪造后端。因此本区展示表达式的字段解析与文字描述预览，而非编造一份运行时间表。"
      />
      <p :class="hintClassName">
        把表达式按 <code>秒 分 时 日 月 周</code> 逐字段拆开，并用
        <code>cronstrue</code>
        给出可读描述，方便确认手写表达式是否符合作者意图。
      </p>
      <CronEditor v-model="previewExpr" />
      <div :class="resultBoxClassName">
        <div v-if="previewFields.length" :class="fieldListClassName">
          <div
            v-for="[key, value] in previewFields"
            :key="key"
            :class="fieldItemClassName"
          >
            <span :class="fieldKeyClassName">{{ key }}</span>
            <span :class="fieldValueClassName">{{ value }}</span>
          </div>
        </div>
        <div :class="cn(descClassName, 'mt-3')">
          当前表达式：<span :class="exprCodeClassName">{{
            previewExpr || '（空）'
          }}</span>
        </div>
        <p v-if="previewCheck.text" :class="cn(descClassName, 'mt-2')">
          含义：<strong>{{ previewCheck.text }}</strong>
        </p>
        <AAlert
          v-else
          type="error"
          show-icon
          class="mt-2"
          :message="`表达式无效：${previewCheck.error}`"
        />
      </div>
    </ACard>
  </div>
</template>
