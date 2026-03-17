import dayjs from 'dayjs'

interface WelcomeConfig {
  icon: string
  title: string
  message: string
  iconColor: string
}

const MORNING_START = 6
const NOON_START = 12
const AFTERNOON_START = 14
const EVENING_START = 18
const NIGHT_START = 22

type TimePeriod = 'morning' | 'noon' | 'afternoon' | 'evening' | 'night'

function getTimePeriod(): TimePeriod {
  const hour = dayjs().hour()

  if (hour >= MORNING_START && hour < NOON_START)
    return 'morning'
  if (hour >= NOON_START && hour < AFTERNOON_START)
    return 'noon'
  if (hour >= AFTERNOON_START && hour < EVENING_START)
    return 'afternoon'
  if (hour >= EVENING_START && hour < NIGHT_START)
    return 'evening'
  return 'night'
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
}

export function getPersonalizedWelcome(username: string): WelcomeConfig {
  const period = getTimePeriod()
  const config = WELCOME_MESSAGES[period]

  return {
    ...config,
    message: `${username}，${config.message}`,
  }
}

export function getTimeGreeting(): string {
  const period = getTimePeriod()
  return WELCOME_MESSAGES[period].title
}
