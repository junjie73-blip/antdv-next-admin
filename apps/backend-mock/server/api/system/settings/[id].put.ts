import dayjs from 'dayjs'
import { bizError, success } from '../../../utils/response'
import { defineMockRoute } from '../../../utils/runtime'
import { SETTINGS_DB } from '../../../utils/db/settings'
import type { SettingItem, SettingType } from '../../../utils/db/settings'

export default defineMockRoute({
  handler({ data, params }) {
    const id = Number(params.id)
    const idx = SETTINGS_DB.findIndex(s => s.id === id)

    if (idx === -1) {
      return bizError(404, '配置项不存在')
    }

    const updated: SettingItem = {
      ...SETTINGS_DB[idx]!,
      ...(data.key !== undefined && { key: String(data.key) }),
      ...(data.name !== undefined && { name: String(data.name) }),
      ...(data.value !== undefined && { value: data.value as boolean | number | string }),
      ...(data.type !== undefined && { type: data.type as SettingType }),
      ...(data.group !== undefined && { group: String(data.group) }),
      ...(data.description !== undefined && { description: String(data.description) }),
      ...(data.enabled !== undefined && { enabled: Boolean(data.enabled) }),
      updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    }

    SETTINGS_DB[idx] = updated

    return success(updated, '更新配置成功')
  },
  method: 'PUT',
  path: '/system/settings/:id',
})
