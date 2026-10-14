export type TransferDirection = 'left' | 'right';

export type TransferKey = number | string;

export interface TransferItem {
  disabled?: boolean;
  key: TransferKey;
  title?: string;
  [k: string]: any;
}

/** mock 接口的键混用数字与字符串，比较时统一成字符串 */
export function transferKey(key: TransferKey) {
  return String(key);
}
