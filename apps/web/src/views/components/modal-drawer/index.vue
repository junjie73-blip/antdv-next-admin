<script setup lang="ts">
import { computed, ref } from 'vue';

import { Alert, Card, Divider, Scrollbar, Space, Tag } from '@antdv/common-ui';
import { cn } from '@antdv/shared/utils/cn';

import {
  BasicDrawer,
  BasicModal,
  message,
  useDrawer,
  useDrawerInner,
  useModal,
} from '@antdv/popup-ui';
import {
  Button,
  Checkbox,
  RadioGroup,
  RadioGroupItem,
  Textarea,
} from '@antdv/shadcn-ui';

import InnerForm from './components/InnerForm.vue';

/**
 * 弹窗与抽屉示例页（合并自原 `scroll/modal` 与 `scroll/drawer` 两页）。
 *
 * 全程只用仓库内的自研组件：
 * - `BasicModal` + `useModal` + `useModalInner`（`@antdv/popup-ui`）
 * - `BasicDrawer` + `useDrawer`（`@antdv/popup-ui`）
 * 没有任何后端请求，所有"提交/保存"都只是同步赋值 + 本地 ref，文案里也这么写了。
 */
defineOptions({ name: 'ComponentsModalDrawer' });

const containerClassName = cn('space-y-6');

/* ============================ 1. 基础弹窗 ============================ */

const [
  registerFormModal,
  { closeModal, getVisible, openModal, setModalProps },
] = useModal();

const sentPayload = ref('');
const backFromModal = ref('');
const visibleProbe = ref('还没查询过');
const propsLog = ref<string[]>([]);

function handleOpenFormModal() {
  const payload = {
    id: Math.floor(1000 + Math.random() * 9000),
    name: '张三',
    email: 'zhangsan@example.com',
    department: '研发部',
    remark: '这段数据由父页面 openModal(true, data) 传入',
    // 数据通道是原样透传的，所以回调查也可以一起塞进去
    onSubmit: (values: Record<string, any>) => {
      backFromModal.value = JSON.stringify(
        { ...values, onSubmit: undefined },
        null,
        2,
      );
      message.success('弹窗已把表单回传到示例页');
    },
  };
  sentPayload.value = JSON.stringify(
    { ...payload, onSubmit: undefined },
    null,
    2,
  );
  openModal(true, payload);
}

function handleCloseModal() {
  closeModal();
  message.info('已调用 useModal().closeModal()');
}

function handleProbeVisible() {
  visibleProbe.value = `${new Date().toLocaleTimeString()} · getVisible() = ${getVisible()}`;
}

/**
 * `setModalProps` 不改 `defineProps` 交出来的只读 props，而是把覆盖值并进组件内部的
 * `propOverrides`，渲染一律读 `merged`，所以标题、按钮文案、宽度当场生效。
 */
function handleSetModalProps() {
  const attempted = {
    okText: '确认修改',
    title: '标题被 setModalProps 改掉',
    width: '640px',
  };
  setModalProps(attempted);
  propsLog.value.unshift(
    `${new Date().toLocaleTimeString()} · setModalProps(${JSON.stringify(attempted)}) 已发出，` +
      `弹窗实际状态 getVisible() = ${getVisible()}（标题/按钮/宽度已按覆盖值重渲染）`,
  );
  message.success('props 覆盖层已生效，标题、按钮文案、宽度都变了');
}

/* ============================ 2. 弹窗内滚动 ============================ */

interface ChangeLog {
  detail: string;
  id: number;
  title: string;
}

const logOwners = ['菜单管理', '字典管理', '角色权限', '定时任务'];
const changeLogs = ref<ChangeLog[]>(
  Array.from({ length: 24 }, (_, i) => ({
    id: i + 1,
    title: `配置变更 #${i + 1}`,
    detail: `${logOwners[i % 4]} 的第 ${i + 1} 条改动记录，用于撑开内容区触发内部滚动。`,
  })),
);
const selectedLogId = ref<null | number>(null);
const fixedReadResult = ref('');

const [
  registerFixedModal,
  { closeModal: closeFixedModal, openModal: openFixedModal },
] = useModal();
const [
  registerFitModal,
  { closeModal: closeFitModal, openModal: openFitModal },
] = useModal();

function handleFixedOk() {
  fixedReadResult.value =
    selectedLogId.value === null
      ? '未选择任何条目'
      : `已选择第 ${selectedLogId.value} 条：${changeLogs.value[selectedLogId.value - 1]?.title}`;
  message.success('选择已提交，弹窗随后关闭并把确认按钮 loading 复位');
  closeFixedModal();
}

const fitPage = ref(1);
const fitLogs = computed(() =>
  Array.from({ length: 12 * fitPage.value }, (_, i) => ({
    id: i + 1,
    title: `审计日志 #${i + 1}`,
    detail: `第 ${i + 1} 行内容：${logOwners[i % 4]} 操作说明。`,
  })),
);

function handleAppendContent() {
  fitPage.value += 1;
  message.info(`已追加 12 行，当前 ${fitLogs.value.length} 行`);
}

/* ============================ 3. 抽屉基础与位置 ============================ */

const [
  registerLeftDrawer,
  { closeDrawer: closeLeftDrawer, openDrawer: openLeftDrawer },
] = useDrawer();
const [
  registerRightDrawer,
  { closeDrawer: closeRightDrawer, openDrawer: openRightDrawer },
] = useDrawer();
const [
  registerBottomDrawer,
  { closeDrawer: closeBottomDrawer, openDrawer: openBottomDrawer },
] = useDrawer();

const density = ref('standard');
const checkedModules = ref<string[]>(['system', 'monitor']);
const allModules = ['system', 'monitor', 'report', 'schedule', 'notice'];
const animationMs = ref('200');
const drawerResult = ref('');

/** 独立 Checkbox 组合出原来 CheckboxGroup 的数组模型 */
function toggleModule(item: string, checked: boolean) {
  checkedModules.value = checked
    ? [...checkedModules.value, item]
    : checkedModules.value.filter((name) => name !== item);
}

function handleApplyLeft() {
  drawerResult.value = `左侧抽屉（:width="360"）→ 密度 = ${density.value}`;
  message.success('布局偏好已应用到页面状态');
  closeLeftDrawer();
}

function handleFinishRight() {
  drawerResult.value = `右侧抽屉（:size="520"）→ 已选模块 = ${checkedModules.value.join('、') || '（空）'}`;
  message.success('模块选择已回写示例页');
  closeRightDrawer();
}

function handleApplyBottom() {
  drawerResult.value = `底部抽屉（:height="280"）→ 过渡时长 = ${animationMs.value}ms`;
  closeBottomDrawer();
}

/* ============================ 4. 抽屉内滚动 ============================ */

/**
 * 本仓库的 `useDrawerInner` 只是 `useDrawer` 的别名导出
 * （见 `Drawer/index.ts`），没有 `useModalInner` 那样的数据回调，
 * 所以抽屉侧的句柄统一按 `openDrawer / closeDrawer / setDrawerProps` 使用。
 */
const [
  registerScrollDrawer,
  { closeDrawer: closeScrollDrawer, openDrawer: openScrollDrawer },
] = useDrawerInner();

const terms = Array.from({ length: 16 }, (_, i) => ({
  id: i + 1,
  text: `第 ${i + 1} 条：抽屉内容区由 BasicDrawer 内部包了一层 @antdv/scrollbar-ui，头部与底部按钮不参与滚动。`,
}));
const innerScrollTop = ref(0);
const reachedBottom = ref(false);
const scrollBarRef = ref<InstanceType<typeof Scrollbar> | null>(null);
const agreement = ref(false);
const scrollDrawerResult = ref('');

function handleInnerScroll(payload: { scrollLeft: number; scrollTop: number }) {
  innerScrollTop.value = Math.round(payload.scrollTop);
  const wrap = scrollBarRef.value?.wrap;
  if (wrap) {
    reachedBottom.value =
      wrap.scrollTop + wrap.clientHeight >= wrap.scrollHeight - 4;
  }
}

function handleAgree() {
  scrollDrawerResult.value = `已阅读并同意（内部 Scrollbar 滚动位置 ${innerScrollTop.value}px）`;
  message.success('协议已确认');
  closeScrollDrawer();
}
/* ==================== 5. 嵌套与关闭拦截（closeFunc） ==================== */

const [
  registerNestDrawer,
  { closeDrawer: closeNestDrawer, openDrawer: openNestDrawer },
] = useDrawer();
const [
  registerConfirmModal,
  { closeModal: closeConfirmModal, openModal: openConfirmModal },
] = useModal();

const draft = ref(
  '服务列表页的表格支持列宽拖拽，草稿箱里还有一条未发布的说明。',
);
const savedDraft = ref(draft.value);
const isDirty = computed(() => draft.value !== savedDraft.value);
const interceptCount = ref(0);
const nestLog = ref('');

/**
 * BasicModal / BasicDrawer 都声明了 `closeFunc?: () => Promise<boolean>`：
 * `closeModal()` / `closeDrawer()` 会先 await 它，返回 false 就不关闭。
 * X 按钮、蒙层、ESC、底部关闭按钮最终都会走到 closeDrawer()，所以四条路径都被这里拦住。
 */
async function guardCloseDrawer(): Promise<boolean> {
  if (!isDirty.value) {
    nestLog.value = `第 ${interceptCount.value + 1} 次关闭请求：内容干净，直接放行`;
    return true;
  }
  interceptCount.value += 1;
  nestLog.value = `第 ${interceptCount.value} 次关闭请求：有未保存内容，已拦截并弹出确认框`;
  openConfirmModal();
  return false;
}

function handleSaveDraft() {
  savedDraft.value = draft.value;
  nestLog.value = '草稿已保存，抽屉关闭';
  message.success('草稿已保存到页面状态（本地模拟，没有请求后端）');
  closeNestDrawer();
}

function handleDiscard() {
  draft.value = savedDraft.value;
  closeConfirmModal();
  closeNestDrawer();
  message.info('已放弃修改并关闭抽屉');
}
</script>

<template>
  <div :class="containerClassName">
    <!-- 1 -->
    <Card
      title="基础弹窗（BasicModal + useModal + useModalInner）"
      variant="borderless"
    >
      <div class="space-y-4">
        <Space wrap>
          <Button @click="handleOpenFormModal">
            openModal(true, data) 打开并传数据
          </Button>
          <Button variant="outline" @click="handleCloseModal">
            closeModal() 关闭
          </Button>
          <Button variant="outline" @click="handleProbeVisible">
            getVisible() 查询显隐
          </Button>
          <Button variant="outline" @click="handleSetModalProps">
            setModalProps() 尝试改 props
          </Button>
        </Space>
        <Alert
          type="info"
          show-icon
          message="这一节验证的是数据通道"
          description="openModal 的真实签名是 openModal(visible?, data?)；data 只有像 InnerForm 这样用 useModalInner 注册过的子组件收得到（它会把实例上的 openModal 包一层）。页面内直接写 slot 内容的弹窗收不到 data，读页面自己的 ref 就行。"
        />
        <div class="grid grid-cols-12 gap-4">
          <div class="col-span-6">
            <div class="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
              <h4
                class="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                父页面发出去的数据
              </h4>
              <pre
                class="max-h-40 overflow-auto text-xs text-gray-600 dark:text-gray-400"
                >{{ sentPayload || '（还没点过）' }}</pre>
            </div>
          </div>
          <div class="col-span-6">
            <div
              class="rounded-lg p-3"
              :class="
                backFromModal
                  ? 'bg-green-50 dark:bg-green-900/20'
                  : 'bg-gray-50 dark:bg-gray-800'
              "
            >
              <h4
                class="mb-1 text-sm font-medium text-green-700 dark:text-green-300"
              >
                弹窗点「提交」后回传的值
              </h4>
              <pre
                class="max-h-40 overflow-auto text-xs text-green-600 dark:text-green-400"
                >{{ backFromModal || '（打开弹窗，改任意字段后点提交）' }}</pre>
            </div>
          </div>
        </div>
        <div
          class="space-y-2 rounded-lg border border-dashed border-gray-300 p-3 dark:border-gray-700"
        >
          <p class="text-sm text-gray-600 dark:text-gray-400">
            方法返回值：{{ visibleProbe }}
          </p>
          <ul v-if="propsLog.length" class="space-y-1">
            <li
              v-for="(line, index) in propsLog"
              :key="index"
              class="text-xs text-gray-500 dark:text-gray-400"
            >
              {{ line }}
            </li>
          </ul>
        </div>
        <p class="text-xs text-gray-400">
          两条实测结论，抄代码前先看：1）
          <code>setModalProps</code> / <code>setDrawerProps</code> 不去写
          <code>defineProps</code> 交出来的只读
          props，而是把覆盖值并进组件内部的
          <code>propOverrides</code>，渲染统一读
          <code>merged</code>，所以标题、按钮文案、宽度都能当场翻正；2）页面级
          <code>useModal</code> 只回传 <code>openModal</code> /
          <code>closeModal</code> / <code>setModalProps</code> /
          <code>getVisible</code> 四个方法，<code>changeOkLoading</code> /
          <code>changeLoading</code> 要在弹窗内用
          <code>useModalInner</code> 才拿得到 —— BasicModal 的
          <code>register</code> 事件发的正是含这两个方法的
          <code>innerMethods</code>。确认按钮的 loading
          是组件在被点击时自己打开、
          <code>closeModal()</code>
          时复位，本页所有提交路径都会关闭弹窗，所以不会卡住。
        </p>
      </div>
    </Card>

    <InnerForm @register="registerFormModal" />

    <!-- 2 -->
    <Card title="弹窗内滚动（长内容 + 固定头部与底部）" variant="borderless">
      <div class="space-y-4">
        <Space wrap>
          <Button @click="openFixedModal(true)">
            打开固定高度弹窗（:height="360"）
          </Button>
          <Button variant="outline" @click="openFitModal(true)">
            打开自适应高度弹窗（minHeight + wrapperFooterOffset）
          </Button>
        </Space>
        <Alert
          type="info"
          show-icon
          message="滚动由 BasicModal 的内容区自己完成"
          description="ModalWrapper 读到的 props：height（固定内容区高度，px）、minHeight（最小高度，默认 200）、wrapperFooterOffset（在「视口高 - 200 - offset」的最大高度上再扣掉固定底部占位）、useWrapper（false 时不加高度上限，也就不做内部滚动）。标题区和底部按钮栏在滚动容器之外，所以滚动时始终固定。"
        />
        <div
          v-if="fixedReadResult"
          class="rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-300"
        >
          {{ fixedReadResult }}
        </div>
      </div>
    </Card>

    <BasicModal
      title="变更记录（内容区 360px 固定高）"
      :height="360"
      ok-text="提交选择"
      cancel-text="关闭"
      @register="registerFixedModal"
      @ok="handleFixedOk"
    >
      <RadioGroup
        class="w-full"
        :model-value="selectedLogId === null ? '' : String(selectedLogId)"
        @update:model-value="(v: any) => (selectedLogId = Number(v))"
      >
        <div class="space-y-2">
          <label
            v-for="log in changeLogs"
            :key="log.id"
            class="flex cursor-pointer items-start gap-2 rounded border border-gray-100 p-2 dark:border-gray-700"
          >
            <RadioGroupItem :value="String(log.id)" class="mt-0.5" />
            <div class="min-w-0">
              <p class="text-sm font-medium text-gray-800 dark:text-gray-200">
                {{ log.title }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ log.detail }}
              </p>
            </div>
          </label>
        </div>
      </RadioGroup>
    </BasicModal>

    <BasicModal
      title="审计日志（最大高度 = 视口 - 200 - 140）"
      :min-height="220"
      :wrapper-footer-offset="140"
      ok-text="知道了"
      cancel-text="关闭"
      @register="registerFitModal"
      @ok="closeFitModal"
    >
      <div class="space-y-3">
        <Button size="sm" @click="handleAppendContent"> 再追加 12 行 </Button>
        <p class="text-xs text-gray-400">
          当前 {{ fitLogs.length }} 行 ·
          内容超过最大高度后只在内容区里滚，头部与底部不动。
        </p>
        <div
          v-for="row in fitLogs"
          :key="row.id"
          class="rounded bg-gray-50 p-2 text-sm dark:bg-gray-800"
        >
          <span class="font-medium text-gray-700 dark:text-gray-300">{{
            row.title
          }}</span>
          <span class="ml-2 text-gray-500 dark:text-gray-400">{{
            row.detail
          }}</span>
        </div>
      </div>
    </BasicModal>

    <!-- 3 -->
    <Card
      title="抽屉基础与位置（左 / 右 / 底 + footer 插槽）"
      variant="borderless"
    >
      <div class="space-y-4">
        <Space wrap>
          <Button @click="openLeftDrawer(true)"> 左侧抽屉 :width="360" </Button>
          <Button @click="openRightDrawer(true)"> 右侧抽屉 :size="520" </Button>
          <Button @click="openBottomDrawer(true)">
            底部抽屉 :height="280"
          </Button>
        </Space>
        <Alert
          type="info"
          show-icon
          message="尺寸取值规则"
          description="getSize 只看 placement：left / right 取 size || width，top / bottom 取 size || height，字符串会被 parseInt 处理，所以百分比宽度并不成立 —— 这里一律给数字。给了 #footer 插槽时，内置的关闭/保存按钮整条被替换成插槽内容。"
        />
        <div
          v-if="drawerResult"
          class="rounded-lg bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
        >
          {{ drawerResult }}
        </div>
      </div>
    </Card>

    <BasicDrawer
      title="左侧抽屉 · 布局密度"
      placement="left"
      :width="360"
      @register="registerLeftDrawer"
    >
      <RadioGroup v-model="density">
        <div class="space-y-2">
          <label class="flex cursor-pointer items-center gap-2">
            <RadioGroupItem value="compact" />
            紧凑
          </label>
          <label class="flex cursor-pointer items-center gap-2">
            <RadioGroupItem value="standard" />
            标准
          </label>
          <label class="flex cursor-pointer items-center gap-2">
            <RadioGroupItem value="loose" />
            宽松
          </label>
        </div>
      </RadioGroup>
      <template #footer>
        <div
          class="flex justify-end gap-3 border-t border-gray-200 px-4 py-3 dark:border-gray-700"
        >
          <Button variant="outline" @click="closeLeftDrawer()"> 取消 </Button>
          <Button @click="handleApplyLeft"> 应用 </Button>
        </div>
      </template>
    </BasicDrawer>

    <BasicDrawer
      title="右侧抽屉 · 模块选择"
      :size="520"
      @register="registerRightDrawer"
    >
      <div class="grid grid-cols-2 gap-3">
        <label
          v-for="item in allModules"
          :key="item"
          class="flex cursor-pointer items-center gap-2"
        >
          <Checkbox
            :model-value="checkedModules.includes(item)"
            @update:model-value="(v: any) => toggleModule(item, v === true)"
          />
          {{ item }}
        </label>
      </div>
      <template #footer>
        <div
          class="flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-gray-700"
        >
          <Space>
            <Button size="sm" @click="checkedModules = [...allModules]">
              全选
            </Button>
            <Button size="sm" @click="checkedModules = []"> 清空 </Button>
          </Space>
          <Space>
            <Button variant="outline" @click="closeRightDrawer()">
              取消
            </Button>
            <Button @click="handleFinishRight"> 完成 </Button>
          </Space>
        </div>
      </template>
    </BasicDrawer>

    <BasicDrawer
      title="底部抽屉 · 过渡时长"
      placement="bottom"
      :height="280"
      @register="registerBottomDrawer"
    >
      <RadioGroup v-model="animationMs">
        <div class="space-y-2">
          <label class="flex cursor-pointer items-center gap-2">
            <RadioGroupItem value="100" />
            100ms
          </label>
          <label class="flex cursor-pointer items-center gap-2">
            <RadioGroupItem value="200" />
            200ms
          </label>
          <label class="flex cursor-pointer items-center gap-2">
            <RadioGroupItem value="400" />
            400ms
          </label>
        </div>
      </RadioGroup>
      <template #footer>
        <div
          class="flex justify-end gap-3 border-t border-gray-200 px-4 py-3 dark:border-gray-700"
        >
          <Button variant="outline" @click="closeBottomDrawer()"> 关闭 </Button>
          <Button @click="handleApplyBottom"> 应用 </Button>
        </div>
      </template>
    </BasicDrawer>

    <!-- 4 -->
    <Card title="抽屉内滚动（长内容在 body 里滚）" variant="borderless">
      <div class="space-y-4">
        <Space wrap>
          <Button @click="openScrollDrawer(true)"> 打开长内容抽屉 </Button>
        </Space>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          BasicDrawer 的 body 已经内置
          <code>Scrollbar</code>（<code>root-class="h-full"</code>），抽屉打开后
          16 条条款只在 body 内滚，标题与底部按钮固定。下面再嵌一个
          <code>@antdv/scrollbar-ui</code> 的 <code>Scrollbar</code>，用它的
          <code>@scroll</code>
          事件把滚动位置读成页面状态：只有滚到底才能勾选同意，
          没勾选时抽屉的确认按钮通过
          <code>okButtonProps.disabled</code> 保持禁用。 注意高度是给
          <code>root-class="h-60"</code>（240px）而不是
          <code>max-height</code> 属性 —— 后者会被组件内的
          <code>useResponsiveMaxHeight</code> 以 712px 为下限重新算掉。
        </p>
        <div
          v-if="scrollDrawerResult"
          class="rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-300"
        >
          {{ scrollDrawerResult }}
        </div>
      </div>
    </Card>

    <BasicDrawer
      title="抽屉内滚动 · 协议确认"
      :size="560"
      ok-text="同意并关闭"
      cancel-text="关闭"
      :ok-button-props="{ disabled: !agreement }"
      @register="registerScrollDrawer"
      @ok="handleAgree"
    >
      <div class="space-y-4">
        <div
          v-for="item in terms"
          :key="item.id"
          class="rounded border border-gray-100 p-3 text-sm dark:border-gray-700"
        >
          {{ item.text }}
        </div>
      </div>
      <Divider />
      <div class="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
        <p class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          嵌套 Scrollbar：scrollTop = {{ innerScrollTop }}px
          <span v-if="reachedBottom" class="ml-2 text-green-600">已到底部</span>
        </p>
        <Scrollbar
          ref="scrollBarRef"
          root-class="h-60"
          @scroll="handleInnerScroll"
        >
          <p
            v-for="n in 14"
            :key="n"
            class="mb-3 text-sm text-gray-600 dark:text-gray-400"
          >
            附加条款 {{ n }}：滚动条样式由 @antdv/scrollbar-ui 的 Scrollbar
            自绘， native 属性可切回浏览器默认滚动条。
          </p>
        </Scrollbar>
        <label class="mt-2 flex cursor-pointer items-center gap-2">
          <Checkbox
            :model-value="agreement"
            :disabled="!reachedBottom"
            @update:model-value="(v: any) => (agreement = v === true)"
          />
          {{
            reachedBottom ? '我已阅读完附加条款' : '先把上面的条款滚动到底部'
          }}
        </label>
      </div>
    </BasicDrawer>

    <!-- 5 -->
    <Card
      title="嵌套与关闭拦截（closeFunc + 抽屉上叠弹窗）"
      variant="borderless"
    >
      <div class="space-y-4">
        <Space wrap>
          <Button @click="openNestDrawer(true)"> 打开可编辑抽屉 </Button>
          <Tag :color="isDirty ? 'orange' : 'green'">
            {{ isDirty ? '有未保存修改' : '内容已保存' }}
          </Tag>
          <Tag color="blue">拦截 {{ interceptCount }} 次</Tag>
        </Space>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          抽屉里改几个字，再分别用
          X、蒙层、ESC、底部「关闭」去关：四种路径最后都会调用
          <code>closeDrawer()</code>，而 BasicDrawer 的
          <code>closeFunc</code>（<code>: () =&gt; Promise&lt;boolean&gt;</code
          >）被 await 且返回 false 时不关闭 ——
          这是组件自带的钩子，不需要自己接按钮。 拦截后弹出的确认框用
          <code>:z-index="1100"</code> 压在抽屉（默认
          1000）之上；点「放弃修改」会先把内容改回已保存值，关闭请求自然放行。
        </p>
        <div
          v-if="nestLog"
          class="rounded-lg bg-orange-50 p-3 text-sm text-orange-700 dark:bg-orange-900/20 dark:text-orange-300"
        >
          {{ nestLog }}
        </div>
      </div>
    </Card>

    <BasicDrawer
      title="草稿编辑（关闭前会过 closeFunc）"
      :size="520"
      ok-text="保存草稿"
      cancel-text="关闭抽屉"
      :close-func="guardCloseDrawer"
      @register="registerNestDrawer"
      @ok="handleSaveDraft"
    >
      <div class="space-y-3">
        <Alert
          :type="isDirty ? 'warning' : 'success'"
          show-icon
          :message="
            isDirty ? '有未保存内容，关闭会被拦截' : '内容与已保存值一致'
          "
        />
        <Textarea
          v-model="draft"
          :rows="8"
          placeholder="随便改几个字试试关闭"
        />
        <p class="text-xs text-gray-400">
          已保存内容：{{ savedDraft || '（空）' }}
        </p>
      </div>
    </BasicDrawer>

    <BasicModal
      title="关闭被拦截了"
      :z-index="1100"
      ok-text="放弃修改并关闭"
      cancel-text="留在页面"
      ok-type="danger"
      @register="registerConfirmModal"
      @ok="handleDiscard"
    >
      <p class="text-gray-600 dark:text-gray-400">
        抽屉里有未保存的修改，确认要放弃吗？这个弹窗叠在抽屉之上，靠的是
        BasicModal 的
        <code>zIndex</code> 属性（抽屉默认 1000，这里给 1100）。
      </p>
    </BasicModal>
  </div>
</template>
