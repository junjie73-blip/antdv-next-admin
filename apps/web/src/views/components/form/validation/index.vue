<script setup lang="ts">
import type { FormActionType, FormSchema, Recordable } from '@antdv/form-ui';

import { computed, ref } from 'vue';

import { Card, Scrollbar } from '@antdv/common-ui';
import { BasicForm, useForm } from '@antdv/form-ui';
import { message } from '@antdv/popup-ui';
import { Button, Switch } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

const containerClassName = cn('space-y-6');
const descClassName = cn('mb-4 text-sm/6 text-gray-600 dark:text-gray-300');
const inlineCodeClassName = cn(
  'rounded-sm bg-gray-100 px-1 font-mono text-xs dark:bg-gray-800',
);
const toolbarClassName = cn('mt-4 flex flex-wrap items-center gap-2');
const codeBlockClassName = cn(
  'max-h-72 rounded-lg border border-gray-200 bg-gray-50 p-4 font-mono text-xs dark:border-gray-700 dark:bg-gray-800',
);

/**
 * `validate()` 失败时 antd 抛出的对象（只声明这一页要用的字段）。
 */
interface ValidateFailure {
  errorFields?: { errors?: string[]; name?: (number | string)[] }[];
  values?: Recordable;
}

const [registerFormat, formatApi] = useForm();
const [registerLength, lengthApi] = useForm();
const [registerCross, crossApi] = useForm();
const [registerTiming, timingApi] = useForm();

const lastResult = ref<{
  errors: string[];
  ok: boolean;
  values: Recordable;
}>({ errors: [], ok: false, values: {} });

/**
 * 四个表单共用同一套动作：`validate` / `clearValidate` / `resetFields`
 * 都是 `FormActionType`（useForm 暴露的那组方法）上的真实方法。
 */
async function handleSubmit(api: FormActionType) {
  try {
    const values = await api.validate();
    lastResult.value = { ok: true, values, errors: [] };
    message.success('校验通过，这份数据可以提交');
  } catch (error) {
    const failure = (error ?? {}) as ValidateFailure;
    const errors = (failure.errorFields ?? []).flatMap(
      (field) => field.errors ?? [],
    );
    lastResult.value = { ok: false, values: failure.values ?? {}, errors };
    message.error(`校验未通过：${errors[0] ?? '请检查表单'}`);
  }
}

function handleClear(api: FormActionType) {
  api.clearValidate();
  message.info('已清除校验状态（clearValidate）');
}

function handleReset(api: FormActionType) {
  api.resetFields();
  lastResult.value = { ok: false, values: {}, errors: [] };
  message.info('表单已重置（resetFields）');
}

// ============================================================
// 1. 必填与格式
// ============================================================
const formatSchemas: FormSchema[] = [
  {
    field: 'account',
    label: '用户名',
    component: 'Input',
    // 仓库自己只提供这一层「必填简写」：helper.ts 的 getDynamicRules 会把它展开成
    // { required: true, message }，配合 rulesMessageJoinLabel 用 label 拼出文案
    required: true,
    rulesMessageJoinLabel: true,
    defaultValue: '',
    colProps: { span: 12 },
    helpMessage: 'schema.required + rulesMessageJoinLabel，没有写一条规则',
  },
  {
    field: 'email',
    label: '邮箱',
    component: 'Input',
    required: true,
    rulesMessageJoinLabel: true,
    defaultValue: '',
    colProps: { span: 12 },
    // 格式校验：直接写 antd 原生规则字段，BasicForm 原样交给 a-form-item
    rules: [{ type: 'email', message: '邮箱格式不正确' }],
  },
  {
    field: 'mobile',
    label: '手机号',
    component: 'Input',
    defaultValue: '',
    colProps: { span: 12 },
    // 没有手机号预设，所以是显式的 pattern 规则（helper 会拦下非 RegExp 的 pattern）
    rules: [{ pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确' }],
  },
  {
    field: 'website',
    label: '公司网站',
    component: 'Input',
    defaultValue: '',
    colProps: { span: 12 },
    componentProps: { placeholder: 'https://example.com' },
    rules: [{ type: 'url', message: '网站需是合法 URL（含协议头）' }],
  },
];

// ============================================================
// 2. 长度与数值区间
// ============================================================
const lengthSchemas: FormSchema[] = [
  {
    field: 'nickname',
    label: '昵称',
    component: 'Input',
    required: true,
    rulesMessageJoinLabel: true,
    defaultValue: '',
    colProps: { span: 12 },
    componentProps: { maxlength: 16 },
    // schema.suffix 是 BasicForm 的字段：渲染进输入框的 #suffix，这里用它做实时字数
    suffix: ({ values }) => `${String(values.nickname ?? '').length}/16`,
    rules: [{ min: 3, max: 16, message: '昵称长度需在 3-16 个字符之间' }],
  },
  {
    field: 'age',
    label: '年龄',
    component: 'InputNumber',
    defaultValue: null,
    colProps: { span: 12 },
    componentProps: { min: 1, max: 120, style: { width: '100%' } },
    // type: 'number' 时 min/max 就是数值区间；InputNumber 的 min/max 只负责拦住输入
    rules: [
      { type: 'number', min: 1, max: 120, message: '年龄需在 1-120 之间' },
    ],
    helpMessage: '用 setFieldsValue 灌一个越界值，规则依然会拦下来',
  },
  {
    field: 'bio',
    label: '个人简介',
    component: 'InputTextArea',
    defaultValue: '',
    colProps: { span: 24 },
    // antd TextArea 自带的实时字数提示，通过 componentProps 透传
    componentProps: { rows: 3, maxlength: 100, showCount: true },
    rules: [
      { min: 10, message: '简介至少 10 个字符' },
      { max: 100, message: '简介不能超过 100 个字符' },
    ],
  },
];

// ============================================================
// 3. 异步与跨字段校验
// ============================================================
/** 本地「已占用名单」：查重是 setTimeout 模拟，没有任何后端接口 */
const OCCUPIED_NAMES = new Set(['admin', 'root', 'superuser', 'test']);

const provinces = [
  { label: '北京', value: 'beijing' },
  { label: '上海', value: 'shanghai' },
  { label: '广东', value: 'guangdong' },
  { label: '浙江', value: 'zhejiang' },
];
const cityMap: Record<string, { label: string; value: string }[]> = {
  beijing: [{ label: '北京市', value: 'beijing-city' }],
  shanghai: [{ label: '上海市', value: 'shanghai-city' }],
  guangdong: [
    { label: '广州', value: 'guangzhou' },
    { label: '深圳', value: 'shenzhen' },
  ],
  zhejiang: [
    { label: '杭州', value: 'hangzhou' },
    { label: '宁波', value: 'ningbo' },
  ],
};
const districtMap: Record<string, { label: string; value: string }[]> = {
  'beijing-city': [
    { label: '朝阳', value: 'chaoyang' },
    { label: '海淀', value: 'haidian' },
  ],
  'shanghai-city': [
    { label: '浦东', value: 'pudong' },
    { label: '静安', value: 'jingan' },
  ],
  guangzhou: [
    { label: '天河', value: 'tianhe' },
    { label: '越秀', value: 'yuexiu' },
  ],
  shenzhen: [
    { label: '南山', value: 'nanshan' },
    { label: '福田', value: 'futian' },
  ],
  hangzhou: [
    { label: '西湖', value: 'xihu' },
    { label: '滨江', value: 'binjiang' },
  ],
  ningbo: [
    { label: '海曙', value: 'haishu' },
    { label: '鄞州', value: 'yinzhou' },
  ],
};

const crossSchemas: FormSchema[] = [
  {
    field: 'username',
    label: '用户名',
    component: 'Input',
    required: true,
    rulesMessageJoinLabel: true,
    defaultValue: '',
    colProps: { span: 12 },
    rules: [
      { min: 3, max: 16, message: '用户名长度需在 3-16 个字符之间' },
      {
        // 异步规则：validator 返回 Promise，antd 会自己把它挂成 validating 状态
        validator: (_rule, value) => {
          const name = String(value ?? '');
          if (name.length < 3) return Promise.resolve();
          return new Promise<void>((resolve, reject) => {
            window.setTimeout(() => {
              if (OCCUPIED_NAMES.has(name)) {
                reject(new Error(`用户名 ${name} 已被占用`));
              } else {
                resolve();
              }
            }, 600);
          });
        },
      },
    ],
    helpMessage: 'setTimeout 600ms 模拟一次查重，名单是本页的本地数组',
  },
  {
    field: 'password',
    label: '密码',
    component: 'InputPassword',
    required: true,
    rulesMessageJoinLabel: true,
    defaultValue: '',
    colProps: { span: 12 },
    rules: [
      { min: 6, message: '密码至少 6 个字符' },
      {
        // 仓库没有密码强度预设，这里是一条显式 validator
        validator: (_rule, value) => {
          const password = String(value ?? '');
          if (password && !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
            return Promise.reject(
              new Error('密码需同时包含大写字母、小写字母和数字'),
            );
          }
          return Promise.resolve();
        },
      },
    ],
  },
  {
    field: 'confirmPassword',
    label: '确认密码',
    component: 'InputPassword',
    defaultValue: '',
    colProps: { span: 12 },
    // dynamicRules 每次求值都拿得到整份 formModel，跨字段比较就用它。
    // 注意：写了 dynamicRules 就整份接管规则，required 简写不再生效，必填要自己带上。
    dynamicRules: ({ values }) => [
      { required: true, message: '请确认密码' },
      {
        validator: (_rule, value) =>
          value && value !== values.password
            ? Promise.reject(new Error('两次输入的密码不一致'))
            : Promise.resolve(),
      },
    ],
  },
  {
    field: 'province',
    label: '省份',
    component: 'Select',
    required: true,
    rulesMessageJoinLabel: true,
    defaultValue: '',
    colProps: { span: 12 },
    componentProps: { options: provinces },
  },
  {
    field: 'city',
    label: '城市',
    component: 'Select',
    defaultValue: '',
    colProps: { span: 12 },
    // componentProps 也能写成函数，读的就是同一份 formModel
    componentProps: ({ values }) => ({
      options: cityMap[values.province] ?? [],
      disabled: !values.province,
    }),
    // 换省份不会自动清空已选城市，由这条跨字段规则判出「城市不属于省份」
    dynamicRules: ({ values }) => [
      { required: true, message: '请选择城市' },
      {
        validator: (_rule, value) => {
          const allowed = cityMap[values.province] ?? [];
          return value && !allowed.some((item) => item.value === value)
            ? Promise.reject(new Error('城市不属于所选省份，请重新选择'))
            : Promise.resolve();
        },
      },
    ],
  },
  {
    field: 'district',
    label: '区县',
    component: 'Select',
    defaultValue: '',
    colProps: { span: 12 },
    componentProps: ({ values }) => ({
      options: districtMap[values.city] ?? [],
      disabled: !values.city,
    }),
    dynamicRules: ({ values }) => [
      { required: true, message: '请选择区县' },
      {
        validator: (_rule, value) => {
          const allowed = districtMap[values.city] ?? [];
          return value && !allowed.some((item) => item.value === value)
            ? Promise.reject(new Error('区县不属于所选城市，请重新选择'))
            : Promise.resolve();
        },
      },
    ],
  },
];

// ============================================================
// 4. 校验时机与结果
// ============================================================
const validateOnBlur = ref(false);

const timingSchemas = computed<FormSchema[]>(() => [
  {
    field: 'inviteCode',
    label: '邀请码',
    component: 'Input',
    required: true,
    rulesMessageJoinLabel: true,
    colProps: { span: 12 },
    // itemProps 是 schema 上的透传口子，整份 v-bind 给 a-form-item
    itemProps: { validateTrigger: validateOnBlur.value ? 'blur' : 'change' },
    rules: [{ min: 6, message: '邀请码至少 6 位' }],
  },
  {
    field: 'score',
    label: '考试分数',
    component: 'InputNumber',
    colProps: { span: 12 },
    itemProps: { validateTrigger: validateOnBlur.value ? 'blur' : 'change' },
    componentProps: { style: { width: '100%' } },
    rules: [
      { type: 'number', min: 0, max: 100, message: '分数需在 0-100 之间' },
    ],
  },
  {
    field: 'remark',
    label: '备注',
    component: 'InputTextArea',
    colProps: { span: 24 },
    itemProps: { validateTrigger: validateOnBlur.value ? 'blur' : 'change' },
    // 规则级 trigger：这一条只在失焦时跑，哪怕上面的时机开关选了 change
    rules: [
      { max: 20, message: '备注不超过 20 个字符' },
      {
        pattern: /^[\dA-Za-z-]*$/,
        message: '备注只允许字母、数字和连字符',
        trigger: 'blur',
      },
    ],
  },
]);
</script>

<template>
  <div :class="containerClassName">
    <Card title="必填与格式" variant="borderless">
      <p :class="descClassName">
        这一页全部走本仓库的
        <code :class="inlineCodeClassName">BasicForm</code>
        ：规则写在 schema 上，由
        <code :class="inlineCodeClassName">helper.ts</code> 的
        <code :class="inlineCodeClassName">getDynamicRules</code>
        算好后交给
        <code :class="inlineCodeClassName">a-form-item</code>。仓库自带的只有
        <code :class="inlineCodeClassName">required</code>
        简写（<code :class="inlineCodeClassName">rulesMessageJoinLabel</code>
        让文案拼上字段 label，得到「用户名不能为空」），并没有 email / 手机 /
        URL 这类规则预设；格式校验用的是 antd 原生规则字段
        <code :class="inlineCodeClassName">type</code>
        / <code :class="inlineCodeClassName">pattern</code>，手机号这条是显式的
        <code :class="inlineCodeClassName">pattern</code> 正则。
      </p>
      <BasicForm
        :schemas="formatSchemas"
        :label-width="90"
        :grid="{ cols: 2 }"
        :show-action-button-group="false"
        @register="registerFormat"
      />
      <div :class="toolbarClassName">
        <Button @click="handleSubmit(formatApi)"> 校验 </Button>
        <Button variant="outline" @click="handleClear(formatApi)">
          清除校验
        </Button>
        <Button variant="outline" @click="handleReset(formatApi)">
          重置
        </Button>
      </div>
    </Card>

    <Card title="长度与数值区间" variant="borderless">
      <p :class="descClassName">
        字符串长度用
        <code :class="inlineCodeClassName">min</code>/<code
          :class="inlineCodeClassName"
          >max</code>， 数值区间写
        <code :class="inlineCodeClassName">{ type: 'number', min, max }</code>
        —— 同一对 <code :class="inlineCodeClassName">min/max</code> 在
        <code :class="inlineCodeClassName">type: 'number'</code>
        下按区间比，在字符串下按长度比。 实时字数有两种现成写法：
        <code :class="inlineCodeClassName">componentProps: { showCount: true }</code>
        是 antd TextArea 自带的能力，昵称那格用的是本仓库 schema 的
        <code :class="inlineCodeClassName">suffix</code>
        字段（函数形式，读的就是当前表单值）。注意
        <code :class="inlineCodeClassName">maxlength</code>
        已经把输入卡在 100，简介的
        <code :class="inlineCodeClassName">max</code>
        规则是在给 <code :class="inlineCodeClassName">setFieldsValue</code>
        这类程序写入兜底。
      </p>
      <BasicForm
        :schemas="lengthSchemas"
        :label-width="90"
        :grid="{ cols: 2 }"
        :show-action-button-group="false"
        @register="registerLength"
      />
      <div :class="toolbarClassName">
        <Button @click="handleSubmit(lengthApi)"> 校验 </Button>
        <Button variant="outline" @click="handleClear(lengthApi)">
          清除校验
        </Button>
        <Button variant="outline" @click="handleReset(lengthApi)">
          重置
        </Button>
      </div>
    </Card>

    <Card title="异步与跨字段校验" variant="borderless">
      <p :class="descClassName">
        <code :class="inlineCodeClassName">validator</code>
        返回 Promise 就是异步规则，antd 会自己维护 validating
        状态。「用户名查重」是
        <code :class="inlineCodeClassName">setTimeout(600ms)</code>
        + 本页的本地数组
        <code :class="inlineCodeClassName">OCCUPIED_NAMES</code>
        （admin / root / superuser /
        test）模拟的，<strong>没有后端接口</strong>，也没有发请求。 跨字段比较走
        schema 的
        <code :class="inlineCodeClassName">dynamicRules</code>：它是函数，每次求值都能拿到整份
        <code :class="inlineCodeClassName">formModel</code>，确认密码因此能读到
        password 的最新值；省 / 市 /
        区同理——换省份不会自动清空已选城市，再次校验（或改动该字段）时
        由规则判出「城市不属于所选省份」。
        <code :class="inlineCodeClassName">dynamicRules</code>
        会整份接管该字段的规则，<code :class="inlineCodeClassName">required</code>
        简写不再起作用，必填得在函数里自己写。
      </p>
      <BasicForm
        :schemas="crossSchemas"
        :label-width="90"
        :grid="{ cols: 2 }"
        :show-action-button-group="false"
        @register="registerCross"
      />
      <div :class="toolbarClassName">
        <Button @click="handleSubmit(crossApi)"> 校验 </Button>
        <Button variant="outline" @click="handleClear(crossApi)">
          清除校验
        </Button>
        <Button variant="outline" @click="handleReset(crossApi)"> 重置 </Button>
      </div>
    </Card>

    <Card title="校验时机与结果" variant="borderless">
      <p :class="descClassName">
        触发时机不是 BasicForm 自己造的轮子：
        <code :class="inlineCodeClassName">itemProps</code>
        会被 FormItem 原样
        <code :class="inlineCodeClassName">v-bind</code>
        到 <code :class="inlineCodeClassName">a-form-item</code>，所以切到
        <code :class="inlineCodeClassName">blur</code>
        后，输入过程中不再逐字符报错。单条规则还能用
        <code :class="inlineCodeClassName">trigger</code>
        覆盖自己的时机（备注里的 pattern
        规则就固定失焦才跑）。切换只影响后续触发，
        已有的错误提示请用「清除校验」（<code :class="inlineCodeClassName">clearValidate</code>）去掉， 「重置」调的是
        <code :class="inlineCodeClassName">resetFields</code>，会把值退回 schema
        的 <code :class="inlineCodeClassName">defaultValue</code>。
        <code :class="inlineCodeClassName">validate()</code>
        成功时返回处理后的取值，失败时抛出的对象里带
        <code :class="inlineCodeClassName">errorFields</code>。
      </p>
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <span class="text-sm">校验时机</span>
        <Switch
          :model-value="validateOnBlur"
          @update:model-value="(v: boolean) => (validateOnBlur = v)"
        />
        <span class="text-sm text-gray-500 dark:text-gray-400">
          {{ validateOnBlur ? 'blur' : 'change' }}
        </span>
        <span class="text-sm text-gray-600 dark:text-gray-300">
          {{ validateOnBlur ? '失焦（blur）时才校验' : '输入（change）即校验' }}
        </span>
      </div>
      <BasicForm
        :schemas="timingSchemas"
        :label-width="90"
        :grid="{ cols: 1 }"
        :show-action-button-group="false"
        @register="registerTiming"
      />
      <div :class="toolbarClassName">
        <Button @click="handleSubmit(timingApi)"> 提交 </Button>
        <Button variant="outline" @click="handleClear(timingApi)">
          清除校验
        </Button>
        <Button variant="outline" @click="handleReset(timingApi)">
          重置
        </Button>
      </div>
      <div class="mt-4">
        <div class="mb-2 text-sm text-gray-600 dark:text-gray-300">
          最近一次校验结果
        </div>
        <Scrollbar :root-class="codeBlockClassName">
          <pre>{{ JSON.stringify(lastResult, null, 2) }}</pre>
        </Scrollbar>
      </div>
    </Card>
  </div>
</template>
