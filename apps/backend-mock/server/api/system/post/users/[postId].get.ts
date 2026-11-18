/**
 * 岗位关联用户：按岗位所属部门从真实用户表查询，不再凭 userCount 现造用户。
 * 404 时仍返回空分页结构，保持前端调用方式兼容。
 */
import { POST_DB } from '../../../../utils/db/post';
import { USER_DB } from '../../../../utils/db/user';
import { paginateList } from '../../../../utils/pagination';
import { envelope, success } from '../../../../utils/response';
import { defineMockRoute } from '../../../../utils/runtime';

export default defineMockRoute({
  handler({ params, query }) {
    const postId = Number(params.postId);
    const post = POST_DB.find((item) => item.id === postId);

    if (!post) {
      return envelope(404, { list: [], total: 0 }, '岗位不存在');
    }

    const users = USER_DB.filter((user) => user.deptName === post.deptName).map(
      (user) => ({
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        deptName: user.deptName,
      }),
    );

    return success(paginateList(users, query), '获取岗位用户列表成功');
  },
  method: 'GET',
  path: '/system/post/users/:postId',
});
