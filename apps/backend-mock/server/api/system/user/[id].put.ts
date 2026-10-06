import dayjs from 'dayjs'
import { bizError, success } from '../../../utils/response'
import { defineMockRoute } from '../../../utils/runtime'
import { DEPT_LIST, ROLE_OPTIONS, USER_DB } from '../../../utils/db/user'

export default defineMockRoute({
  handler({ params, data }) {
    const id = Number(params.id)
    const idx = USER_DB.findIndex(u => u.id === id)

    if (idx === -1) {
      return bizError(404, '用户不存在')
    }

    const dept = DEPT_LIST.find(d => d.id === data.deptId)
    const role = ROLE_OPTIONS.find(r => r.value === data.roleId)

    USER_DB[idx] = {
      ...USER_DB[idx]!,
      ...(data.username !== undefined && { username: String(data.username) }),
      ...(data.nickname !== undefined && { nickname: String(data.nickname) }),
      ...(data.email !== undefined && { email: String(data.email) }),
      ...(data.phone !== undefined && { phone: String(data.phone) }),
      ...(data.deptId !== undefined && { deptId: Number(data.deptId), deptName: dept?.name || '' }),
      ...(data.roleId !== undefined && { roleId: data.roleId, role: role?.label || '' }),
      ...(data.status !== undefined && { status: data.status as 0 | 1 }),
      ...(data.remark !== undefined && { remark: String(data.remark) }),
      updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    }

    return success(USER_DB[idx], '更新用户成功')
  },
  method: 'PUT',
  path: '/system/user/:id',
})
