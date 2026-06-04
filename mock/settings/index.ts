import type { MockContext } from '../index'
import { defineMock } from '../index'
import { faker } from '@faker-js/faker/locale/zh_CN'
import dayjs from 'dayjs'

faker.seed(200)

type SettingType = 'text' | 'number' | 'boolean' | 'json'

interface SettingItem {
  id: number
  key: string
  name: string
  value: string | number | boolean
  type: SettingType
  group: string
  description: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

const SETTINGS_DB: SettingItem[] = []

function initSettingsDB() {
  if (SETTINGS_DB.length > 0) return

  const baseDate = dayjs('2024-01-01')

  // 通用设置 (6条)
  const generalSettings = [
    { key: 'site_name', name: '站点名称', value: 'Antdv Next Admin', type: 'text' as SettingType, description: '系统前台显示的站点名称' },
    { key: 'site_logo', name: '站点Logo', value: '/logo.png', type: 'text' as SettingType, description: '站点Logo图片地址' },
    { key: 'site_copyright', name: '版权信息', value: '© 2024 Antdv Next Admin. All rights reserved.', type: 'text' as SettingType, description: '页面底部版权信息' },
    { key: 'site_icp', name: 'ICP备案号', value: '京ICP备XXXXXXXX号', type: 'text' as SettingType, description: '网站备案号码' },
    { key: 'page_size', name: '默认分页大小', value: 20, type: 'number' as SettingType, description: '列表页默认每页显示数量' },
    { key: 'timezone', name: '系统时区', value: 'Asia/Shanghai', type: 'text' as SettingType, description: '系统使用的时区设置' },
  ]

  // 功能开关 (3条)
  const featureSettings = [
    { key: 'enable_register', name: '开放注册', value: false, type: 'boolean' as SettingType, description: '是否允许用户自行注册账号' },
    { key: 'enable_captcha', name: '验证码开关', value: true, type: 'boolean' as SettingType, description: '登录和注册时是否启用验证码' },
    { key: 'enable_2fa', name: '双因素认证', value: false, type: 'boolean' as SettingType, description: '是否开启双因素身份验证' },
  ]

  // 安全设置 (2条)
  const securitySettings = [
    { key: 'password_min_length', name: '密码最小长度', value: 8, type: 'number' as SettingType, description: '用户密码最小字符数要求' },
    { key: 'session_timeout', name: '会话超时时间(分钟)', value: 30, type: 'number' as SettingType, description: '用户无操作自动登出时间' },
  ]

  // 上传设置 (1条)
  const uploadSettings = [
    { key: 'upload_max_size', name: '上传文件大小限制(MB)', value: 10, type: 'number' as SettingType, description: '单次上传文件最大容量' },
  ]

  // 通知设置 (1条)
  const noticeSettings = [
    { key: 'notice_email_enabled', name: '邮件通知', value: true, type: 'boolean' as SettingType, description: '是否通过邮件发送系统通知' },
  ]

  // 缓存设置 (1条)
  const cacheSettings = [
    { key: 'cache_ttl', name: '缓存过期时间(秒)', value: 3600, type: 'number' as SettingType, description: '数据缓存默认存活时间' },
  ]

  // 主题设置 (1条)
  const themeSettings = [
    { key: 'default_theme', name: '默认主题', value: '{"primaryColor":"#1677ff","mode":"light"}', type: 'json' as SettingType, description: '系统默认主题配置' },
  ]

  const allSettings = [
    ...generalSettings.map(s => ({ ...s, group: '通用设置' })),
    ...featureSettings.map(s => ({ ...s, group: '功能开关' })),
    ...securitySettings.map(s => ({ ...s, group: '安全设置' })),
    ...uploadSettings.map(s => ({ ...s, group: '上传设置' })),
    ...noticeSettings.map(s => ({ ...s, group: '通知设置' })),
    ...cacheSettings.map(s => ({ ...s, group: '缓存设置' })),
    ...themeSettings.map(s => ({ ...s, group: '主题设置' })),
  ]

  allSettings.forEach((setting, index) => {
    SETTINGS_DB.push({
      id: index + 1,
      ...setting,
      enabled: faker.datatype.boolean(0.9),
      createdAt: baseDate.add(faker.number.int({ min: 0, max: 180 }), 'day').format('YYYY-MM-DD HH:mm:ss'),
      updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    })
  })
}

initSettingsDB()

let autoIncrementId = 16

export default defineMock({
  '[GET]/system/settings/list'({ query }: MockContext) {
    const keyword = query.keyword as string | undefined
    const type = query.type as string | undefined
    const enabled = query.enabled as string | undefined
    const page = Number(query.page) || 1
    const pageSize = Number(query.pageSize) || 10

    let filtered = [...SETTINGS_DB]

    if (keyword) {
      const kw = String(keyword).toLowerCase()
      filtered = filtered.filter(
        s => s.key.toLowerCase().includes(kw) || s.name.toLowerCase().includes(kw),
      )
    }

    if (type && type !== '') {
      filtered = filtered.filter(s => s.type === type)
    }

    if (enabled !== undefined && enabled !== null && enabled !== '') {
      filtered = filtered.filter(s => s.enabled === (enabled === 'true' || enabled === '1'))
    }

    const total = filtered.length
    const start = (page - 1) * pageSize
    const list = filtered.slice(start, start + pageSize)

    return {
      code: 200,
      data: { list, total },
      message: '获取配置列表成功',
    }
  },

  '[POST]/system/settings'({ data }: MockContext) {
    const body = data as Record<string, unknown>

    const newSetting: SettingItem = {
      id: autoIncrementId++,
      key: String(body.key || ''),
      name: String(body.name || ''),
      value: body.value as string | number | boolean,
      type: (body.type as SettingType) || 'text',
      group: String(body.group || '通用设置'),
      description: String(body.description || ''),
      enabled: body.enabled !== undefined ? Boolean(body.enabled) : true,
      createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    }

    SETTINGS_DB.push(newSetting)

    return {
      code: 200,
      data: newSetting,
      message: '新增配置成功',
    }
  },

  '[PUT]/system/settings/:id'({ params, data }: MockContext) {
    const id = Number(params.id)
    const idx = SETTINGS_DB.findIndex(s => s.id === id)

    if (idx === -1) {
      return {
        code: 404,
        data: null,
        message: '配置项不存在',
      }
    }

    const body = data as Record<string, unknown>
    SETTINGS_DB[idx] = {
      ...SETTINGS_DB[idx]!,
      ...(body.key !== undefined && { key: String(body.key) }),
      ...(body.name !== undefined && { name: String(body.name) }),
      ...(body.value !== undefined && { value: body.value as string | number | boolean }),
      ...(body.type !== undefined && { type: body.type as SettingType }),
      ...(body.group !== undefined && { group: String(body.group) }),
      ...(body.description !== undefined && { description: String(body.description) }),
      ...(body.enabled !== undefined && { enabled: Boolean(body.enabled) }),
      updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    }

    return {
      code: 200,
      data: SETTINGS_DB[idx],
      message: '更新配置成功',
    }
  },

  '[DELETE]/system/settings/:id'({ params }: MockContext) {
    const id = Number(params.id)
    const idx = SETTINGS_DB.findIndex(s => s.id === id)

    if (idx === -1) {
      return {
        code: 404,
        data: null,
        message: '配置项不存在',
      }
    }

    SETTINGS_DB.splice(idx, 1)

    return {
      code: 200,
      data: null,
      message: '删除配置成功',
    }
  },
})
