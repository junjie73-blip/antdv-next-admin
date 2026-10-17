<script setup lang="ts">
import type { FormProps, FormSchema, Recordable } from '@antdv/form-ui';

import { computed, nextTick, onMounted, reactive, ref } from 'vue';

import {
  Alert,
  Card,
  Descriptions,
  DescriptionsItem,
  Result,
  Steps,
} from '@antdv/common-ui';
import { BasicForm, useForm } from '@antdv/form-ui';
import { message } from '@antdv/popup-ui';
import { Button, Checkbox } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

/**
 * 分步表单示例。
 *
 * 四段全部用仓库内的 `BasicForm` + `useForm`：**一个表单实例跑完整条流程**，
 * 换步骤靠 `setProps({ schemas })` 整体替换字段（`BasicForm` 把 schemas 从合并逻辑里
 * 单独摘出来做替换，并且不动 `formModel`），值留在页面 state 里，来回切步骤不丢。
 */

/* 根容器不留内边距：内容区的 p-4 由布局的 Scrollbar 统一给（见 page-root-padding 守卫） */
const containerClassName = cn('space-y-6');
const hintClassName = cn('mb-3 text-xs text-gray-500 dark:text-gray-400');
const metaClassName = cn('mr-auto text-xs text-gray-500 dark:text-gray-400');
const stepClassName = cn('space-y-4');
const actionBarClassName = cn('flex flex-wrap items-center gap-2');
const codeClassName = cn(
  'rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-xs dark:border-gray-700 dark:bg-gray-800',
);
const serviceBoxClassName = cn(
  'w-full overflow-hidden rounded-md border border-gray-200 dark:border-gray-700',
);
const serviceHeadClassName = cn(
  'grid grid-cols-[9rem_1fr_7rem_5rem] items-center gap-2 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400',
);
const serviceRowClassName = cn(
  'grid grid-cols-[9rem_1fr_7rem_5rem] items-center gap-2 border-t border-gray-200 px-3 py-2 dark:border-gray-700',
);

interface StepConfig {
  /** 步骤条上的标题 */
  title: string;
  /** 步骤条下的副文案（对应 Steps item 的 description） */
  hint?: string;
  /** 这一步要渲染的字段：换步骤 = 换这份 schema */
  schemas: FormSchema[];
}

interface StoredDraft {
  savedAt: string;
  step: number;
  values: Recordable;
}

/** 草稿就存在浏览器本地，键名固定，刷新页面还在，但换设备就没了 */
const DRAFT_STORAGE_KEY = 'demo:form-steps:draft';

/**
 * 分步流程骨架：一个 BasicForm 实例 + 页面侧的步骤状态。
 *
 * 两个必须知道的约定：
 *
 * 1. 步骤 schema 上**不要写 `defaultValue`**。`setProps({ schemas })` 每次都会跑一遍
 *    `initFormModel()`，把带默认值的字段重新盖成默认值 —— 于是「上一步 → 下一步」
 *    之间用户刚填的内容被抹平。初值改成挂载前 `setFieldsValue` 灌一次。
 * 2. `showActionButtonGroup` / `showSubmitButton` / `showResetButton` 这些在
 *    `BasicForm` 里有 `withDefaults` 默认值，而 `setProps` 走的 `deepMerge` 是
 *    「目标优先」，标量塞不进去 —— 要关内置按钮只能在模板上直接传 prop。
 */
function useStepFlow(
  steps: StepConfig[],
  seed: Recordable,
  extraFormProps: Partial<FormProps> = {},
  /** 步骤条能不能点着切换：只有第 3 段开，其它段的点击会得到一句提示而不是没反应 */
  jumpable = false,
) {
  const step = ref(0);
  /** 走到过的最后一步：决定步骤条上哪些可以点 */
  const furthest = ref(0);
  const values = ref<Recordable>({ ...seed });
  const done = ref<null | Recordable>(null);

  const [register, form] = useForm({
    grid: { cols: 1 },
    labelWidth: 110,
    schemas: steps[0].schemas,
    ...extraFormProps,
  });

  // 挂载前灌初值：useForm 把它存成待写入队列，register 那一刻兑现
  void form.setFieldsValue(values.value);

  /** `__` 开头的字段是只读展示位（内容自己在 slot 里渲染），不参与校验 */
  const fieldsOf = (index: number) =>
    steps[index].schemas
      .map((schema) => schema.field)
      .filter((field) => !field.startsWith('__'));

  /** formModel 是全步骤共享的同一个对象，取一次就把所有填过的值带回来 */
  function collect(): Recordable {
    return { ...values.value, ...form.getFieldsValue() };
  }

  const stepItems = computed(() =>
    steps.map((item) => ({
      title: item.title,
      description: item.hint,
    })),
  );

  const isLast = computed(() => step.value === steps.length - 1);

  /**
   * 换步骤：换 schema + 灌回页面里的值。
   *
   * `keepErrors` 只给整表校验失败的回跳用 —— 这时字段上的错误正是用户要看的，
   * 清掉就变成「点了提交只有一句 toast，表单上哪儿都不红」。
   */
  async function gotoStep(
    index: number,
    snapshot?: Recordable,
    keepErrors = false,
  ) {
    const merged = { ...(snapshot ?? collect()) };
    values.value = merged;
    step.value = index;
    furthest.value = Math.max(furthest.value, index);
    await form.setProps({ schemas: steps[index].schemas });
    await form.setFieldsValue(merged);
    if (keepErrors) return;
    // 新步骤的 a-form-item 要到这一轮渲染结束才注册，清残留错误得排在 nextTick 之后
    await nextTick();
    await form.clearValidate(fieldsOf(index));
  }

  /** 只校验本步骤的字段：字段名交给 a-form，别的步骤不在注册表里 */
  async function validateCurrent(): Promise<boolean> {
    try {
      await form.validate(fieldsOf(step.value));
      return true;
    } catch (error) {
      message.error(
        `「${steps[step.value].title}」：${(error as { message?: string }).message ?? '还有必填项没补全'}`,
      );
      return false;
    }
  }

  /** 下一步：先过本步校验，不过就原地停住 */
  async function next(): Promise<boolean> {
    if (!(await validateCurrent())) return false;
    if (!isLast.value) await gotoStep(step.value + 1);
    return true;
  }

  /** 上一步：倒退不该被校验拦住，直接换 schema */
  async function prev() {
    if (step.value > 0) await gotoStep(step.value - 1);
  }

  /** 点步骤条跳回去：只认走过的步骤；没开跳转的段落给一句解释，而不是点了没反应 */
  async function jumpTo(index: number) {
    if (index === step.value) return;
    if (!jumpable) {
      message.info(
        '这一段把步骤条当纯进度指示（item 点了不跳），切换请用下面第 3 段那种写法',
      );
      return;
    }
    if (index > furthest.value) {
      message.warning(`第 ${index + 1} 步还没走到，先把当前步骤填完`);
      return;
    }
    await gotoStep(index);
  }

  /**
   * 提交前的整表校验。
   *
   * 不带字段名的 `validate()` 只覆盖当前挂载的字段：前面几步的 a-form-item 已经卸载，
   * 不在 form 的字段注册表里，脏值会静默过关 —— 分步表单最容易踩的就是这个坑。
   * 这里把各步 schema 拼成一份临时全量表挂上去，非当前步骤加 `show: false`：
   * FormItem 用的是 v-show，字段仍在注册表里参与校验，又不会闪出别的步骤的输入框。
   * （换成 `ifShow: false` 就真卸载了，等于没校验。）
   */
  async function validateAll(): Promise<null | Recordable> {
    const snapshot = collect();
    values.value = snapshot;
    const fullSchemas = steps.flatMap((item, index) =>
      index === step.value
        ? item.schemas
        : item.schemas.map((schema) => ({ ...schema, show: false })),
    );
    await form.setProps({ schemas: fullSchemas });
    await nextTick();
    try {
      await form.validate(fullSchemas.map((schema) => schema.field));
    } catch (error) {
      const failed = error as {
        errorFields?: { name: (number | string)[] }[];
        message?: string;
      };
      const target = steps.findIndex((item) =>
        item.schemas.some(
          (schema) => schema.field === failed.errorFields?.[0]?.name?.[0],
        ),
      );
      await gotoStep(
        target === -1 ? step.value : target,
        snapshot,
        // 回跳是为了让用户看到错误，别把刚跑出来的校验结果抹了
        true,
      );
      message.error(
        `${failed.message ?? '有字段没填对'}${target === -1 ? '' : `，已跳回「${steps[target].title}」`}`,
      );
      return null;
    }
    await form.setProps({ schemas: steps[step.value].schemas });
    await nextTick();
    return snapshot;
  }

  async function reset(nextSeed?: Recordable) {
    // 步骤 schema 没有 defaultValue，resetFields 等于把渲染过的字段清空，随后再灌回页面初值
    await form.resetFields();
    done.value = null;
    furthest.value = 0;
    await gotoStep(0, { ...(nextSeed ?? seed) });
  }

  // 返回 reactive 对象：模板里 `basic.step` 直接拿到解包后的值，不用写 .value
  return reactive({
    collect,
    done,
    fieldsOf,
    furthest,
    gotoStep,
    isLast,
    jumpTo,
    next,
    prev,
    register,
    reset,
    step,
    stepItems,
    validateAll,
    validateCurrent,
    values,
  });
}

/** 空串 / undefined / 空数组 / false 都算没填，用来在页面上显示「已攒了几个字段」 */
function filledCount(values: Recordable) {
  return Object.values(values).filter((value) => {
    if (
      value === '' ||
      value === false ||
      value === null ||
      value === undefined
    )
      return false;
    return !Array.isArray(value) || value.length > 0;
  }).length;
}

function emptyText(value: unknown) {
  return value === '' || value === null || value === undefined
    ? '—'
    : String(value);
}

/**
 * 把收集到的值翻成人话：Select / RadioGroup 的中文标签藏在 componentProps.options 里，
 * 直接打印 value 读者根本看不出选了啥。
 */
function summaryRows(steps: StepConfig[], values: Recordable) {
  return steps
    .flatMap((item) => item.schemas)
    .filter((schema) => !schema.field.startsWith('__'))
    .map((schema) => {
      const raw = values[schema.field];
      const props =
        typeof schema.componentProps === 'function'
          ? undefined
          : schema.componentProps;
      const options = (props as Recordable | undefined)?.options;
      const hit = Array.isArray(options)
        ? options.find(
            (option: Recordable) =>
              String(option?.value ?? option) === String(raw),
          )
        : undefined;
      return {
        field: schema.field,
        label: schema.label ?? schema.field,
        text: formatSummaryValue(raw, hit?.label),
      };
    });
}

function formatSummaryValue(raw: unknown, optionLabel: unknown): string {
  if (raw === '' || raw === null || raw === undefined) return '—';
  if (Array.isArray(raw))
    return raw.length > 0 ? raw.map((item) => String(item)).join('、') : '—';
  if (typeof raw === 'boolean') return raw ? '是' : '否';
  if (optionLabel !== undefined && optionLabel !== null)
    return String(optionLabel);
  return typeof raw === 'object' ? JSON.stringify(raw) : String(raw);
}

/* ============================================================
 * 1. 基础分步表单：下一步带门禁，最后一步出摘要
 * ============================================================ */
const basicSteps: StepConfig[] = [
  {
    title: '基本信息',
    hint: '姓名与证件类型',
    schemas: [
      {
        field: 'realName',
        label: '真实姓名',
        component: 'Input',
        required: true,
      },
      {
        field: 'nickName',
        label: '昵称',
        component: 'Input',
        componentProps: { placeholder: '选填，别人看到的名字' },
      },
      {
        field: 'idType',
        label: '证件类型',
        component: 'Select',
        required: true,
        componentProps: {
          options: [
            { label: '身份证', value: 'idCard' },
            { label: '护照', value: 'passport' },
            { label: '港澳通行证', value: 'hkMac' },
          ],
        },
      },
    ],
  },
  {
    title: '联系方式',
    hint: '手机号格式在本步就拦住',
    schemas: [
      {
        field: 'mobile',
        label: '手机号',
        component: 'Input',
        required: true,
        rules: [{ pattern: /^1[3-9]\d{9}$/, message: '11 位手机号，别带空格' }],
      },
      {
        field: 'email',
        label: '邮箱',
        component: 'Input',
        rules: [{ type: 'email', message: '邮箱格式不正确' }],
      },
      {
        field: 'address',
        label: '通讯地址',
        component: 'InputTextArea',
        componentProps: { rows: 3 },
      },
    ],
  },
  {
    title: '确认协议',
    hint: '同意条款后提交',
    schemas: [
      {
        field: 'agreement',
        label: '服务协议',
        component: 'RadioGroup',
        // 星号用 itemProps.required 给：规则里只留一条自己的判断，避免两条错误叠在一起
        itemProps: { required: true },
        rules: [
          {
            validator: (_rule, value) =>
              value === 'agree'
                ? Promise.resolve()
                : Promise.reject(new Error('需要先同意《用户服务协议》')),
          },
        ],
        componentProps: {
          options: [
            { label: '我已阅读并同意《用户服务协议》', value: 'agree' },
            { label: '暂不同意', value: 'reject' },
          ],
        },
      },
      {
        field: 'remark',
        label: '备注',
        component: 'InputTextArea',
        componentProps: { rows: 2 },
      },
    ],
  },
];

const basic = useStepFlow(basicSteps, {
  realName: '',
  nickName: '',
  idType: undefined,
  mobile: '',
  email: '',
  address: '',
  agreement: '',
  remark: '',
});

const basicRows = computed(() => summaryRows(basicSteps, basic.done ?? {}));

async function submitBasic() {
  const snapshot = await basic.validateAll();
  if (!snapshot) return;
  basic.done = snapshot;
  message.success('三步校验全部通过，已生成本地摘要（没有请求任何接口）');
}

function restartBasic() {
  basic.done = null;
  void basic.reset();
}

/* ============================================================
 * 2. 分步校验与草稿：下一步不校验，草稿写 localStorage
 * ============================================================ */
const draftSteps: StepConfig[] = [
  {
    title: '账号信息',
    hint: '登录名必填',
    schemas: [
      {
        field: 'loginName',
        label: '登录名',
        component: 'Input',
        required: true,
        rules: [
          {
            pattern: /^[a-zA-Z][a-zA-Z\d_-]{2,15}$/,
            message: '字母开头，3-16 位，可用数字/_/-',
          },
        ],
      },
      { field: 'displayName', label: '显示名', component: 'Input' },
    ],
  },
  {
    title: '联系方式',
    hint: '手机 / 邮箱 / 城市',
    schemas: [
      {
        field: 'mobile',
        label: '手机号',
        component: 'Input',
        required: true,
        rules: [{ pattern: /^1[3-9]\d{9}$/, message: '11 位手机号' }],
      },
      {
        field: 'email',
        label: '邮箱',
        component: 'Input',
        rules: [{ type: 'email', message: '邮箱格式不正确' }],
      },
      {
        field: 'city',
        label: '常驻城市',
        component: 'Select',
        componentProps: {
          options: [
            { label: '杭州', value: 'hangzhou' },
            { label: '成都', value: 'chengdu' },
            { label: '北京', value: 'beijing' },
          ],
        },
      },
    ],
  },
  {
    title: '通知偏好',
    hint: '渠道 + 周报开关',
    schemas: [
      {
        field: 'channel',
        label: '通知渠道',
        component: 'RadioGroup',
        componentProps: {
          options: [
            { label: '短信', value: 'sms' },
            { label: '邮件', value: 'email' },
            { label: '站内信', value: 'inbox' },
          ],
        },
      },
      { field: 'digest', label: '每周摘要', component: 'Switch' },
      {
        field: 'intro',
        label: '个人简介',
        component: 'InputTextArea',
        componentProps: { rows: 3 },
      },
    ],
  },
];

const draft = useStepFlow(
  draftSteps,
  {
    loginName: '',
    displayName: '',
    mobile: '',
    email: '',
    city: undefined,
    channel: 'sms',
    digest: false,
    intro: '',
  },
  { labelWidth: 92 },
);

/** localStorage 里的真实内容，不做乐观展示 */
const storedDraft = ref<null | StoredDraft>(null);

function readStoredDraft(): null | StoredDraft {
  const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredDraft;
    return parsed && typeof parsed === 'object' && parsed.values
      ? parsed
      : null;
  } catch {
    // 手抖改脏过的值不是合法 JSON，读不出来就当没草稿
    return null;
  }
}

// 进页面就是一次真的读取：上次的草稿还在不在，这里说的就是浏览器里的实际情况
onMounted(() => {
  storedDraft.value = readStoredDraft();
});

const storedDraftJson = computed(() =>
  storedDraft.value
    ? JSON.stringify(storedDraft.value, null, 2)
    : '（还没有草稿）',
);

async function saveDraft() {
  const payload: StoredDraft = {
    savedAt: new Date().toISOString(),
    step: draft.step,
    values: draft.collect(),
  };
  localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
  // 立刻读回来，别只在页面上演一遍「保存成功」
  storedDraft.value = readStoredDraft();
  message.success(
    `草稿已写入 localStorage.${DRAFT_STORAGE_KEY}（${Object.keys(payload.values).length} 个字段），全程没有接口调用`,
  );
}

async function restoreDraft() {
  const stored = readStoredDraft();
  storedDraft.value = stored;
  if (!stored) {
    message.warning(
      `localStorage.${DRAFT_STORAGE_KEY} 里没有草稿，先点一次「保存草稿」`,
    );
    return;
  }
  await draft.gotoStep(stored.step, stored.values);
  message.success(
    `已从 localStorage 恢复：回到第 ${stored.step + 1} 步，${filledCount(stored.values)} 个字段有值`,
  );
}

function clearDraft() {
  localStorage.removeItem(DRAFT_STORAGE_KEY);
  storedDraft.value = null;
  message.info('草稿已从 localStorage 删掉，表单里已填的值不动');
}

async function checkDraftStep() {
  if (await draft.validateCurrent())
    message.success(`「${draftSteps[draft.step].title}」的字段校验通过`);
}

/** 这一段故意不校验：切步骤自由，校验交给「校验本步」和「提交」 */
function nextDraftStep() {
  if (draft.isLast) {
    message.info('已经是最后一步');
    return;
  }
  void draft.gotoStep(draft.step + 1);
}

async function submitDraft() {
  const snapshot = await draft.validateAll();
  if (!snapshot) return;
  draft.done = snapshot;
  message.success('整表校验通过（本地演示：不发请求，只在下面把值打出来）');
}

/* ============================================================
 * 3. 步骤可跳转 + 按钮在表单动作区
 * ============================================================ */
const jumpSteps: StepConfig[] = [
  {
    title: '申请事由',
    hint: '类型与说明',
    schemas: [
      {
        field: 'reasonType',
        label: '事由类型',
        component: 'Select',
        required: true,
        componentProps: {
          options: [
            { label: '设备采购', value: 'purchase' },
            { label: '维修报废', value: 'repair' },
            { label: '出差申请', value: 'travel' },
            { label: '其他', value: 'other' },
          ],
        },
      },
      {
        field: 'reasonDetail',
        label: '事由说明',
        component: 'InputTextArea',
        required: true,
        componentProps: { rows: 3, showCount: true, maxLength: 120 },
      },
    ],
  },
  {
    title: '时间与地点',
    hint: '起止日期与城市',
    schemas: [
      {
        field: 'startDate',
        label: '开始日期',
        component: 'DatePicker',
        required: true,
        componentProps: { valueFormat: 'YYYY-MM-DD', style: { width: '100%' } },
      },
      {
        field: 'endDate',
        label: '结束日期',
        component: 'DatePicker',
        componentProps: { valueFormat: 'YYYY-MM-DD', style: { width: '100%' } },
      },
      { field: 'city', label: '地点', component: 'Input' },
    ],
  },
  {
    title: '审批与加急',
    hint: '审批人必填',
    schemas: [
      {
        field: 'approver',
        label: '审批人',
        component: 'Input',
        required: true,
      },
      { field: 'cc', label: '抄送', component: 'Input' },
      { field: 'urgent', label: '加急处理', component: 'Switch' },
    ],
  },
];

// 第 3 个参数是 useForm 的补充 props，第 4 个才开步骤跳转：这一步的 item 可以点着切
const jump = useStepFlow(
  jumpSteps,
  {
    reasonType: undefined,
    reasonDetail: '',
    startDate: '',
    endDate: '',
    city: '',
    approver: '',
    cc: '',
    urgent: false,
  },
  {},
  true,
);

async function submitJump() {
  const snapshot = await jump.validateAll();
  if (!snapshot) return;
  jump.done = snapshot;
  message.success('已提交（本地演示，无接口调用）');
}

function restartJump() {
  jump.done = null;
  void jump.reset();
}

/* ============================================================
 * 4. 复杂步骤内容：表格化多选 + 只读确认摘要
 * ============================================================ */
const serviceOptions = [
  {
    value: 'inspect',
    label: '月度巡检',
    desc: '每月 1 次现场巡检，出巡检报告',
    price: '￥280/月',
    hours: '2 小时',
  },
  {
    value: 'maintain',
    label: '季度保养',
    desc: '拆机清洁、易损件更换、润滑校准',
    price: '￥760/季',
    hours: '4 小时',
  },
  {
    value: 'remote',
    label: '远程值守',
    desc: '工作日 9:00-18:00 远程监控与告警响应',
    price: '￥1,200/月',
    hours: '不驻场',
  },
  {
    value: 'onsite',
    label: '驻场支持',
    desc: '工程师驻场，含月度运行报告',
    price: '￥8,600/月',
    hours: '5 天/周',
  },
];

const complexSteps: StepConfig[] = [
  {
    title: '申请信息',
    hint: '普普通通的字段',
    schemas: [
      {
        field: 'customer',
        label: '客户名称',
        component: 'Input',
        required: true,
      },
      { field: 'contact', label: '对接人', component: 'Input' },
      {
        field: 'startDate',
        label: '生效日期',
        component: 'DatePicker',
        required: true,
        componentProps: { valueFormat: 'YYYY-MM-DD', style: { width: '100%' } },
      },
      {
        field: 'budget',
        label: '预算（元）',
        component: 'InputNumber',
        componentProps: { min: 0, step: 100, style: { width: '100%' } },
      },
    ],
  },
  {
    title: '选择服务项',
    hint: 'slot 渲染的表格化多选',
    schemas: [
      {
        field: 'services',
        label: '服务项',
        slot: 'serviceSlot',
        itemProps: { required: true },
        rules: [
          {
            validator: (_rule, value) =>
              Array.isArray(value) && value.length > 0
                ? Promise.resolve()
                : Promise.reject(new Error('至少选择一项服务')),
          },
        ],
      },
    ],
  },
  {
    title: '确认清单',
    hint: '只读摘要 + 勾选声明',
    schemas: [
      // `__` 前缀：只是借 a-form-item 的栅格放一块只读内容，不进校验、不进摘要
      { field: '__summary', label: '信息确认', slot: 'summarySlot' },
      {
        field: 'confirmed',
        label: '服务声明',
        slot: 'agreeSlot',
        itemProps: { required: true },
        rules: [
          {
            validator: (_rule, value) =>
              value
                ? Promise.resolve()
                : Promise.reject(new Error('请勾选确认，再提交申请')),
          },
        ],
      },
    ],
  },
];

const complex = useStepFlow(
  complexSteps,
  {
    customer: '',
    contact: '',
    startDate: '',
    budget: undefined,
    services: [] as string[],
    confirmed: false,
  },
  { labelWidth: 92 },
);

const serviceName = (value: string) =>
  serviceOptions.find((item) => item.value === value)?.label ?? value;

/** 确认步的只读摘要：读的就是页面 state，切步骤时收回来的那一份 */
const complexSummary = computed(() => {
  const values = (complex.done ?? complex.values) as Recordable;
  const services = Array.isArray(values.services) ? values.services : [];
  return [
    { label: '客户名称', text: emptyText(values.customer) },
    { label: '对接人', text: emptyText(values.contact) },
    { label: '生效日期', text: emptyText(values.startDate) },
    { label: '预算（元）', text: emptyText(values.budget) },
    {
      label: '已选服务项',
      text: services.length > 0 ? services.map(serviceName).join(' / ') : '—',
    },
    { label: '服务声明', text: values.confirmed ? '已勾选' : '未勾选' },
  ];
});

/** 回执文案：只读摘要已经渲染在第 3 步里，这里只补一句人话 */
const complexDoneText = computed(() => {
  const values = complex.done;
  if (!values) return '';
  const services = Array.isArray(values.services) ? values.services : [];
  return `客户 ${emptyText(values.customer)}｜${services.length} 项服务（${services.map(serviceName).join('、') || '无'}）｜生效 ${emptyText(values.startDate)}`;
});

async function submitComplex() {
  const snapshot = await complex.validateAll();
  if (!snapshot) return;
  complex.done = snapshot;
  message.success('申请已生成本地回执（没有调用接口）');
}

function restartComplex() {
  void complex.reset();
}

/**
 * shadcn 的 Checkbox 是「一个独立勾选框」，没有 antd 的 CheckboxGroup，
 * 所以数组模型由外面自己拼：勾选就并进数组，取消就从数组里剔除。
 */
function toggleOption(model: Recordable, field: string, value: string) {
  const list: string[] = Array.isArray(model[field]) ? [...model[field]] : [];
  model[field] = list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

const optionChecked = (model: Recordable, field: string, value: string) =>
  Array.isArray(model[field]) && model[field].includes(value);

/** 单勾选框：布尔值写在 formModel 上（antd 的 checked 对应这里的 model-value） */
function setAgreed(model: Recordable, field: string, checked: unknown) {
  model[field] = checked === true;
}
</script>

<template>
  <div :class="containerClassName">
    <!-- 1 -->
    <Card title="基础分步表单" variant="borderless">
      <p :class="hintClassName">
        一个 <code>BasicForm</code> 实例跑三步：点「下一步」先校验这一步的字段
        （<code>validate(fieldsOf(当前步))</code>），不过就原地停住；「上一步」直接换
        schema 不校验。换步骤只调 <code>setProps({ schemas })</code>，<code
          >formModel</code
        >
        不动， 所以来回切步骤值都在 —— 下面那行「已攒 N 个字段」就是这个意思。
      </p>
      <p :class="hintClassName">
        步骤 schema 上故意不写 <code>defaultValue</code>：<code>setProps</code>
        每次都会跑
        <code>initFormModel()</code>
        把带默认值的字段重新盖成默认值，用户刚填的就没了。
        提交前的整表校验也不是裸调 <code>validate()</code>：已卸载步骤的字段不在
        form 的注册表里， 裸调会静默跳过，得把三段 schema
        拼成临时全量表挂上去（详见脚本注释）。
      </p>

      <!-- 结果页用 v-show 留住表单实例：v-if 会把 BasicForm 卸掉，之后的 setProps 就写在死实例上了 -->
      <div v-show="!basic.done" :class="stepClassName">
        <Steps
          :current="basic.step"
          :items="basic.stepItems"
          clickable
          size="small"
          class="mb-2"
          @change="basic.jumpTo"
        />
        <BasicForm
          :show-action-button-group="false"
          @register="basic.register"
        />
        <div :class="actionBarClassName">
          <span :class="metaClassName">
            第 {{ basic.step + 1 }}/{{ basicSteps.length }} 步 · 页面已攒
            {{ filledCount(basic.values) }} 个字段
          </span>
          <Button :disabled="basic.step === 0" @click="basic.prev()">
            上一步
          </Button>
          <Button v-if="!basic.isLast" @click="basic.next()"> 下一步 </Button>
          <Button v-else @click="submitBasic"> 提交 </Button>
        </div>
      </div>

      <Result
        v-if="basic.done"
        status="success"
        title="分步表单已提交"
        sub-title="下面这份摘要取的是页面 state 里的全量值，不是某一步自己的。"
      >
        <Descriptions :column="1" bordered size="small">
          <DescriptionsItem
            v-for="row in basicRows"
            :key="row.field"
            :label="row.label"
          >
            {{ row.text }}
          </DescriptionsItem>
        </Descriptions>
        <template #extra>
          <Button @click="restartBasic"> 重新填写 </Button>
        </template>
      </Result>
    </Card>

    <!-- 2 -->
    <Card title="分步校验与草稿" variant="borderless">
      <p :class="hintClassName">
        和第 1
        段相反：「下一步」只换步骤、<strong>不做任何校验</strong>，切到第几步都能改。
        校验只有两个入口
        ——「校验本步」只喂当前步骤的字段名，「提交」走整表校验并跳回出问题的那一步。
      </p>
      <p :class="hintClassName">
        草稿的持久化是
        <code>localStorage</code>，<strong>不是后端接口</strong>：
        「保存草稿」把当前值连同步号 <code>JSON.stringify</code> 后写进
        <code>localStorage['demo:form-steps:draft']</code
        >，「恢复草稿」再把它读回来灌进表单 （先换 schema 再
        <code>setFieldsValue</code
        >）。刷新页面草稿还在，但它只活在这台浏览器里。
      </p>

      <div :class="stepClassName">
        <Steps
          :current="draft.step"
          :items="draft.stepItems"
          clickable
          size="small"
          class="mb-2"
          @change="draft.jumpTo"
        />
        <BasicForm
          :show-action-button-group="false"
          @register="draft.register"
        />
        <div :class="actionBarClassName">
          <span :class="metaClassName">
            第 {{ draft.step + 1 }}/{{ draftSteps.length }} 步 · 最远走到第
            {{ draft.furthest + 1 }} 步
          </span>
          <Button :disabled="draft.step === 0" @click="draft.prev()">
            上一步
          </Button>
          <Button
            :disabled="draft.isLast"
            variant="outline"
            @click="nextDraftStep()"
          >
            下一步
          </Button>
          <Button variant="outline" @click="checkDraftStep"> 校验本步 </Button>
          <Button variant="outline" @click="saveDraft"> 保存草稿 </Button>
          <Button variant="outline" @click="restoreDraft"> 恢复草稿 </Button>
          <Button
            variant="destructive"
            :disabled="!storedDraft"
            @click="clearDraft"
          >
            清除草稿
          </Button>
          <Button @click="submitDraft"> 提交 </Button>
        </div>
      </div>

      <Descriptions
        :column="2"
        bordered
        size="small"
        class="mt-4"
        title="草稿状态"
      >
        <DescriptionsItem label="存储位置">
          localStorage · demo:form-steps:draft
        </DescriptionsItem>
        <DescriptionsItem label="是否有草稿">
          {{ storedDraft ? '有' : '还没有' }}
        </DescriptionsItem>
        <DescriptionsItem label="最近保存">
          {{
            storedDraft
              ? new Date(storedDraft.savedAt).toLocaleString('zh-CN')
              : '—'
          }}
        </DescriptionsItem>
        <DescriptionsItem label="停在第几步">
          {{ storedDraft ? storedDraft.step + 1 : '—' }}
        </DescriptionsItem>
        <DescriptionsItem label="有值字段">
          {{ storedDraft ? filledCount(storedDraft.values) : '—' }}
        </DescriptionsItem>
        <DescriptionsItem label="本次提交">
          {{
            draft.done
              ? `${filledCount(draft.done)} 个字段校验通过`
              : '尚未提交'
          }}
        </DescriptionsItem>
      </Descriptions>

      <div class="mt-3">
        <p :class="hintClassName">localStorage 里躺着的那条原文：</p>
        <pre :class="codeClassName">{{ storedDraftJson }}</pre>
      </div>
    </Card>

    <!-- 3 -->
    <Card title="步骤可跳转 / 自定义底部" variant="borderless">
      <p :class="hintClassName">
        步骤条是可以点回去的：<code>Steps</code> 开了
        <code>clickable</code> 就每步接点击，没走过的步骤点下去由
        <code>jumpTo</code> 的守卫拦下来并给一句提示，走过的点下去直接
        <code>gotoStep</code> 换回那一步的 schema（跳转不校验，值照样带得走）。
        <strong>别用 <code>v-model:current</code></strong
        >：<code>current</code> 是受控的， 单向写步骤号会把步骤号和字段拆开 ——
        指示条到第 3 步了，表单还在渲染第 1 步的字段。 这里只绑
        <code>:current</code> + <code>@change</code>，让步骤号必须经过换 schema
        的那条路。
      </p>
      <p :class="hintClassName">
        底部按钮不在卡片里另起一行，而是塞进 <code>BasicForm</code> 的动作区插槽
        （<code>#submitBefore</code> 排在按钮位的第一格，<code
          >#actionAfter</code
        >
        排在最后）， 同时用模板 prop 关掉内置的查询/重置按钮 —— 注意
        <code>showSubmitButton</code> 这类有
        <code>withDefaults</code> 默认值的开关，塞进 <code>useForm</code> 会被
        <code>deepMerge</code> 的「目标优先」吃掉，必须在模板上传。
      </p>

      <div :class="stepClassName">
        <Steps
          :current="jump.step"
          :items="jump.stepItems"
          clickable
          size="small"
          @change="jump.jumpTo"
        />
        <BasicForm
          :show-reset-button="false"
          :show-submit-button="false"
          @register="jump.register"
        >
          <template #submitBefore>
            <Button :disabled="jump.step === 0" @click="jump.prev()">
              上一步
            </Button>
          </template>
          <template #actionAfter>
            <span :class="metaClassName">
              最远走到第 {{ jump.furthest + 1 }} 步 · 已攒
              {{ filledCount(jump.values) }} 个字段
            </span>
            <Button v-if="!jump.isLast" @click="jump.next()"> 下一步 </Button>
            <Button v-else @click="submitJump"> 提交 </Button>
          </template>
        </BasicForm>
      </div>

      <div v-if="jump.done" class="mt-4 flex flex-wrap items-center gap-3">
        <Alert
          type="success"
          show-icon
          class="flex-1"
          message="已提交（本地演示，无接口调用）"
          :description="
            summaryRows(jumpSteps, jump.done)
              .map((row) => `${row.label}：${row.text}`)
              .join('；')
          "
        />
        <Button variant="outline" @click="restartJump"> 重新填写 </Button>
      </div>
    </Card>

    <!-- 4 -->
    <Card title="复杂步骤内容" variant="borderless">
      <p :class="hintClassName">
        步骤内容不必是普通输入框，照样由同一个 <code>BasicForm</code> 管：第 2
        步用 schema 的 <code>slot</code> 渲染成表格化的多选列表，值仍然写在
        <code>formModel.services</code> 上，所以「至少选一项」的规则照常生效；第
        3 步是一份只读 <code>Descriptions</code> 摘要（<code>__summary</code>
        这种字段不进校验、也不进摘要行）加一个勾选项。
      </p>
      <p :class="hintClassName">
        多选和单勾选都走 slot：包装层的
        <code>Checkbox</code> 只认 <code>:model-value</code> +
        <code>@update:model-value</code>，数组模型由
        <code>toggleOption</code> 自己增删，布尔值由
        <code>setAgreed</code> 直接写回 <code>formModel</code> —— 写成
        <code>:checked</code> 会点了没反应。开关这类
        <code>component: 'Switch'</code> 的字段由 FormItem 把
        <code>value</code> 喂成受控值。
      </p>

      <div :class="stepClassName">
        <Steps
          :current="complex.step"
          :items="complex.stepItems"
          clickable
          size="small"
          class="mb-2"
          @change="complex.jumpTo"
        />
        <Alert
          v-if="complex.done"
          type="success"
          show-icon
          message="申请已生成本地回执（没有调用接口）"
          :description="complexDoneText"
        />
        <BasicForm
          :show-action-button-group="false"
          @register="complex.register"
        >
          <template #serviceSlot="{ model, field }">
            <div :class="serviceBoxClassName">
              <div :class="serviceHeadClassName">
                <span>服务项</span>
                <span>内容</span>
                <span>单价</span>
                <span>耗时</span>
              </div>
              <div>
                <div
                  v-for="item in serviceOptions"
                  :key="item.value"
                  :class="serviceRowClassName"
                >
                  <label class="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      :model-value="optionChecked(model, field, item.value)"
                      @update:model-value="
                        () => toggleOption(model, field, item.value)
                      "
                    />
                    {{ item.label }}
                  </label>
                  <span class="text-xs text-gray-500 dark:text-gray-400">
                    {{ item.desc }}
                  </span>
                  <span>{{ item.price }}</span>
                  <span>{{ item.hours }}</span>
                </div>
              </div>
            </div>
          </template>

          <template #summarySlot>
            <Descriptions :column="2" bordered size="small">
              <DescriptionsItem
                v-for="row in complexSummary"
                :key="row.label"
                :label="row.label"
              >
                {{ row.text }}
              </DescriptionsItem>
            </Descriptions>
          </template>

          <template #agreeSlot="{ model, field }">
            <label class="flex cursor-pointer items-center gap-2">
              <Checkbox
                :model-value="model[field] === true"
                @update:model-value="(v: any) => setAgreed(model, field, v)"
              />
              <span>我已确认上面的服务清单与价格</span>
            </label>
          </template>
        </BasicForm>

        <div :class="actionBarClassName">
          <span :class="metaClassName">
            第 {{ complex.step + 1 }}/{{ complexSteps.length }} 步 · 已选
            {{
              Array.isArray(complex.values.services)
                ? complex.values.services.length
                : 0
            }}
            项服务
          </span>
          <Button :disabled="complex.step === 0" @click="complex.prev()">
            上一步
          </Button>
          <Button v-if="!complex.isLast" @click="complex.next()">
            下一步
          </Button>
          <Button v-else @click="submitComplex"> 提交 </Button>
          <Button v-if="complex.done" variant="outline" @click="restartComplex">
            重新填写
          </Button>
        </div>
      </div>
    </Card>
  </div>
</template>
