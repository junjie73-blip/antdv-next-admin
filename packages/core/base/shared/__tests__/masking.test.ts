import { describe, expect, it } from 'vitest';

import {
  maskAddress,
  maskBankCard,
  maskEmail,
  maskGeneric,
  maskIdCard,
  MASKING_RULES,
  maskName,
  maskPhone,
} from '../src/masking';

describe('masking 各字段规则', () => {
  it('手机号保留前三后四', () => {
    expect(maskPhone('13800001234')).toBe('138****1234');
  });

  it('邮箱只保留域名，星号不超过 3 个', () => {
    expect(maskEmail('ab@example.com')).toBe('**@example.com');
    expect(maskEmail('abcdef@example.com')).toBe('***@example.com');
  });

  it('身份证与银行卡保留首尾', () => {
    expect(maskIdCard('110101199001011234')).toBe('110101***********1234');
    expect(maskBankCard('6222 0210 0210 1234')).toBe('6222 **** **** 1234');
  });

  it('地址过短时整段遮蔽，避免露出区划以外的信息', () => {
    expect(maskAddress('北京市朝阳区')).toBe('***');
    expect(maskAddress('北京市朝阳区建国路88号')).toBe('北京市朝阳区****');
  });

  it('姓名保留姓氏', () => {
    expect(maskName('李')).toBe('*');
    expect(maskName('李小明')).toBe('李**');
  });

  it('通用脱敏在保留位数大于长度时全部遮蔽', () => {
    expect(maskGeneric('abc', 2, 2)).toBe('***');
    expect(maskGeneric('abcdef')).toBe('ab**ef');
  });

  it('空串原样返回，不能变成星号', () => {
    expect(maskPhone('')).toBe('');
    expect(maskEmail('')).toBe('');
    expect(maskName('')).toBe('');
  });

  it('规则库能按 pattern 命中对应脱敏函数', () => {
    const phone = MASKING_RULES.find((rule) => rule.name === '手机号');
    expect(phone?.pattern.test('13800001234')).toBe(true);
    expect(phone?.maskFn('13800001234')).toBe('138****1234');
  });
});
