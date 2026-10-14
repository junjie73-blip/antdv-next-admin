import { describe, expect, it } from 'vitest';

import { CacheKey } from '../src/cache';
import { DictType } from '../src/dict';
import * as barrel from '../src/index';

describe('缓存键枚举 CacheKey', () => {
  it('值与代码里实际写入 storage 的键名一致', () => {
    // 这四个键是登录态与字典的唯一持久化词汇；出现第五种写法就说明有人又开始自造键名了
    expect(CacheKey.ACCESS_TOKEN).toBe('auth_token');
    expect(CacheKey.REFRESH_TOKEN).toBe('refresh_token');
    expect(CacheKey.USER_INFO).toBe('user_info');
    expect(CacheKey.DICT_DATA).toBe('antdv_dict_data');
  });

  it('没有重复值', () => {
    const values = Object.values(CacheKey);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('字典编码枚举 DictType', () => {
  it('都是后端下发的 sys_ 前缀编码', () => {
    for (const code of Object.values(DictType)) {
      expect(code).toMatch(/^sys_[a-z_]+$/);
    }
  });
});

describe('入口 barrel', () => {
  it('两个枚举都从入口导出', () => {
    expect(barrel.CacheKey).toBe(CacheKey);
    expect(barrel.DictType).toBe(DictType);
  });
});
