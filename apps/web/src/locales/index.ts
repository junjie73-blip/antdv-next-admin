import { createI18n } from 'vue-i18n';

import enUS from './lang/en-US';
import zhCN from './lang/zh-CN';

/**
 * 文案表只在这里注册，locale 的**取值**不归这里管：
 * 唯一真相是偏好里的 `locale`（见 `composables/useLocale` 的 `applyLocale`），
 * 这里再读一份存储就会出现两个各写各的 locale，切换时只有一半界面跟着变。
 */
const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'zh-CN',
  messages: {
    'en-US': enUS,
    'zh-CN': zhCN,
  },
});

export default i18n;
