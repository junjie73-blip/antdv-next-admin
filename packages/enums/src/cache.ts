/**
 * 浏览器缓存 Key。
 *
 * 枚举值就是写入 storage 时用的键名，改动等于给老用户换库——
 * 新增成员前先确认写入方和读取方都用了它。
 */
export enum CacheKey {
  /** 字典数据 */
  DICT_DATA = 'antdv_dict_data',
  /** 访问令牌（store 里存的是密文） */
  ACCESS_TOKEN = 'auth_token',
  /** 刷新令牌 */
  REFRESH_TOKEN = 'refresh_token',
  /** 用户信息 */
  USER_INFO = 'user_info',
}
