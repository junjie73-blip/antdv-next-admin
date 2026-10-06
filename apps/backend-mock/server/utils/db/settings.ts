/**
 * 系统设置内存库（legacy mock/settings.fake.ts 的数据层）
 */

import { faker } from '@faker-js/faker/locale/zh_CN';
import dayjs from 'dayjs';

faker.seed(200);

export type SettingType = 'boolean' | 'json' | 'number' | 'text';

export interface SettingItem {
  createdAt: string;
  description: string;
  enabled: boolean;
  group: string;
  id: number;
  key: string;
  name: string;
  type: SettingType;
  updatedAt: string;
  value: boolean | number | string;
}

export const SETTINGS_DB: SettingItem[] = [];
let autoIncrementId = 16;

function initSettingsDB() {
  if (SETTINGS_DB.length > 0) return;
  const baseDate = dayjs('2024-01-01');
  // 通用设置 (6条)
  const generalSettings = [
    {
      key: 'site_name',
      name: '站点名称',
      value: 'Antdv Next Admin',
      type: 'text' as SettingType,
      description: '系统前台显示的站点名称',
    },
    {
      key: 'site_logo',
      name: '站点Logo',
      value: '/logo.png',
      type: 'text' as SettingType,
      description: '站点Logo图片地址',
    },
    {
      key: 'site_copyright',
      name: '版权信息',
      value: '© 2024 Antdv Next Admin. All rights reserved.',
      type: 'text' as SettingType,
      description: '页面底部版权信息',
    },
    {
      key: 'site_icp',
      name: 'ICP备案号',
      value: '京ICP备XXXXXXXX号',
      type: 'text' as SettingType,
      description: '网站备案号码',
    },
    {
      key: 'page_size',
      name: '默认分页大小',
      value: 20,
      type: 'number' as SettingType,
      description: '列表页默认每页显示数量',
    },
    {
      key: 'timezone',
      name: '系统时区',
      value: 'Asia/Shanghai',
      type: 'text' as SettingType,
      description: '系统使用的时区设置',
    },
  ];
  // 功能开关 (3条)
  const featureSettings = [
    {
      key: 'enable_register',
      name: '开放注册',
      value: false,
      type: 'boolean' as SettingType,
      description: '是否允许用户自行注册账号',
    },
    {
      key: 'enable_captcha',
      name: '验证码开关',
      value: true,
      type: 'boolean' as SettingType,
      description: '登录和注册时是否启用验证码',
    },
    {
      key: 'enable_2fa',
      name: '双因素认证',
      value: false,
      type: 'boolean' as SettingType,
      description: '是否开启双因素身份验证',
    },
  ];
  // 安全设置 (2条)
  const securitySettings = [
    {
      key: 'password_min_length',
      name: '密码最小长度',
      value: 8,
      type: 'number' as SettingType,
      description: '用户密码最小字符数要求',
    },
    {
      key: 'session_timeout',
      name: '会话超时时间(分钟)',
      value: 30,
      type: 'number' as SettingType,
      description: '用户无操作自动登出时间',
    },
  ];
  // 上传设置 (1条)
  const uploadSettings = [
    {
      key: 'upload_max_size',
      name: '上传文件大小限制(MB)',
      value: 10,
      type: 'number' as SettingType,
      description: '单次上传文件最大容量',
    },
  ];
  // 通知设置 (1条)
  const noticeSettings = [
    {
      key: 'notice_email_enabled',
      name: '邮件通知',
      value: true,
      type: 'boolean' as SettingType,
      description: '是否通过邮件发送系统通知',
    },
  ];
  // 缓存设置 (1条)
  const cacheSettings = [
    {
      key: 'cache_ttl',
      name: '缓存过期时间(秒)',
      value: 3600,
      type: 'number' as SettingType,
      description: '数据缓存默认存活时间',
    },
  ];
  // 主题设置 (1条)
  const themeSettings = [
    {
      key: 'default_theme',
      name: '默认主题',
      value: '{"primaryColor":"#1677ff","mode":"light"}',
      type: 'json' as SettingType,
      description: '系统默认主题配置',
    },
  ];
  const allSettings = [
    ...generalSettings.map((s) => ({ ...s, group: '通用设置' })),
    ...featureSettings.map((s) => ({ ...s, group: '功能开关' })),
    ...securitySettings.map((s) => ({ ...s, group: '安全设置' })),
    ...uploadSettings.map((s) => ({ ...s, group: '上传设置' })),
    ...noticeSettings.map((s) => ({ ...s, group: '通知设置' })),
    ...cacheSettings.map((s) => ({ ...s, group: '缓存设置' })),
    ...themeSettings.map((s) => ({ ...s, group: '主题设置' })),
  ];
  allSettings.forEach((setting, index) => {
    SETTINGS_DB.push({
      id: index + 1,
      ...setting,
      enabled: faker.datatype.boolean(0.9),
      createdAt: baseDate
        .add(faker.number.int({ min: 0, max: 180 }), 'day')
        .format('YYYY-MM-DD HH:mm:ss'),
      updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    });
  });
}
initSettingsDB();

/** 新增配置自增 id */
export function nextSettingId(): number {
  return autoIncrementId++;
}
