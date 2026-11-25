/** 安全事件列表：从持久化事件表做真实分页查询 */
import { SECURITY_EVENTS } from '../../../utils/db/security';
import { paginateList } from '../../../utils/pagination';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

export default defineMockRoute({
  handler({ query }) {
    return success(paginateList([...SECURITY_EVENTS], query), 'ok');
  },
  method: 'GET',
  path: '/security/events/list',
});
