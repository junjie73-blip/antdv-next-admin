import { ALL_DEPTS_FLAT } from '../../../../utils/db/dept';
import { FILE_DB } from '../../../../utils/db/file';
import { OPER_LOG_DB } from '../../../../utils/db/log';
import { LOGIN_LOG_DB } from '../../../../utils/db/login-log';
import { FIELD_LABELS, RECORD_MODULES } from '../../../../utils/db/monitor';
import { NOTICE_DB } from '../../../../utils/db/notice';
import { ONLINE_DB } from '../../../../utils/db/online';
import { POST_DB } from '../../../../utils/db/post';
import { ROLE_DB } from '../../../../utils/db/role';
import { SETTINGS_DB } from '../../../../utils/db/settings';
import { USER_DB } from '../../../../utils/db/user';
import { bizError, success } from '../../../../utils/response';
import { defineMockRoute } from '../../../../utils/runtime';

function asRows(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
}

/**
 * 通用记录详情。
 *
 * 系统管理各列表页的「详情」都跳到同一页，用 `module + id` 取数；分组定义来自
 * `RECORD_MODULES`，另外补一份「完整记录」分组把真实字段全列出来 —— 这样即使
 * 某个业务表新增了字段，详情页也不会静默丢数据。
 */
export default defineMockRoute({
  handler({ params }) {
    const moduleKey = String(params.module ?? '');
    const id = String(params.id ?? '');
    const meta = RECORD_MODULES[moduleKey];
    if (!meta) return bizError(404, `未知的详情模块：${moduleKey}`);

    const sources: Record<string, Array<Record<string, unknown>>> = {
      dept: asRows(ALL_DEPTS_FLAT),
      file: asRows(FILE_DB),
      log: asRows(OPER_LOG_DB),
      loginLog: asRows(LOGIN_LOG_DB),
      notice: asRows(NOTICE_DB),
      online: asRows(ONLINE_DB),
      post: asRows(POST_DB),
      role: asRows(ROLE_DB),
      settings: asRows(SETTINGS_DB),
      user: asRows(USER_DB),
    };
    const rows = sources[moduleKey] ?? [];
    const record =
      rows.find(
        (row) => String(row.id ?? row.tokenId ?? row.key ?? '') === id,
      ) ?? null;

    if (!record) {
      return success(
        {
          icon: meta.icon,
          id,
          module: moduleKey,
          record: null,
          sections: [],
          title: meta.title,
        },
        '记录不存在或已被删除',
      );
    }

    const sections = [
      ...meta.sections,
      {
        title: '完整记录',
        fields: Object.keys(record)
          .filter((key) => key !== 'avatar')
          .map((key) => ({ key, label: FIELD_LABELS[key] ?? key })),
      },
    ];

    return success(
      {
        icon: meta.icon,
        id,
        module: moduleKey,
        record,
        sections,
        title: meta.title,
      },
      '获取记录详情成功',
    );
  },
  method: 'GET',
  path: '/system/record/:module/:id',
});
