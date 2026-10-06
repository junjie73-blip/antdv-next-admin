import dayjs from 'dayjs'
import { success } from '../../../utils/response'
import { defineMockRoute } from '../../../utils/runtime'
import { nextSettingId, SETTINGS_DB } from '../../../utils/db/settings'
import type { SettingItem, SettingType } from '../../../utils/db/settings'

export default defineMockRoute({
  handler({ data }) {
    const newSetting: SettingItem = {
      id: nextSettingId(),
      key: String(data.key || ''),
      name: String(data.name || ''),
      value: data.value as boolean | number | string,
      type: (data.type as SettingType) || 'text',
      group: String(data.group || '通用设置'),
      description: String(data.description || ''),
      enabled: data.enabled !== undefined ? Boolean(data.enabled) : true,
      createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    }

    SETTINGS_DB.push(newSetting)

    return success(newSetting, '新增配置成功')
  },
  method: 'POST',
  path: '/system/settings',
})
