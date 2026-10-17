import { defineAsyncComponent } from 'vue';

import { configureLayoutHost } from '@antdv/layouts';

import { getNoticeList, markAllNoticeRead, markNoticeRead } from '~/api/system';
import { localeLabels } from '~/composables/web/useLocale';
import { projectConfig } from '~/config/project';
import i18n from '~/locales';
import { useWebSocket } from '~/utils/ws';

/**
 * 把"只有应用才知道的能力"交给 `@antdv/layouts` 的顶栏小部件。
 *
 * 小部件搬进包以后不能再直接 import `~/api` / `~/utils/ws` / `~/views`（包反向依赖应用
 * 就是循环），所以接口、推送通道、账户页面、语言候选与滚动条偏好都从这里注入。
 *
 * 单独一个文件而不是并进 `ui-runtime.ts`：那个函数会被 `test/setup.ts` 调用，
 * 而 setup 比用例里的 `vi.mock` 先执行 —— 被它摸过的模块之后 mock 不掉，
 * `~/api/system`、`~/utils/ws` 恰恰是用例最常替换的两块。
 */
export function configureLayoutsHost(): void {
  const { onNotice } = useWebSocket();

  configureLayoutHost({
    // 账户页面各自成块：抽屉打开才下载，不进首屏
    accountViews: {
      center: defineAsyncComponent(
        () => import('~/views/account/center/index.vue'),
      ),
      settings: defineAsyncComponent(
        () => import('~/views/account/settings/index.vue'),
      ),
    },
    // 候选跟着文案表里已注册的语言走，新增一门语言只改 `lang/`
    locales: i18n.global.availableLocales.map((code) => ({
      code,
      label: localeLabels[code as keyof typeof localeLabels] ?? code,
    })),
    nativeScrollbar: projectConfig.scrollbar?.native ?? false,
    notice: {
      centerPath: '/system/notice',
      fetch: (limit) => getNoticeList({ pageSize: limit }),
      markAllRead: () => markAllNoticeRead(),
      markRead: (id) => markNoticeRead(id),
      // 推送载荷原样交给包里的 `mapNoticeList` 归一（字段别名都在那边处理）
      onPush: (handler) =>
        onNotice((item) => handler(item as unknown as Record<string, unknown>)),
    },
  });
}
