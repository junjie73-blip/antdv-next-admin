import { paginate } from '../../../utils/db/enterprise';
import { CLIENT_LOG_DB, selectLogs } from '../../../utils/db/monitor';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 客户端日志：按内容 / 级别 / 来源模块筛选，只读不提供删除 */
export default defineMockRoute({
  handler({ query }) {
    const filters = {
      keyword: String(query.keyword ?? ''),
      level: String(query.level ?? ''),
      source: String(query.source ?? ''),
    };
    const selected = selectLogs(CLIENT_LOG_DB, filters, (item, active) => {
      const { keyword, level, source } = active;
      if (level && item.level !== level) return false;
      if (source && item.source !== source) return false;
      if (!keyword) return true;
      return String(keyword)
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .every((word) =>
          [item.message, item.source, item.username, item.page]
            .join(' ')
            .toLowerCase()
            .includes(word),
        );
    });
    const result = paginate(selected, query.pageNum, query.pageSize);
    return success(
      {
        list: result.list,
        pageNum: result.pageNum,
        pageSize: result.pageSize,
        stats: {
          debug: CLIENT_LOG_DB.filter((item) => item.level === 'debug').length,
          error: CLIENT_LOG_DB.filter((item) => item.level === 'error').length,
          info: CLIENT_LOG_DB.filter((item) => item.level === 'info').length,
          total: CLIENT_LOG_DB.length,
          warn: CLIENT_LOG_DB.filter((item) => item.level === 'warn').length,
        },
        total: result.total,
      },
      '获取客户端日志成功',
    );
  },
  method: 'GET',
  path: '/system/client-log/list',
});
