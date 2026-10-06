import { generateEvents } from '../../../utils/db/security';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

export default defineMockRoute({
  handler({ query }) {
    const page = Number(query.page || 1);
    const pageSize = Number(query.pageSize || 10);
    const allEvents = generateEvents(56);
    const start = (page - 1) * pageSize;
    return success(
      {
        list: allEvents.slice(start, start + pageSize),
        total: allEvents.length,
      },
      'ok',
    );
  },
  method: 'GET',
  path: '/security/events/list',
});
