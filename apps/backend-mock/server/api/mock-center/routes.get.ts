import { defineEventHandler, getQuery } from '#imports';

import { toRouteView } from '../../utils/panel';
import { envelope } from '../../utils/response';
import { listManifest } from '../../utils/store';

export default defineEventHandler((event) => {
  const query = getQuery(event);
  const keyword = String(query.keyword ?? '')
    .trim()
    .toLowerCase();
  const module = String(query.module ?? '').trim();
  const source = String(query.source ?? '').trim();

  const items = listManifest();
  let views = items.map(toRouteView);
  if (module) views = views.filter((item) => item.module === module);
  if (source) views = views.filter((item) => item.source === source);
  if (keyword)
    views = views.filter((item) =>
      `${item.key} ${item.title ?? ''} ${item.file ?? ''}`
        .toLowerCase()
        .includes(keyword),
    );

  views.sort(
    (a, b) =>
      a.module.localeCompare(b.module) ||
      a.path.localeCompare(b.path) ||
      a.method.localeCompare(b.method),
  );
  return envelope(
    200,
    {
      list: views,
      modules: [...new Set(items.map((item) => item.module))].sort(),
    },
    '获取 Mock 接口清单成功',
  );
});
