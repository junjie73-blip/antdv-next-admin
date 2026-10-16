import type { Component } from 'vue';

import { h } from 'vue';

import FAutoComplete from './fields/FAutoComplete.vue';
import FCascader from './fields/FCascader.vue';
import FCheckbox from './fields/FCheckbox.vue';
import FDatePicker from './fields/FDatePicker.vue';
import FInput from './fields/FInput.vue';
import FInputNumber from './fields/FInputNumber.vue';
import FMarkdown from './fields/FMarkdown.vue';
import FRadioGroup from './fields/FRadioGroup.vue';
import FRate from './fields/FRate.vue';
import FSelect from './fields/FSelect.vue';
import FSlider from './fields/FSlider.vue';
import FSwitch from './fields/FSwitch.vue';
import FTextarea from './fields/FTextarea.vue';
import FTimePicker from './fields/FTimePicker.vue';
import FTransfer from './fields/FTransfer.vue';
import FTreeSelect from './fields/FTreeSelect.vue';

export type ComponentType =
  | 'ASelect'
  | 'ATreeSelect'
  | 'AutoComplete'
  | 'Cascader'
  | 'Checkbox'
  | 'CheckboxGroup'
  | 'DatePicker'
  | 'Divider'
  | 'Input'
  | 'InputGroup'
  | 'InputNumber'
  | 'InputPassword'
  | 'InputSearch'
  | 'InputTextArea'
  | 'MarkdownEditor'
  | 'MonthPicker'
  | 'RadioButtonGroup'
  | 'RadioGroup'
  | 'RangePicker'
  | 'Rate'
  | 'Select'
  | 'Slider'
  | 'Switch'
  | 'TimePicker'
  | 'TimeRangePicker'
  | 'Transfer'
  | 'TreeSelect'
  | 'WeekPicker';

/** 以固定 props 包一层现有控件（等价旧 antd 的变体组件） */
function withProps(
  base: Component,
  extraProps: Record<string, any>,
  name: string,
): Component {
  return {
    name,
    inheritAttrs: false,
    setup(_props, { attrs, slots }) {
      return () => h(base as any, { ...extraProps, ...attrs }, slots);
    },
  };
}

export const componentMap: { [K in ComponentType]: Component } = {
  Input: FInput,
  InputGroup: FInput,
  InputPassword: withProps(FInput, { type: 'password' }, 'FInputPassword'),
  InputSearch: withProps(FInput, { searchButton: true }, 'FInputSearch'),
  InputTextArea: FTextarea,
  InputNumber: FInputNumber,
  Select: FSelect,
  TreeSelect: FTreeSelect,
  RadioGroup: FRadioGroup,
  RadioButtonGroup: withProps(
    FRadioGroup,
    { optionType: 'button' },
    'FRadioButtonGroup',
  ),
  Checkbox: FCheckbox,
  CheckboxGroup: withProps(FCheckbox, { options: [] }, 'FCheckboxGroup'),
  AutoComplete: FAutoComplete,
  Cascader: FCascader,
  DatePicker: FDatePicker,
  MonthPicker: withProps(FDatePicker, { picker: 'month' }, 'FMonthPicker'),
  RangePicker: withProps(FDatePicker, { range: true }, 'FRangePicker'),
  WeekPicker: withProps(FDatePicker, { picker: 'week' }, 'FWeekPicker'),
  TimePicker: FTimePicker,
  TimeRangePicker: withProps(FTimePicker, { range: true }, 'FTimeRangePicker'),
  Switch: FSwitch,
  Slider: FSlider,
  Rate: FRate,
  Divider: withProps('hr' as any, { class: 'border-t' }, 'FDivider'),
  Transfer: FTransfer,
  // 内置降级实现：web 侧会用带数据请求能力的包装组件通过 addComponent 覆盖
  ATreeSelect: FTreeSelect,
  ASelect: FSelect,
  MarkdownEditor: FMarkdown,
};

export function addComponent(name: string, component: Component) {
  (componentMap as Record<string, Component>)[name] = component;
}

export function getComponent(name: ComponentType): Component | undefined {
  return componentMap[name];
}
