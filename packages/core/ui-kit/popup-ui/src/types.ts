import type { CSSProperties } from 'vue';

/**
 * shadcn Button 的可透传属性子集 + antdv 习惯字段。
 * 旧实现把 antdv-next 的 ButtonProps 直接对外暴露，这里保留同名结构，
 * 由 BasicModal/BasicDrawer 内部把 `type/okType` 映射为 shadcn 的 `variant`。
 */
export interface PopupButtonProps {
  class?: string;
  disabled?: boolean;
  /** antdv 语义：primary/danger/... 映射到 shadcn variant */
  type?: 'danger' | 'dashed' | 'default' | 'ghost' | 'primary';
  loading?: boolean;
  [key: string]: unknown;
}

export interface ModalProps {
  /** 是否显示（v-model:open） */
  open?: boolean;
  /** 标题 */
  title?: string;
  /** 标题右侧提示文本 */
  helpMessage?: string | string[];

  /** 宽度 */
  width?: number | string;
  /** 固定高度 */
  height?: number;
  /** 最小高度 */
  minHeight?: number;

  /** 自适应高度（默认 true） */
  useWrapper?: boolean;
  /** 居中显示（默认 true） */
  centered?: boolean;

  /** 底部偏移量（默认 0） */
  wrapperFooterOffset?: number;

  /** 弹窗 loading */
  loading?: boolean;
  /** loading 文本 */
  loadingTip?: string;

  /** 显示取消按钮（默认 true） */
  showCancelBtn?: boolean;
  /** 显示确认按钮（默认 true） */
  showOkBtn?: boolean;
  /** 显示底部操作栏（默认 true，设为 false 可隐藏整个底部按钮区域） */
  showFooter?: boolean;
  /** 取消按钮文本（默认 '关闭'） */
  cancelText?: string;
  /** 确认按钮文本（默认 '保存'） */
  okText?: string;
  /** 确认按钮 props */
  okButtonProps?: PopupButtonProps;
  /** 取消按钮 props */
  cancelButtonProps?: PopupButtonProps;
  /** 确认按钮类型 */
  okType?: 'danger' | 'dashed' | 'default' | 'ghost' | 'primary';

  /** 显示关闭图标（默认 true） */
  closable?: boolean;
  /** 点击蒙层关闭（默认 true） */
  maskClosable?: boolean;
  /** ESC 关闭（默认 true） */
  keyboard?: boolean;
  /** 关闭时销毁内容（默认 true） */
  destroyOnHidden?: boolean;
  /** 关闭前回调，返回 true 才关闭 */
  closeFunc?: () => Promise<boolean>;

  /**
   * 层级。留空即用 shadcn 浮层刻度的 z-50：抽屉/弹窗/Popover/Select 同层，
   * 谁后挂载谁在上（浮层都 portal 到 body 末尾，所以抽屉里的 Select 不会被抽屉压住）。
   * 只有要把两个浮层钉死先后关系时才显式给值。
   */
  zIndex?: number;
  /** 是否显示蒙层 */
  mask?: boolean;
  /** 蒙层样式 */
  maskStyle?: CSSProperties;
  /** 内容区域样式 */
  bodyStyle?: CSSProperties;
  /** 对话框样式 */
  dialogStyle?: CSSProperties;
  /** 包裹层类名 */
  wrapClassName?: string;
  /** 关闭后回调 */
  afterClose?: () => void;

  /** 确认事件 */
  onOk?: (e: MouseEvent) => Promise<void> | void;
  /** 取消事件 */
  onCancel?: (e: MouseEvent) => void;
  /** 显示状态变化事件 */
  'onVisible-change'?: (visible: boolean) => void;
  /** v-model 更新事件 */
  'onUpdate:open'?: (visible: boolean) => void;
}

export interface ModalMethods {
  /** 打开弹窗（可传数据） */
  openModal: <T = any>(visible?: boolean, data?: T) => Promise<void> | void;
  /** 关闭弹窗 */
  closeModal: () => Promise<void>;
  /** 动态修改 props */
  setModalProps: (props: Partial<ModalProps>) => void;
  /** 获取显示状态 */
  getVisible: () => boolean;
}

export interface ModalInnerMethods {
  closeModal: () => Promise<void> | void;
  setModalProps: (props: Partial<ModalProps>) => void;
  /** 修改确认按钮 loading */
  changeOkLoading: (loading: boolean) => void;
  /** 修改弹窗 loading */
  changeLoading: (loading: boolean) => void;
  openModal?: ModalMethods['openModal'];
  getVisible?: () => boolean;
}

export type Nullable<T> = null | T;
export type CallbackFn<T = any> = (data?: T) => void;

export type UseModalReturnType = [
  (instance: ModalMethods) => void,
  ModalMethods,
];

export type UseModalInnerReturnType = [
  (instance: ModalInnerMethods & Partial<ModalMethods>) => void,
  ModalInnerMethods,
];

export interface ModalWrapperProps {
  footerOffset?: number;
  height?: number;
  loading?: boolean;
  loadingTip?: string;
  minHeight?: number;
  useWrapper?: boolean;
  visible?: boolean;
}
