import type { PopupButtonProps } from '../types';

export interface ResolvedPopupButton {
  variant: 'default' | 'destructive' | 'ghost' | 'link' | 'outline' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
  class?: string;
  [key: string]: unknown;
}

const TYPE_TO_VARIANT: Record<string, ResolvedPopupButton['variant']> = {
  danger: 'destructive',
  dashed: 'outline',
  default: 'outline',
  ghost: 'ghost',
  link: 'link',
  primary: 'default',
  text: 'ghost',
};

/**
 * 旧 antdv 按钮语义（type/okType/loading）映射到 shadcn Button props，
 * 其余属性原样透传，保持使用方 `okButtonProps: { disabled: true }` 之类写法不变。
 */
export function resolvePopupButton(
  buttonProps?: PopupButtonProps,
  fallbackType: PopupButtonProps['type'] = 'default',
  extraLoading = false,
): ResolvedPopupButton {
  const {
    type,
    loading,
    variant,
    ...rest
  } = buttonProps ?? {};
  const mapped = TYPE_TO_VARIANT[type ?? fallbackType] ?? 'outline';
  return {
    ...rest,
    variant: (variant as ResolvedPopupButton['variant']) ?? mapped,
    loading: Boolean(loading) || extraLoading,
  };
}
