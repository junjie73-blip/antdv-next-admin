import { paginate } from '../../../utils/db/enterprise';
import { CAPTCHA_LOG_DB, selectLogs } from '../../../utils/db/monitor';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 验证码日志：按类型 / 场景 / 校验结果 / 接收方筛选 */
export default defineMockRoute({
  handler({ query }) {
    const filters = {
      keyword: String(query.keyword ?? ''),
      result: String(query.result ?? ''),
      scene: String(query.scene ?? ''),
      type: String(query.type ?? ''),
    };
    const selected = selectLogs(CAPTCHA_LOG_DB, filters, (item, active) => {
      const { keyword, result, scene, type } = active;
      if (type && item.type !== type) return false;
      if (result && item.result !== result) return false;
      if (scene && item.scene !== scene) return false;
      if (!keyword) return true;
      return String(keyword)
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .every((word) =>
          [item.receiver, item.ip, item.code, item.location]
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
          failed: CAPTCHA_LOG_DB.filter((item) => item.result === 'failed')
            .length,
          passed: CAPTCHA_LOG_DB.filter((item) => item.result === 'passed')
            .length,
          total: CAPTCHA_LOG_DB.length,
        },
        total: result.total,
      },
      '获取验证码日志成功',
    );
  },
  method: 'GET',
  path: '/system/captcha-log/list',
});
