import dayjs from 'dayjs'
import { success } from '../../../utils/response'
import { defineMockRoute } from '../../../utils/runtime'
import { nextRoleId, ROLE_DB } from '../../../utils/db/role'
import type { RoleItem } from '../../../utils/db/role'

export default defineMockRoute({
  handler({ data }) {
    const newRole: RoleItem = {
      id: nextRoleId(),
      name: String(data.name || ''),
      code: String(data.code || ''),
      description: String(data.description || ''),
      sort: Number(data.sort ?? 0),
      status: Number(data.status ?? 1),
      menuIds: [],
      createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    }

    ROLE_DB.push(newRole)

    return success(newRole, '新增角色成功')
  },
  method: 'POST',
  path: '/system/role',
})
