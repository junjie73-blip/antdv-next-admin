import type { App, Component } from 'vue';

import { defineComponent } from 'vue';

import {
  Badge,
  Button,
  Col,
  ConfigProvider,
  DirectoryTree,
  Divider,
  Dropdown,
  Form,
  FormItem,
  Input,
  InputNumber,
  Layout,
  LayoutContent,
  LayoutHeader,
  LayoutSider,
  Menu,
  MenuDivider,
  MenuItem,
  Modal,
  Popconfirm,
  Popover,
  Radio,
  RadioButton,
  RadioGroup,
  Row,
  Select,
  SelectOptGroup,
  SelectOption,
  Slider,
  Switch,
  Table,
  TabPane,
  Tabs,
  Tag,
  Tooltip,
  Tree,
} from 'antdv-next';

/**
 * 给"预编译第三方模板"补一份全局组件注册。
 *
 * 本项目的 `a-*` 组件靠 `unplugin-vue-components` + `AntdvNextResolver` 在**编译期**
 * 逐个注入（见 internal/vite-config 的 auto-import 插件），好处是业务页只打包真正用到的组件；
 * 代价是它只作用于本仓库源码 —— 像 `@form-create/antd-designer` 这样的依赖，
 * 模板早在发布时就编译好了，运行时才用 `resolveComponent('a-layout-sider')` 找组件，
 * 编译期注入帮不到它。没这份全局注册的话，表单设计器会打出几十条
 * "Failed to resolve component: a-xxx"，左侧物料栏、顶部工具条、右侧属性面板
 * 全部渲染成空白标签 —— 页面看着"没报错"，其实是整块 UI 没了。
 *
 * 所以这里只登记设计器真正会用到的那一部分，而不是 `app.use(antd)` 全量注册：
 * 全量会把 tree-shaking 的成果整体退回去（整个组件库进包），与我们的架构目标冲突。
 * 清单来自对 `@form-create/antd-designer` 产物的静态扫描，新增依赖时按同样口径补。
 */
const VENDOR_COMPONENTS: Record<string, Component> = {
  'a-badge': Badge,
  'a-button': Button,
  'a-col': Col,
  'a-config-provider': ConfigProvider,
  'a-directory-tree': DirectoryTree,
  'a-divider': Divider,
  'a-dropdown': Dropdown,
  'a-form': Form,
  'a-form-item': FormItem,
  'a-input': Input,
  'a-input-number': InputNumber,
  'a-layout': Layout,
  'a-layout-content': LayoutContent,
  'a-layout-header': LayoutHeader,
  'a-layout-sider': LayoutSider,
  'a-menu': Menu,
  'a-menu-divider': MenuDivider,
  'a-menu-item': MenuItem,
  'a-modal': Modal,
  'a-popconfirm': Popconfirm,
  'a-popover': Popover,
  'a-radio': Radio,
  'a-radio-button': RadioButton,
  'a-radio-group': RadioGroup,
  'a-row': Row,
  'a-select': Select,
  'a-select-opt-group': SelectOptGroup,
  'a-select-option': SelectOption,
  'a-slider': Slider,
  'a-switch': Switch,
  'a-tab-pane': TabPane,
  'a-table': Table,
  'a-tabs': Tabs,
  'a-tag': Tag,
  'a-tooltip': Tooltip,
  'a-tree': Tree,
};

/**
 * `a-form-item-rest` 是 React 版 antd 的东西：把不属于 `Form.Item` 的多余属性
 * 从 DOM 上摘掉。Vue 版没有这个约束，antdv-next 也不提供该组件，
 * 但设计器的模板里写死了它。这里用一个"只渲染子内容"的透传占位顶上，
 * 免得整块表单字段区域因为一个包装标签而消失。
 */
const FormItemRest = defineComponent({
  name: 'AFormItemRest',
  setup: (_props, { slots }) => () => slots.default?.(),
});

export function registerVendorAntdComponents(app: App): void {
  // 注册名必须是 kebab-case：第三方预编译模板里写的是 `resolveComponent('a-form-item-rest')`，
  // 换成 PascalCase 就查不到（PascalCase 那条路是编译器在 SFC 编译期走的，运行期帮不上）。
  // eslint-disable-next-line vue/component-definition-name-casing
  app.component('a-form-item-rest', FormItemRest);
  for (const [name, component] of Object.entries(VENDOR_COMPONENTS)) {
    app.component(name, component);
  }
}
