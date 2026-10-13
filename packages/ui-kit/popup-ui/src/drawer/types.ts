import type { CSSProperties } from 'vue';

import type { PopupButtonProps } from '../types';

/** 抽屉宽度（number 按 px 处理） */
export type DrawerSize = number | string;

export interface DrawerProps {
  /** 是否显示（v-model:visible / v-model:open 双通道，与旧实现一致） */
  open?: boolean;
  visible?: boolean;
  title?: string;
  helpMessage?: string | string[];
  /** 弹出方向 */
  placement?: 'bottom' | 'left' | 'right' | 'top';
  /** 宽度（左右）或高度（上下） */
  size?: DrawerSize;
  width?: DrawerSize;
  height?: DrawerSize;

  loading?: boolean;
  loadingTip?: string;

  showCancelBtn?: boolean;
  showOkBtn?: boolean;
  showFooter?: boolean;
  cancelText?: string;
  okText?: string;
  okButtonProps?: PopupButtonProps;
  cancelButtonProps?: PopupButtonProps;
  okType?: 'danger' | 'dashed' | 'default' | 'ghost' | 'primary';

  closable?: boolean;
  maskClosable?: boolean;
  keyboard?: boolean;
  destroyOnHidden?: boolean;
  closeFunc?: () => Promise<boolean>;

  zIndex?: number;
  mask?: boolean;
  maskStyle?: CSSProperties;
  bodyStyle?: CSSProperties;
  headerStyle?: CSSProperties;
  footerStyle?: CSSProperties;
  drawerStyle?: CSSProperties;
  wrapClassName?: string;
  /** 内容区是否包 padding（沿用旧 useWrapper 语义） */
  useWrapper?: boolean;
  afterClose?: () => void;

  onOk?: (e: MouseEvent) => Promise<void> | void;
  onCancel?: (e: MouseEvent) => void;
  onVisibleChange?: (visible: boolean) => void;
  'onUpdate:visible'?: (visible: boolean) => void;
  'onUpdate:open'?: (visible: boolean) => void;
}

export interface DrawerMethods {
  openDrawer: <T = any>(visible?: boolean, data?: T) => Promise<void> | void;
  closeDrawer: () => Promise<void>;
  setDrawerProps: (props: Partial<DrawerProps>) => void;
  getVisible: () => boolean;
}

export interface DrawerInnerMethods {
  closeDrawer: () => Promise<void> | void;
  setDrawerProps: (props: Partial<DrawerProps>) => void;
  changeOkLoading: (loading: boolean) => void;
  changeLoading: (loading: boolean) => void;
  openDrawer?: DrawerMethods['openDrawer'];
  getVisible?: () => boolean;
}

export type UseDrawerReturnType = [
  (instance: DrawerMethods) => void,
  DrawerMethods,
];

export type UseDrawerInnerReturnType = [
  (instance: DrawerInnerMethods & Partial<DrawerMethods>) => void,
  DrawerInnerMethods,
];
