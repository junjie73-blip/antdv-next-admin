/**
 * 认证页（登录 / 注册 / 找回）通用组件的公共类型。
 *
 * 这一层刻意不认识 store、路由与 i18n：文案与色板一律由宿主算好后传进来。
 * 于是同一套版式既能配 vue-i18n，也能配任何文案源，包本身保持零副作用。
 */

/** 工具条里的一个主题色预设 */
export interface AuthColorPreset {
  /** 色块颜色（亮色档），宿主拿它反查 `data-theme` 档位或直接内联 */
  color: string;
  /** 预设档位名，与 `@antdv/shared/constants` 的 `THEME_PRESETS.key` 同源 */
  key: string;
}

/** 第三方登录入口 */
export interface AuthSocialItem {
  /** iconify 图标名 */
  icon: string;
  /** 无障碍名称（title / aria-label），由宿主翻译后传入 */
  label: string;
  /** `select` 事件回传的标识，宿主据此决定跳哪条授权 */
  value: string;
}

/** 品牌栏底部的一条产品特性（渲染成主色淡染的胶囊） */
export interface AuthFeatureItem {
  /** iconify 图标名 */
  icon: string;
  /** 特性文案，由宿主翻译后传入 */
  label: string;
}

export interface AuthPageLayoutProps {
  /** 产品名，画在左上角 logo 右侧与品牌栏铭牌上 */
  appName?: string;
  /** 官方 logo 图片地址；不传则用 `#logo` 插槽，再没有就退成内置图标 */
  appLogo?: string;
  /** 页脚版权行 */
  copyright?: string;
  /** 品牌栏底部的特性列表，空数组时整块不渲染 */
  features?: AuthFeatureItem[];
  /** 备案号文案 */
  icp?: string;
  /** 备案号链接，给了才把文案渲染成链接 */
  icpLink?: string;
  /** 左栏说明文字 */
  pageDescription?: string;
  /** 左栏大标题 */
  pageTitle?: string;
  /** 左栏（品牌插画那一侧）是否渲染，窄屏无论如何都会隐藏 */
  showSlogan?: boolean;
  /** 右上角工具条容器是否渲染（内部内容走 `#toolbar` 插槽） */
  showToolbar?: boolean;
  /** 品牌栏底部的插画图；不传则退成纯 CSS 的界面示意 */
  sloganImage?: string;
}

export interface AuthFormPanelProps {
  /** 大标题上方的小徽标文案（如当前的登录方式） */
  badge?: string;
  /** 表单上方的说明行 */
  description?: string;
  /** 表单上方的大标题 */
  title?: string;
}

export interface AuthSocialLoginProps {
  /** 分隔线上的文案，如「其他登录方式」 */
  dividerText?: string;
  /** 入口列表，空数组时整块不渲染 */
  items?: AuthSocialItem[];
}

export interface AuthColorPresetsProps {
  /** 当前主色（十六进制或 `rgb()` 串），命中哪颗就高亮哪颗，同时也是触发按钮的色点 */
  current?: string;
  /** 触发按钮的无障碍名称 */
  label?: string;
  /** 可选色板 */
  presets?: AuthColorPreset[];
}
