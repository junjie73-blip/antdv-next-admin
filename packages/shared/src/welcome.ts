import { h } from 'vue';

import { Icon } from '@iconify/vue';
import { notification } from 'antdv-next';

import dayjs from './dayjs';

interface WelcomeConfig {
  icon: string;
  title: string;
  message: string;
  iconColor: string;
}

const MORNING_START = 6;
const NOON_START = 12;
const AFTERNOON_START = 14;
const EVENING_START = 18;
const NIGHT_START = 22;

type TimePeriod = 'afternoon' | 'evening' | 'morning' | 'night' | 'noon';

function getTimePeriod(): TimePeriod {
  const hour = dayjs().hour();

  if (hour >= MORNING_START && hour < NOON_START) return 'morning';
  if (hour >= NOON_START && hour < AFTERNOON_START) return 'noon';
  if (hour >= AFTERNOON_START && hour < EVENING_START) return 'afternoon';
  if (hour >= EVENING_START && hour < NIGHT_START) return 'evening';
  return 'night';
}

const WELCOME_MESSAGES: Record<TimePeriod, WelcomeConfig> = {
  morning: {
    icon: 'solar:sun-bold-duotone',
    title: '早上好',
    message: '新的一天，元气满满！',
    iconColor: '#ffd700',
  },
  noon: {
    icon: 'solar:sun-bold-duotone',
    title: '中午好',
    message: '记得吃午饭哦~',
    iconColor: '#ff9500',
  },
  afternoon: {
    icon: 'solar:sun-2-bold-duotone',
    title: '下午好',
    message: '下午茶时间到了',
    iconColor: '#ff6b35',
  },
  evening: {
    icon: 'solar:moon-bold-duotone',
    title: '晚上好',
    message: '忙碌了一天，辛苦了！',
    iconColor: '#6366f1',
  },
  night: {
    icon: 'solar:moon-stars-bold-duotone',
    title: '夜深了',
    message: '注意休息，早点休息~',
    iconColor: '#8b5cf6',
  },
};

export function getPersonalizedWelcome(username: string): WelcomeConfig {
  const period = getTimePeriod();
  const config = WELCOME_MESSAGES[period];

  return {
    ...config,
    message: `${username}，${config.message}`,
  };
}

export function getTimeGreeting(): string {
  const period = getTimePeriod();
  return WELCOME_MESSAGES[period].title;
}

/* ============================================================
 * 登录欢迎通知
 * ============================================================ */

export interface LoginWelcomeOptions {
  /** 用户名，为空时降级为"朋友" */
  username?: string;
  /** 自动关闭时长（秒），默认 5；传 0 表示不自动关闭 */
  duration?: number;
  /** 通知位置，默认右上角 */
  placement?: 'bottomLeft' | 'bottomRight' | 'topLeft' | 'topRight';
  /** 点击通知时的回调（例如跳转个人中心） */
  onClick?: () => void;
}

/**
 * 登录成功后展示欢迎通知
 *
 * 基于 antdv-next 的 `notification.open`，样式使用 Tailwind。
 *
 * 特性：
 *  - 自动关闭（默认 5s），右上角有关闭按钮可手动关闭
 *  - 根据当前时间展示不同问候语与图标
 *  - 响应式宽度，移动端自动收缩
 *  - 使用 key 去重：重复登录只更新同一条通知
 *
 * @example
 * ```ts
 * import { showLoginWelcome } from './welcome'
 * // 登录成功后调用
 * showLoginWelcome({ username: userStore.nickname ?? userStore.username })
 * ```
 */
export function showLoginWelcome(options: LoginWelcomeOptions = {}): void {
  const {
    username,
    duration = 5,
    placement = 'bottomRight',
    onClick,
  } = options;

  const period = getTimePeriod();
  const config = WELCOME_MESSAGES[period];
  const displayName = username?.trim() || '朋友';
  const timeText = dayjs().format('YYYY-MM-DD HH:mm');

  notification.open({
    title: h(
      'div',
      {
        class:
          'flex flex-wrap items-baseline gap-x-1.5 text-[15px] font-semibold leading-snug text-gray-900 dark:text-gray-100',
      },
      [
        h('span', config.title),
        h('span', { class: 'text-ant-primary' }, displayName),
      ],
    ),

    // ⭐ 通知正文：欢迎语 + 时间胶囊
    description: h('div', { class: 'space-y-2 pt-0.5' }, [
      h(
        'p',
        { class: 'text-sm leading-relaxed text-gray-500 dark:text-gray-400' },
        config.message,
      ),
      h(
        'div',
        {
          class:
            'inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500 dark:bg-gray-800 dark:text-gray-400',
        },
        [
          h(Icon, { icon: 'carbon:time', class: 'text-xs' }),
          h('span', timeText),
        ],
      ),
    ]),

    icon: h(
      'div',
      {
        class:
          'flex h-10 w-10 items-center justify-center rounded-xl bg-ant-primary/10 ring-1 ring-ant-primary/20',
      },
      [
        h(Icon, {
          icon: config.icon,
          class: 'text-xl',
          style: { color: config.iconColor },
        }),
      ],
    ),

    // ⭐ 配置项
    key: 'login-welcome', // 去重：同一 key 只保留一条
    duration, // 5s 后自动关闭
    placement, // 右上角
    closable: true, // 显示手动关闭按钮
    class: 'welcome-notification',
    style: {
      // 移动端自动收缩；小屏下不会溢出
      width: 'min(380px, calc(100vw - 32px))',
    },
    onClick,
  });
}
