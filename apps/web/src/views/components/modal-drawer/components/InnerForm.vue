<script setup lang="ts">
import { reactive, ref } from 'vue';

import { Button as AButton, Col as ACol, Form as AForm, FormItem as AFormItem, Input as AInput, Row as ARow, TextArea as ATextarea, message } from 'antdv-next';
import { BasicModal, useModalInner } from '~/components/business/Modal';

/**
 * 页面私有子组件（`views/<page>/components/**` 不参与路由），只服务示例页第 1 节。
 *
 * 为什么数据能传进来：
 * 父页面写的是 `<InnerForm @register="registerModal" />`，InnerForm 没有声明
 * `register` 这个 emit，所以父级的监听函数留在 `$attrs` 里；模板上的
 * `v-bind="$attrs"` 把它继续透传给 BasicModal。于是 BasicModal 那一次
 * `emit('register', modalMethods)` 同时喂到两个注册函数：
 * 1. 父页面的 `useModal` —— 拿到 openModal / closeModal / setModalProps；
 * 2. 这里的 `useModalInner` —— 它会把同一个实例对象上的 `openModal` 包一层，
 *    因此父页面 `openModal(true, data)` 传进来的 data 会先进本组件的回调。
 *
 * `inheritAttrs: false` 是因为下面已经显式 `v-bind="$attrs"`：单根组件默认还会再做一次
 * attrs 透传，那样父级的 `onRegister` 会被调用两遍。
 */
defineOptions({ name: 'ModalDrawerInnerForm', inheritAttrs: false });

interface InnerFormPayload {
  department: string;
  email: string;
  id: number;
  name: string;
  onSubmit?: (values: InnerFormPayload) => void;
  remark: string;
}

const emptyForm: InnerFormPayload = {
  id: 0,
  name: '',
  email: '',
  department: '',
  remark: '',
};

const form = reactive<InnerFormPayload>({ ...emptyForm });
const receivedAt = ref('尚未收到数据');
const receivedJson = ref('');
const times = ref(0);

const [registerModal, { closeModal }] = useModalInner<InnerFormPayload>(
  (data) => {
    Object.assign(form, emptyForm, data);
    times.value += 1;
    receivedAt.value = new Date().toLocaleTimeString();
    // JSON.stringify 会自动丢掉函数属性，这里展示的是纯粹的数据部分
    receivedJson.value = JSON.stringify(data, null, 2);
  },
);

/** 点击内置「提交」：BasicModal 内部会把确认按钮置为 loading，closeModal 时复位 */
function handleSubmit() {
  const values: InnerFormPayload = { ...form };
  form.onSubmit?.(values);
  closeModal();
}

function handleReset() {
  Object.assign(form, { ...emptyForm, id: form.id });
  message.info('表单已重置（弹窗保持打开）');
}
</script>

<template>
  <BasicModal
    v-bind="$attrs"
    title="编辑用户信息"
    width="520px"
    ok-text="提交"
    cancel-text="取消"
    @register="registerModal"
    @ok="handleSubmit"
  >
    <div class="space-y-4">
      <div class="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
        <p class="text-sm text-blue-700 dark:text-blue-300">
          useModalInner 回调第 {{ times }} 次收到数据 · {{ receivedAt }}
        </p>
        <pre
          v-if="receivedJson"
          class="mt-2 text-xs break-all whitespace-pre-wrap text-blue-600 dark:text-blue-400"
          >{{ receivedJson }}</pre>
      </div>

      <AForm :model="form" layout="vertical">
        <ARow :gutter="16">
          <ACol :span="12">
            <AFormItem label="姓名">
              <AInput v-model:value="form.name" placeholder="请输入姓名" />
            </AFormItem>
          </ACol>
          <ACol :span="12">
            <AFormItem label="邮箱">
              <AInput v-model:value="form.email" placeholder="请输入邮箱" />
            </AFormItem>
          </ACol>
        </ARow>
        <AFormItem label="部门">
          <AInput v-model:value="form.department" placeholder="请输入部门" />
        </AFormItem>
        <AFormItem label="备注">
          <ATextarea
            v-model:value="form.remark"
            :rows="3"
            placeholder="请输入备注"
          />
        </AFormItem>
        <p class="text-xs text-gray-400">数据 ID：{{ form.id }}</p>
      </AForm>
    </div>

    <!-- 内置底部按钮栏里的插槽：footer 用了 slot 就没有默认按钮，这里用 centerFooter -->
    <template #centerFooter>
      <AButton @click="handleReset"> 重置 </AButton>
    </template>
  </BasicModal>
</template>
