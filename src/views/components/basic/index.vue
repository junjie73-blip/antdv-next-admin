<script setup lang="ts">
import dayjs from 'dayjs'
import { ref } from 'vue'
import { cn } from '@/utils/cn'

// 容器样式
const containerClassName = cn('space-y-6')

// 通用样式 - 标签文字
const labelClassName = cn('text-sm', 'text-gray-500', 'mb-2')
const labelMb3ClassName = cn('text-sm', 'text-gray-500', 'mb-3')

// 通用样式 - 按钮容器
const buttonGroupClassName = cn('flex', 'flex-wrap', 'gap-3')
const buttonItemsCenterClassName = cn('flex', 'flex-wrap', 'items-center', 'gap-3')

// 通用样式 - 网格布局
const gridCols2ClassName = cn('grid', 'grid-cols-1', 'md:grid-cols-2', 'gap-6')
const gridCols3ClassName = cn('grid', 'grid-cols-1', 'md:grid-cols-3', 'gap-6')

// 通用样式 - Flex 布局
const flexColGap2ClassName = cn('flex', 'flex-col', 'gap-2')
const flexWrapItemsCenterGap8ClassName = cn('flex', 'flex-wrap', 'items-center', 'gap-8')
const flexWrapItemsCenterGap12ClassName = cn('flex', 'flex-wrap', 'items-center', 'gap-12')
const flexItemsCenterGap4ClassName = cn('flex', 'items-center', 'gap-4')

// Typography 样式
const h1ClassName = cn('text-3xl', 'font-bold', 'text-gray-900', 'dark:text-white', 'mb-2')
const h2ClassName = cn('text-2xl', 'font-semibold', 'text-gray-800', 'dark:text-gray-100', 'mb-2')
const h3ClassName = cn('text-xl', 'font-medium', 'text-gray-700', 'dark:text-gray-200', 'mb-2')
const h4ClassName = cn('text-lg', 'font-medium', 'text-gray-600', 'dark:text-gray-300')
const paragraphClassName = cn('text-gray-700', 'dark:text-gray-300', 'leading-relaxed', 'mb-3')
const helperTextClassName = cn('text-gray-500', 'dark:text-gray-400', 'text-sm')
const linkClassName = cn('text-blue-500', 'hover:text-blue-600')
const ellipsisClassName = cn(
  'w-full',
  'overflow-hidden',
  'text-ellipsis',
  'whitespace-pre-wrap',
  'break-all',
)

// Input 相关状态
const inputText = ref('')
const passwordValue = ref('')
const searchText = ref('')
const textareaValue = ref('')

// Select 相关状态
const selectValue = ref<string>()
const multiSelectValue = ref<string[]>([])
const searchSelectValue = ref<string>()

const selectOptions = [
  { value: 'option1', label: '选项一' },
  { value: 'option2', label: '选项二' },
  { value: 'option3', label: '选项三' },
  { value: 'option4', label: '选项四' },
]

// Radio 相关状态
const radioValue = ref('apple')
const buttonRadioValue = ref('beijing')

// Checkbox 相关状态
const checkboxValues = ref<string[]>(['apple'])
const checkAll = ref(false)
const isIndeterminate = ref(true)
const buttonCheckboxValues = ref<string[]>([])

// Switch 相关状态
const switchValue = ref(false)
const switchWithText = ref(true)
const smallSwitchValue = ref(true)

// Slider 相关状态
const sliderValue = ref(30)
const inputSliderValue = ref(50)
const rangeSliderValue = ref<[number, number]>([20, 60])
const verticalSliderValue = ref(30)

// Rate 相关状态
const rateValue = ref(3)
const allowHalfRateValue = ref(2.5)
const readonlyRateValue = ref(4)

// DatePicker 相关状态
const dateValue = ref<dayjs.Dayjs>(dayjs())
const dateRangeValue = ref<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().subtract(7, 'day'), dayjs()])
const timeValue = ref<dayjs.Dayjs>(dayjs())

// Checkbox 全选/取消逻辑
const fruitOptions = ['apple', 'banana', 'orange']
function handleCheckAllChange(checked: boolean) {
  checkboxValues.value = checked ? [...fruitOptions] : []
  isIndeterminate.value = false
}
function handleCheckedChange(values: string[]) {
  const checkedCount = values.length
  checkAll.value = checkedCount === fruitOptions.length
  isIndeterminate.value = checkedCount > 0 && checkedCount < fruitOptions.length
}
</script>

<template>
  <div :class="containerClassName">
    <!-- 1. Button 按钮 -->
    <a-card
      title="Button 按钮"
      :variant="borderless"
    >
      <div :class="cn('space-y-6')">
        <!-- 按钮类型 -->
        <div>
          <div :class="labelMb3ClassName">
            按钮类型
          </div>
          <div :class="buttonGroupClassName">
            <a-button type="primary">
              主要按钮
            </a-button>
            <a-button>默认按钮</a-button>
            <a-button type="dashed">
              虚线按钮
            </a-button>
            <a-button type="text">
              文本按钮
            </a-button>
            <a-button type="outline">
              轮廓按钮
            </a-button>
          </div>
        </div>

        <!-- 按钮尺寸 -->
        <div>
          <div :class="labelMb3ClassName">
            按钮尺寸
          </div>
          <div :class="buttonItemsCenterClassName">
            <a-button
              size="small"
              type="primary"
            >
              小号按钮
            </a-button>
            <a-button
              size="medium"
              type="primary"
            >
              中号按钮
            </a-button>
            <a-button
              size="large"
              type="primary"
            >
              大号按钮
            </a-button>
          </div>
        </div>

        <!-- 按钮形状 -->
        <div>
          <div :class="labelMb3ClassName">
            按钮形状
          </div>
          <div :class="buttonGroupClassName">
            <a-button
              shape="round"
              type="primary"
            >
              圆角按钮
            </a-button>
            <a-button
              shape="circle"
              type="primary"
            >
              圆形
            </a-button>
          </div>
        </div>

        <!-- 特殊状态 -->
        <div>
          <div :class="labelMb3ClassName">
            特殊状态
          </div>
          <div :class="buttonGroupClassName">
            <a-button
              loading
              type="primary"
            >
              加载中...
            </a-button>
            <a-button
              disabled
              type="primary"
            >
              禁用状态
            </a-button>
            <a-button disabled>
              禁用默认
            </a-button>
            <a-button
              danger
              type="primary"
            >
              危险按钮
            </a-button>
            <a-button
              ghost
              type="primary"
            >
              幽灵按钮
            </a-button>
            <a-button type="link">
              链接按钮
            </a-button>
            <a-button
              block
              type="primary"
            >
              块级按钮
            </a-button>
          </div>
        </div>

        <!-- 图标按钮 -->
        <div>
          <div :class="labelMb3ClassName">
            图标按钮
          </div>
          <div :class="buttonGroupClassName">
            <a-button type="primary">
              <template #icon>
                <icon-ant-design-search-outlined />
              </template>
              搜索
            </a-button>
            <a-button
              type="primary"
              shape="circle"
            >
              <template #icon>
                <icon-ant-design-plus-outlined />
              </template>
            </a-button>
          </div>
        </div>
      </div>
    </a-card>

    <!-- 2. Input 输入框 -->
    <a-card
      title="Input 输入框"
      :variant="borderless"
    >
      <div :class="gridCols2ClassName">
        <!-- 基础输入 -->
        <div>
          <div :class="labelClassName">
            基础输入
          </div>
          <a-input
            v-model:value="inputText"
            placeholder="请输入内容"
          />
        </div>

        <!-- 带前缀 -->
        <div>
          <div :class="labelClassName">
            带前缀
          </div>
          <a-input
            v-model:value="inputText"
            placeholder="请输入金额"
          >
            <template #prefix>
              ￥
            </template>
          </a-input>
        </div>

        <!-- 带后缀 -->
        <div>
          <div :class="labelClassName">
            带后缀
          </div>
          <a-input
            v-model:value="inputText"
            placeholder="请输入网站"
          >
            <template #suffix>
              .com
            </template>
          </a-input>
        </div>

        <!-- 密码框 -->
        <div>
          <div :class="labelClassName">
            密码框
          </div>
          <a-input-password
            v-model:value="passwordValue"
            placeholder="请输入密码"
          />
        </div>

        <!-- 搜索框 -->
        <div>
          <div :class="labelClassName">
            搜索框
          </div>
          <a-input-search
            v-model:value="searchText"
            placeholder="请输入搜索关键词"
            enter-button
          />
        </div>

        <!-- 禁用状态 -->
        <div>
          <div :class="labelClassName">
            禁用状态
          </div>
          <a-input
            disabled
            default-value="这是禁用的输入框"
          />
        </div>

        <!-- 文本域（多行） -->
        <div :class="cn('md:col-span-2')">
          <div :class="labelClassName">
            多行文本（文本域）
          </div>
          <a-textarea
            v-model:value="textareaValue"
            placeholder="请输入详细描述"
            :rows="4"
          />
        </div>

        <!-- 字数统计 -->
        <div :class="cn('md:col-span-2')">
          <div :class="labelClassName">
            字数统计
          </div>
          <a-textarea
            v-model:value="textareaValue"
            placeholder="限制输入100字"
            :maxlength="100"
            show-count
            :rows="3"
          />
        </div>
      </div>
    </a-card>

    <!-- 3. Select 选择器 -->
    <a-card
      title="Select 选择器"
      :variant="borderless"
    >
      <div :class="gridCols2ClassName">
        <!-- 基础选择 -->
        <div>
          <div :class="labelClassName">
            基础选择
          </div>
          <a-select
            v-model:value="selectValue"
            :options="selectOptions"
            placeholder="请选择"
            style="width: 100%"
          />
        </div>

        <!-- 多选 -->
        <div>
          <div :class="labelClassName">
            多选
          </div>
          <a-select
            v-model:value="multiSelectValue"
            mode="multiple"
            :options="selectOptions"
            placeholder="请选择多个"
            style="width: 100%"
          />
        </div>

        <!-- 可搜索 -->
        <div>
          <div :class="labelClassName">
            可搜索
          </div>
          <a-select
            v-model:value="searchSelectValue"
            show-search
            :options="selectOptions"
            placeholder="搜索并选择"
            style="width: 100%"
          />
        </div>

        <!-- 分组选择 -->
        <div>
          <div :class="labelClassName">
            分组选择
          </div>
          <a-select
            v-model:value="selectValue"
            placeholder="请选择分组"
            style="width: 100%"
            :options="[
              {
                label: '水果',
                options: [
                  { value: 'apple', label: '苹果' },
                  { value: 'banana', label: '香蕉' },
                ],
              },
              {
                label: '蔬菜',
                options: [
                  { value: 'carrot', label: '胡萝卜' },
                  { value: 'cabbage', label: '卷心菜' },
                ],
              },
            ]"
          />
        </div>

        <!-- 禁用 -->
        <div>
          <div :class="labelClassName">
            禁用状态
          </div>
          <a-select
            disabled
            default-value="option1"
            :options="selectOptions"
            style="width: 100%"
          />
        </div>

        <!-- 加载中 -->
        <div>
          <div :class="labelClassName">
            加载中
          </div>
          <a-select
            loading
            placeholder="加载中..."
            :options="[]"
            style="width: 100%"
          />
        </div>
      </div>
    </a-card>

    <!-- 4. Radio 单选框 -->
    <a-card
      title="Radio 单选框"
      :variant="borderless"
    >
      <div :class="cn('space-y-6')">
        <!-- 基础单选组 -->
        <div>
          <div :class="labelMb3ClassName">
            基础单选组
          </div>
          <a-radio-group v-model:value="radioValue">
            <a-radio value="apple">
              苹果
            </a-radio>
            <a-radio value="banana">
              香蕉
            </a-radio>
            <a-radio value="orange">
              橙子
            </a-radio>
          </a-radio-group>
        </div>

        <!-- 按钮样式单选 -->
        <div>
          <div :class="labelMb3ClassName">
            按钮样式单选
          </div>
          <a-radio-group
            v-model:value="buttonRadioValue"
            option-type="button"
          >
            <a-radio-button value="beijing">
              北京
            </a-radio-button>
            <a-radio-button value="shanghai">
              上海
            </a-radio-button>
            <a-radio-button value="guangzhou">
              广州
            </a-radio-button>
            <a-radio-button value="shenzhen">
              深圳
            </a-radio-button>
          </a-radio-group>
        </div>

        <!-- 禁用状态 -->
        <div>
          <div :class="labelMb3ClassName">
            禁用状态
          </div>
          <a-radio-group v-model:value="radioValue">
            <a-radio value="apple">
              苹果
            </a-radio>
            <a-radio
              value="banana"
              disabled
            >
              香蕉（禁用）
            </a-radio>
            <a-radio
              value="orange"
              disabled
            >
              橙子（禁用）
            </a-radio>
          </a-radio-group>
        </div>

        <!-- 垂直排列 -->
        <div>
          <div :class="labelMb3ClassName">
            垂直排列
          </div>
          <a-radio-group
            v-model:value="radioValue"
            direction="vertical"
          >
            <a-radio value="apple">
              苹果
            </a-radio>
            <a-radio value="banana">
              香蕉
            </a-radio>
            <a-radio value="orange">
              橙子
            </a-radio>
          </a-radio-group>
        </div>
      </div>
    </a-card>

    <!-- 5. Checkbox 复选框 -->
    <a-card
      title="Checkbox 复选框"
      :variant="borderless"
    >
      <div :class="cn('space-y-6')">
        <!-- 基础复选 + 全选 -->
        <div>
          <div :class="labelMb3ClassName">
            基础复选（含全选）
          </div>
          <div :class="flexColGap2ClassName">
            <a-checkbox
              v-model:checked="checkAll"
              :indeterminate="isIndeterminate"
              @change="handleCheckAllChange($event.target.checked)"
            >
              全选
            </a-checkbox>
            <a-checkbox-group
              v-model:value="checkboxValues"
              @change="handleCheckedChange"
            >
              <a-checkbox value="apple">
                苹果
              </a-checkbox>
              <a-checkbox value="banana">
                香蕉
              </a-checkbox>
              <a-checkbox value="orange">
                橙子
              </a-checkbox>
            </a-checkbox-group>
          </div>
        </div>

        <!-- 按钮样式复选 -->
        <div>
          <div :class="labelMb3ClassName">
            按钮样式复选
          </div>
          <a-checkbox-group
            v-model:value="buttonCheckboxValues"
            option-type="button"
          >
            <a-checkbox-button value="react">
              React
            </a-checkbox-button>
            <a-checkbox-button value="vue">
              Vue
            </a-checkbox-button>
            <a-checkbox-button value="angular">
              Angular
            </a-checkbox-button>
            <a-checkbox-button value="svelte">
              Svelte
            </a-checkbox-button>
          </a-checkbox-group>
        </div>

        <!-- 禁用状态 -->
        <div>
          <div :class="labelMb3ClassName">
            禁用状态
          </div>
          <a-checkbox-group v-model:value="checkboxValues">
            <a-checkbox value="apple">
              苹果
            </a-checkbox>
            <a-checkbox
              value="banana"
              disabled
            >
              香蕉（禁用）
            </a-checkbox>
            <a-checkbox
              value="orange"
              disabled
            >
              橙子（禁用）
            </a-checkbox>
          </a-checkbox-group>
        </div>
      </div>
    </a-card>

    <!-- 6. Switch 开关 -->
    <a-card
      title="Switch 开关"
      :variant="borderless"
    >
      <div :class="cn('space-y-6')">
        <div :class="flexWrapItemsCenterGap8ClassName">
          <!-- 基础开关 -->
          <div>
            <div :class="labelClassName">
              基础开关
            </div>
            <a-switch v-model:checked="switchValue" />
          </div>

          <!-- 带文字 -->
          <div>
            <div :class="labelClassName">
              带文字描述
            </div>
            <a-switch
              v-model:checked="switchWithText"
              checked-children="开"
              un-checked-children="关"
            />
          </div>

          <!-- 自定义内容 -->
          <div>
            <div :class="labelClassName">
              自定义内容
            </div>
            <a-switch
              v-model:checked="switchWithText"
              checked-children="启用"
              un-checked-children="停用"
            />
          </div>

          <!-- 大小 -->
          <div>
            <div :class="labelClassName">
              小尺寸
            </div>
            <a-switch
              v-model:checked="smallSwitchValue"
              size="small"
            />
          </div>

          <!-- 禁用 -->
          <div>
            <div :class="labelClassName">
              禁用状态
            </div>
            <a-switch disabled />
          </div>

          <!-- 加载状态 -->
          <div>
            <div :class="labelClassName">
              加载状态
            </div>
            <a-switch loading />
          </div>
        </div>
      </div>
    </a-card>

    <!-- 7. Slider 滑块 -->
    <a-card
      title="Slider 滑块"
      :variant="borderless"
    >
      <div :class="cn('space-y-6')">
        <!-- 基础滑块 + 带输入框 -->
        <div :class="gridCols2ClassName">
          <div>
            <div :class="labelMb3ClassName">
              基础滑块 ({{ sliderValue }})
            </div>
            <a-slider v-model:value="sliderValue" />
          </div>

          <div>
            <div :class="labelMb3ClassName">
              带输入框 ({{ inputSliderValue }})
            </div>
            <a-slider-input v-model:value="inputSliderValue" />
          </div>
        </div>

        <!-- 范围滑块 + 垂直方向 -->
        <div :class="gridCols2ClassName">
          <div>
            <div :class="labelMb3ClassName">
              范围选择 ({{ rangeSliderValue[0] }} - {{ rangeSliderValue[1] }})
            </div>
            <a-range-slider v-model:value="rangeSliderValue" />
          </div>

          <div>
            <div :class="labelMb3ClassName">
              垂直方向 ({{ verticalSliderValue }})
            </div>
            <div :class="flexItemsCenterGap4ClassName">
              <a-slider
                v-model:value="verticalSliderValue"
                vertical
                :style="{ height: '120px' }"
              />
            </div>
          </div>
        </div>

        <!-- 禁用 + 刻度标记 -->
        <div :class="gridCols2ClassName">
          <div>
            <div :class="labelMb3ClassName">
              禁用状态
            </div>
            <a-slider
              v-model:value="sliderValue"
              disabled
            />
          </div>

          <div>
            <div :class="labelMb3ClassName">
              刻度标记
            </div>
            <a-slider
              v-model:value="sliderValue"
              :marks="{ 0: '0°C', 26: '26°C', 37: '37°C', 100: '100°C' }"
            />
          </div>
        </div>
      </div>
    </a-card>

    <!-- 8. Rate 评分 -->
    <a-card
      title="Rate 评分"
      :variant="borderless"
    >
      <div :class="flexWrapItemsCenterGap12ClassName">
        <!-- 基础评分 -->
        <div>
          <div :class="labelMb3ClassName">
            基础评分 ({{ rateValue }} 分)
          </div>
          <a-rate v-model:value="rateValue" />
        </div>

        <!-- 半星评分 -->
        <div>
          <div :class="labelMb3ClassName">
            半星评分 ({{ allowHalfRateValue }} 分)
          </div>
          <a-rate
            v-model:value="allowHalfRateValue"
            allow-half
          />
        </div>

        <!-- 允许清除 -->
        <div>
          <div :class="labelMb3ClassName">
            允许清除
          </div>
          <a-rate
            v-model:value="rateValue"
            allow-clear
          />
        </div>

        <!-- 只读模式 -->
        <div>
          <div :class="labelMb3ClassName">
            只读模式 ({{ readonlyRateValue }} 分)
          </div>
          <a-rate
            v-model:value="readonlyRateValue"
            disabled
          />
        </div>

        <!-- 文字描述 -->
        <div>
          <div :class="labelMb3ClassName">
            文字描述
          </div>
          <a-rate
            v-model:value="rateValue"
            :tooltips="['极差',
                        '失望',
                        '一般',
                        '满意',
                        '惊喜']"
          />
        </div>
      </div>
    </a-card>

    <!-- 9. DatePicker 日期选择器 -->
    <a-card
      title="DatePicker 日期选择器"
      :variant="borderless"
    >
      <div :class="gridCols3ClassName">
        <!-- 日期选择 -->
        <div>
          <div :class="labelClassName">
            日期选择
          </div>
          <a-date-picker
            v-model:value="dateValue"
            style="width: 100%"
          />
        </div>

        <!-- 日期范围 -->
        <div>
          <div :class="labelClassName">
            日期范围
          </div>
          <a-range-picker
            v-model:value="dateRangeValue"
            style="width: 100%"
          />
        </div>

        <!-- 时间选择 -->
        <div>
          <div :class="labelClassName">
            时间选择
          </div>
          <a-time-picker
            v-model:value="timeValue"
            format="HH:mm:ss"
            style="width: 100%"
          />
        </div>

        <!-- 月份选择 -->
        <div>
          <div :class="labelClassName">
            月份选择
          </div>
          <a-month-picker
            v-model:value="dateValue"
            style="width: 100%"
          />
        </div>

        <!-- 年份选择 -->
        <div>
          <div :class="labelClassName">
            年份选择
          </div>
          <a-year-picker
            v-model:value="dateValue"
            style="width: 100%"
          />
        </div>
      </div>
    </a-card>

    <!-- 10. Typography 排版 -->
    <a-card
      title="Typography 排版"
      :variant="borderless"
    >
      <div :class="cn('space-y-6')">
        <!-- 标题 -->
        <div>
          <div :class="labelMb3ClassName">
            标题
          </div>
          <h1 :class="h1ClassName">
            一级标题 H1
          </h1>
          <h2 :class="h2ClassName">
            二级标题 H2
          </h2>
          <h3 :class="h3ClassName">
            三级标题 H3
          </h3>
          <h4 :class="h4ClassName">
            四级标题 H4
          </h4>
        </div>

        <!-- 段落与链接 -->
        <div>
          <div :class="labelMb3ClassName">
            段落与链接
          </div>
          <p :class="paragraphClassName">
            这是一段示例文本，展示了基本的文字排版效果。
            <a
              href="#"
              :class="linkClassName"
            >这是一个链接</a>
            ，点击可以跳转到目标页面。
          </p>
          <p :class="helperTextClassName">
            这是辅助文本，通常用于描述、说明或提供额外信息。
          </p>
        </div>

        <!-- 文本省略 -->
        <div>
          <div :class="labelMb3ClassName">
            文本省略（最多两行）
          </div>
          <div
            :class="ellipsisClassName"
            style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;"
          >
            这是一段很长的文字内容，用于演示文本省略功能。当文本超过指定行数时，会自动隐藏多余部分并显示省略号。这样可以保持页面布局的整洁美观，避免长文本破坏整体视觉效果。
          </div>
        </div>

        <!-- 可复制文本 -->
        <div>
          <div :class="labelMb3ClassName">
            可复制文本
          </div>
          <a-typography-paragraph copyable>
            这段文字可以被复制，点击复制按钮即可复制到剪贴板。
          </a-typography-paragraph>
          <a-typography-paragraph
            copyable
            :copy-texts="['复制成功',
                          '复制失败']"
          >
            支持自定义复制提示信息的可复制文本组件。
          </a-typography-paragraph>
        </div>
      </div>
    </a-card>
  </div>
</template>
