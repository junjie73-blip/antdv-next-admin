import type { Component } from 'vue'
import {
  AutoComplete,
  Cascader,
  Checkbox,
  CheckboxGroup,
  DatePicker,
  Divider,
  Input,
  InputGroup,
  InputNumber,
  InputPassword,
  InputSearch,
  RadioGroup,
  Rate,
  Select,
  Slider,
  Switch,
  TextArea,
  TimePicker,
  Transfer,
  TreeSelect,
} from 'antdv-next'

export type ComponentType
  = | 'Input'
    | 'InputGroup'
    | 'InputPassword'
    | 'InputSearch'
    | 'InputTextArea'
    | 'InputNumber'
    | 'Select'
    | 'TreeSelect'
    | 'RadioGroup'
    | 'RadioButtonGroup'
    | 'Checkbox'
    | 'CheckboxGroup'
    | 'AutoComplete'
    | 'Cascader'
    | 'DatePicker'
    | 'MonthPicker'
    | 'RangePicker'
    | 'WeekPicker'
    | 'TimePicker'
    | 'TimeRangePicker'
    | 'Switch'
    | 'Slider'
    | 'Rate'
    | 'Divider'
    | 'Transfer'

interface AntdvComponents {
  Input: typeof import('antdv-next')['Input']
  InputGroup: typeof import('antdv-next')['InputGroup']
  InputPassword: typeof import('antdv-next')['InputPassword']
  InputSearch: typeof import('antdv-next')['InputSearch']
  InputTextArea: typeof import('antdv-next')['TextArea']
  InputNumber: typeof import('antdv-next')['InputNumber']
  Select: typeof import('antdv-next')['Select']
  TreeSelect: typeof import('antdv-next')['TreeSelect']
  RadioGroup: typeof import('antdv-next')['RadioGroup']
  RadioButtonGroup: typeof import('antdv-next')['RadioGroup']
  Checkbox: typeof import('antdv-next')['Checkbox']
  CheckboxGroup: typeof import('antdv-next')['CheckboxGroup']
  AutoComplete: typeof import('antdv-next')['AutoComplete']
  Cascader: typeof import('antdv-next')['Cascader']
  DatePicker: typeof import('antdv-next')['DatePicker']
  MonthPicker: typeof import('antdv-next')['DatePicker']
  RangePicker: typeof import('antdv-next')['DatePicker']['RangePicker']
  WeekPicker: typeof import('antdv-next')['DatePicker']
  TimePicker: typeof import('antdv-next')['TimePicker']
  TimeRangePicker: typeof import('antdv-next')['TimePicker']
  Switch: typeof import('antdv-next')['Switch']
  Slider: typeof import('antdv-next')['Slider']
  Rate: typeof import('antdv-next')['Rate']
  Divider: typeof import('antdv-next')['Divider']
  Transfer: typeof import('antdv-next')['Transfer']
}

export const componentMap: { [K in ComponentType]: Component } = {
  Input,
  InputGroup,
  InputPassword,
  InputSearch,
  InputTextArea: TextArea,
  InputNumber,
  Select,
  TreeSelect,
  RadioGroup,
  RadioButtonGroup: RadioGroup,
  Checkbox,
  CheckboxGroup,
  AutoComplete,
  Cascader,
  DatePicker,
  MonthPicker: DatePicker,
  RangePicker: DatePicker.RangePicker,
  WeekPicker: DatePicker,
  TimePicker,
  TimeRangePicker: TimePicker,
  Switch,
  Slider,
  Rate,
  Divider,
  Transfer,
}

export function addComponent(name: string, component: Component) {
  ;(componentMap as Record<string, Component>)[name] = component
}

export function getComponent(name: ComponentType): Component | undefined {
  return componentMap[name]
}

export type { AntdvComponents }
