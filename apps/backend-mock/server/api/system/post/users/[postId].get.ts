import { faker } from '@faker-js/faker/locale/zh_CN'
import { envelope, success } from '../../../../utils/response'
import { defineMockRoute } from '../../../../utils/runtime'
import { POST_DB } from '../../../../utils/db/post'

export default defineMockRoute({
  handler({ params }) {
    const postId = Number(params.postId)
    const post = POST_DB.find(p => p.id === postId)

    if (!post) {
      // legacy 行为：404 时 data 仍是空分页结构，不是 null
      return envelope(404, { list: [], total: 0 }, '岗位不存在')
    }

    // 模拟返回该岗位关联的用户列表
    const users = Array.from({ length: post.userCount }, (_, i) => ({
      id: postId * 100 + i + 1,
      username: `user_${String(postId * 100 + i + 1).padStart(3, '0')}`,
      nickname: faker.person.fullName(),
      deptName: post.deptName,
    }))

    return success({ list: users, total: users.length }, '获取岗位用户列表成功')
  },
  method: 'GET',
  path: '/system/post/users/:postId',
})
