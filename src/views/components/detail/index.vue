<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { cn } from '@/utils/cn'
import { ref } from 'vue'
import { message } from 'antdv-next'

const containerClassName = cn('space-y-6')
const copyButtonClassName = cn('ml-2 text-blue-600 hover:text-blue-800 cursor-pointer')

const userInfo = ref({
  id: 'USR20240115001',
  name: '张三',
  username: 'zhangsan',
  email: 'zhangsan@example.com',
  phone: '138****8888',
  gender: '男',
  age: 28,
  birthday: '1996-05-15',
  department: '技术研发部',
  position: '高级前端工程师',
  level: 'P7',
  status: '在职',
  address: '北京市朝阳区建国路88号SOHO现代城',
  createTime: '2024-01-15 10:30:00',
  updateTime: '2024-12-20 14:25:00',
  lastLoginTime: '2024-12-20 09:15:00',
  bio: '热爱技术，专注于前端开发领域，擅长 Vue、React 等主流框架，有丰富的项目经验',
})

const orderInfo = ref({
  orderId: 'ORD20241220001',
  orderNo: 'DD20241220001234',
  customerName: '李四',
  customerPhone: '139****6666',
  totalAmount: 2999.00,
  discountAmount: 300.00,
  payAmount: 2699.00,
  paymentMethod: '微信支付',
  orderStatus: '已完成',
  payTime: '2024-12-18 16:30:00',
  deliveryTime: '2024-12-19 10:20:00',
  completeTime: '2024-12-20 11:45:00',
  receiverName: '李四',
  receiverPhone: '139****6666',
  receiverAddress: '上海市浦东新区陆家嘴环路1000号恒生银行大厦',
  expressCompany: '顺丰速运',
  expressNo: 'SF1234567890123',
  remark: '请在工作日配送',
})

const orderItems = ref([
  { id: 1, name: 'MacBook Pro 14英寸', spec: 'M3 Pro芯片 / 18GB内存 / 512GB存储', price: 16999.00, quantity: 1 },
  { id: 2, name: 'Apple Magic Mouse', spec: '黑色 / 无线充电', price: 699.00, quantity: 1 },
  { id: 3, name: 'USB-C转接头', spec: '多端口 / 铝合金', price: 299.00, quantity: 2 },
])

const orderItemColumns = [
  { title: '商品名称', dataIndex: 'name', key: 'name' },
  { title: '规格', dataIndex: 'spec', key: 'spec' },
  { title: '单价', dataIndex: 'price', key: 'price', width: 120, align: 'right' },
  { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 80, align: 'center' },
  { title: '小计', key: 'subtotal', width: 120 },
]

function handleCopy(text: string) {
  navigator.clipboard.writeText(text).then(() => {
    message.success('已复制到剪贴板')
  }).catch(() => {
    const textarea = document.createElement('textarea')
    textarea.value = text
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    message.success('已复制到剪贴板')
  })
}

const columnCount = ref(2)
</script>

<template>
  <div :class="containerClassName">
    <a-card title="基础用法">
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        最基础的用法，展示用户基本信息（标签 + 内容对齐）
      </p>
      <a-descriptions :column="2" title="用户基本信息">
        <a-descriptions-item label="用户ID">
          {{ userInfo.id }}
          <Icon icon="carbon:copy" :class="copyButtonClassName" @click="handleCopy(userInfo.id)" />
        </a-descriptions-item>
        <a-descriptions-item label="用户名">
          {{ userInfo.username }}
        </a-descriptions-item>
        <a-descriptions-item label="姓名">
          {{ userInfo.name }}
        </a-descriptions-item>
        <a-descriptions-item label="性别">
          {{ userInfo.gender }}
        </a-descriptions-item>
        <a-descriptions-item label="年龄">
          {{ userInfo.age }} 岁
        </a-descriptions-item>
        <a-descriptions-item label="生日">
          {{ userInfo.birthday }}
        </a-descriptions-item>
      </a-descriptions>
    </a-card>

    <a-card title="边框模式 (bordered)">
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        带边框的描述列表，视觉上更加清晰分明
      </p>
      <a-descriptions :column="3" bordered title="联系方式">
        <a-descriptions-item label="邮箱">
          <div class="flex items-center">
            <span>{{ userInfo.email }}</span>
            <Icon icon="carbon:copy" :class="copyButtonClassName" @click="handleCopy(userInfo.email)" />
          </div>
        </a-descriptions-item>
        <a-descriptions-item label="手机">
          <div class="flex items-center">
            <span>{{ userInfo.phone }}</span>
            <Icon icon="carbon:copy" :class="copyButtonClassName" @click="handleCopy(userInfo.phone)" />
          </div>
        </a-descriptions-item>
        <a-descriptions-item label="地址">
          {{ userInfo.address }}
        </a-descriptions-item>
      </a-descriptions>

      <a-divider />

      <a-descriptions :column="2" bordered title="工作信息">
        <a-descriptions-item label="部门">
          <a-tag color="blue">{{ userInfo.department }}</a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="职位">
          {{ userInfo.position }}
        </a-descriptions-item>
        <a-descriptions-item label="职级">
          <a-tag color="gold">{{ userInfo.level }}</a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="状态">
          <a-badge :status="userInfo.status === '在职' ? 'success' : 'default'" :text="userInfo.status" />
        </a-descriptions-item>
      </a-descriptions>
    </a-card>

    <a-card title="响应式列">
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        通过调整列数查看不同布局效果
      </p>
      <div class="mb-4 flex gap-2">
        <a-button :type="columnCount === 1 ? 'primary' : 'default'" @click="columnCount = 1">1列</a-button>
        <a-button :type="columnCount === 2 ? 'primary' : 'default'" @click="columnCount = 2">2列</a-button>
        <a-button :type="columnCount === 3 ? 'primary' : 'default'" @click="columnCount = 3">3列</a-button>
        <a-button :type="columnCount === 4 ? 'primary' : 'default'" @click="columnCount = 4">4列</a-button>
      </div>
      <a-descriptions :column="columnCount" bordered>
        <a-descriptions-item v-for="(value, key) in {
          '订单编号': orderInfo.orderId,
          '订单单号': orderInfo.orderNo,
          '客户姓名': orderInfo.customerName,
          '客户电话': orderInfo.customerPhone,
          '订单总额': `¥${orderInfo.totalAmount.toFixed(2)}`,
          '优惠金额': `-¥${orderInfo.discountAmount.toFixed(2)}`,
          '实付金额': `¥${orderInfo.payAmount.toFixed(2)}`,
          '支付方式': orderInfo.paymentMethod,
          '订单状态': orderInfo.orderStatus,
          '支付时间': orderInfo.payTime,
          '配送时间': orderInfo.deliveryTime,
          '完成时间': orderInfo.completeTime,
        }" :key="key" :label="key">
          <template v-if="key.includes('金额')">
            <span :class="key.includes('优惠') ? 'text-green-600' : key.includes('实付') ? 'text-red-600 font-semibold' : ''">
              {{ value }}
            </span>
          </template>
          <template v-else-if="key === '订单状态'">
            <a-tag :color="({
              '已完成': 'success',
              '待支付': 'warning',
              '已取消': 'error'
            }[value] || 'processing')">
              {{ value }}
            </a-tag>
          </template>
          <template v-else>
            {{ value }}
          </template>
        </a-descriptions-item>
      </a-descriptions>
    </a-card>

    <a-card title="自定义 Label 样式">
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        使用自定义渲染函数为 label 添加图标和颜色，提升可读性
      </p>
      <a-descriptions :column="2" bordered>
        <a-descriptions-item>
          <template #label>
            <span class="flex items-center text-blue-600">
              <Icon icon="carbon:user" class="mr-2" />
              用户名
            </span>
          </template>
          {{ userInfo.username }}
        </a-descriptions-item>
        <a-descriptions-item>
          <template #label>
            <span class="flex items-center text-green-600">
              <Icon icon="carbon:email" class="mr-2" />
              邮箱
            </span>
          </template>
          {{ userInfo.email }}
        </a-descriptions-item>
        <a-descriptions-item>
          <template #label>
            <span class="flex items-center text-orange-600">
              <Icon icon="carbon:phone" class="mr-2" />
              手机
            </span>
          </template>
          {{ userInfo.phone }}
        </a-descriptions-item>
        <a-descriptions-item>
          <template #label>
            <span class="flex items-center text-purple-600">
              <Icon icon="carbon:building" class="mr-2" />
              部门
            </span>
          </template>
          {{ userInfo.department }}
        </a-descriptions-item>
        <a-descriptions-item>
          <template #label>
            <span class="flex items-center text-pink-600">
              <Icon icon="carbon:badge" class="mr-2" />
              职位
            </span>
          </template>
          {{ userInfo.position }}
        </a-descriptions-item>
        <a-descriptions-item>
          <template #label>
            <span class="flex items-center text-indigo-600">
              <Icon icon="carbon:star-filled" class="mr-2" />
              职级
            </span>
          </template>
          <a-tag color="gold">{{ userInfo.level }}</a-tag>
        </a-descriptions-item>
        <a-descriptions-item>
          <template #label>
            <span class="flex items-center text-teal-600">
              <Icon icon="carbon:time" class="mr-2" />
              创建时间
            </span>
          </template>
          {{ userInfo.createTime }}
        </a-descriptions-item>
        <a-descriptions-item>
          <template #label>
            <span class="flex items-center text-cyan-600">
              <Icon icon="carbon:restart" class="mr-2" />
              更新时间
            </span>
          </template>
          {{ userInfo.updateTime }}
        </a-descriptions-item>
      </a-descriptions>
    </a-card>

    <a-card title="嵌套分组详情 - 完整用户档案">
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        模拟完整的用户详情页，包含多个信息分组
      </p>

      <a-descriptions :column="3" bordered title="基本信息" class="mb-6">
        <a-descriptions-item label="姓名">
          {{ userInfo.name }}
        </a-descriptions-item>
        <a-descriptions-item label="性别">
          {{ userInfo.gender }}
        </a-descriptions-item>
        <a-descriptions-item label="年龄">
          {{ userInfo.age }} 岁
        </a-descriptions-item>
        <a-descriptions-item label="生日">
          {{ userInfo.birthday }}
        </a-descriptions-item>
        <a-descriptions-item label="个人简介" :span="2">
          {{ userInfo.bio }}
        </a-descriptions-item>
      </a-descriptions>

      <a-descriptions :column="2" bordered title="联系方式" class="mb-6">
        <a-descriptions-item label="邮箱">
          {{ userInfo.email }}
          <Icon icon="carbon:copy" :class="copyButtonClassName" @click="handleCopy(userInfo.email)" />
        </a-descriptions-item>
        <a-descriptions-item label="手机">
          {{ userInfo.phone }}
          <Icon icon="carbon:copy" :class="copyButtonClassName" @click="handleCopy(userInfo.phone)" />
        </a-descriptions-item>
        <a-descriptions-item label="地址" :span="2">
          {{ userInfo.address }}
        </a-descriptions-item>
      </a-descriptions>

      <a-descriptions :column="2" bordered title="工作信息" class="mb-6">
        <a-descriptions-item label="部门">
          <a-tag color="blue">{{ userInfo.department }}</a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="职位">
          {{ userInfo.position }}
        </a-descriptions-item>
        <a-descriptions-item label="职级">
          <a-tag color="gold">{{ userInfo.level }}</a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="状态">
          <a-badge :status="userInfo.status === '在职' ? 'success' : 'default'" :text="userInfo.status" />
        </a-descriptions-item>
      </a-descriptions>

      <a-descriptions :column="3" bordered title="时间记录">
        <a-descriptions-item label="注册时间">
          {{ userInfo.createTime }}
        </a-descriptions-item>
        <a-descriptions-item label="最后更新">
          {{ userInfo.updateTime }}
        </a-descriptions-item>
        <a-descriptions-item label="最后登录">
          {{ userInfo.lastLoginTime }}
        </a-descriptions-item>
      </a-descriptions>
    </a-card>

    <a-card title="订单详情示例">
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        展示一个完整订单的详细信息，包含商品列表和物流信息
      </p>

      <a-descriptions :column="3" bordered title="订单信息" class="mb-6">
        <a-descriptions-item label="订单编号">
          {{ orderInfo.orderId }}
          <Icon icon="carbon:copy" :class="copyButtonClassName" @click="handleCopy(orderInfo.orderId)" />
        </a-descriptions-item>
        <a-descriptions-item label="订单状态">
          <a-tag color="success">{{ orderInfo.orderStatus }}</a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="支付方式">
          {{ orderInfo.paymentMethod }}
        </a-descriptions-item>
        <a-descriptions-item label="订单总额">
          ¥{{ orderInfo.totalAmount.toFixed(2) }}
        </a-descriptions-item>
        <a-descriptions-item label="优惠金额">
          <span class="text-green-600">-¥{{ orderInfo.discountAmount.toFixed(2) }}</span>
        </a-descriptions-item>
        <a-descriptions-item label="实付金额">
          <span class="text-red-600 font-bold text-lg">¥{{ orderInfo.payAmount.toFixed(2) }}</span>
        </a-descriptions-item>
      </a-descriptions>

      <h4 class="font-medium mb-3 flex items-center gap-2">
        <Icon icon="carbon:shopping-cart" />
        商品清单
      </h4>
      <a-table :data-source="orderItems" :pagination="false" row-key="id" size="small" :columns="orderItemColumns">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'price'">
            ¥{{ record?.price?.toFixed(2) ?? '-' }}
          </template>
          <template v-else-if="column.key === 'subtotal'">
            <span class="font-medium">¥{{ ((record?.price ?? 0) * (record?.quantity ?? 0)).toFixed(2) }}</span>
          </template>
        </template>
      </a-table>

      <a-divider />
      <a-descriptions :column="2" bordered title="收货与物流信息" class="mt-6">
        <a-descriptions-item label="收货人">
          {{ orderInfo.receiverName }}
        </a-descriptions-item>
        <a-descriptions-item label="联系电话">
          {{ orderInfo.receiverPhone }}
        </a-descriptions-item>
        <a-descriptions-item label="收货地址" :span="2">
          {{ orderInfo.receiverAddress }}
        </a-descriptions-item>
        <a-descriptions-item label="快递公司">
          {{ orderInfo.expressCompany }}
        </a-descriptions-item>
        <a-descriptions-item label="快递单号">
          {{ orderInfo.expressNo }}
          <Icon icon="carbon:copy" :class="copyButtonClassName" @click="handleCopy(orderInfo.expressNo)" />
        </a-descriptions-item>
        <a-descriptions-item label="支付时间" :span="1">
          {{ orderInfo.payTime }}
        </a-descriptions-item>
        <a-descriptions-item label="配送时间" :span="1">
          {{ orderInfo.deliveryTime }}
        </a-descriptions-item>
        <a-descriptions-item label="完成时间" :span="2">
          {{ orderInfo.completeTime }}
        </a-descriptions-item>
        <a-descriptions-item label="备注" :span="2">
          {{ orderInfo.remark || '无' }}
        </a-descriptions-item>
      </a-descriptions>
    </a-card>

    <a-card title="可复制内容功能">
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        点击复制图标即可将内容复制到剪贴板
      </p>
      <a-descriptions :column="2" bordered>
        <a-descriptions-item label="用户ID">
          <div class="flex items-center justify-between min-w-[200px]">
            <code class="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-sm">{{ userInfo.id }}</code>
            <a-tooltip title="点击复制">
              <Icon icon="carbon:copy" class="cursor-pointer hover:text-blue-600 transition-colors" @click="handleCopy(userInfo.id)" />
            </a-tooltip>
          </div>
        </a-descriptions-item>
        <a-descriptions-item label="邮箱地址">
          <div class="flex items-center justify-between min-w-[200px]">
            <span>{{ userInfo.email }}</span>
            <a-tooltip title="点击复制">
              <Icon icon="carbon:copy" class="cursor-pointer hover:text-blue-600 transition-colors" @click="handleCopy(userInfo.email)" />
            </a-tooltip>
          </div>
        </a-descriptions-item>
        <a-descriptions-item label="订单编号">
          <div class="flex items-center justify-between min-w-[200px]">
            <code class="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-sm">{{ orderInfo.orderId }}</code>
            <a-tooltip title="点击复制">
              <Icon icon="carbon:copy" class="cursor-pointer hover:text-blue-600 transition-colors" @click="handleCopy(orderInfo.orderId)" />
            </a-tooltip>
          </div>
        </a-descriptions-item>
        <a-descriptions-item label="快递单号">
          <div class="flex items-center justify-between min-w-[200px]">
            <span>{{ orderInfo.expressNo }}</span>
            <a-tooltip title="点击复制">
              <Icon icon="carbon:copy" class="cursor-pointer hover:text-blue-600 transition-colors" @click="handleCopy(orderInfo.expressNo)" />
            </a-tooltip>
          </div>
        </a-descriptions-item>
      </a-descriptions>
    </a-card>
  </div>
</template>
