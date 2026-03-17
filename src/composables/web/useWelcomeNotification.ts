import { Icon } from '@iconify/vue'
import { notification } from 'antdv-next'
import { h } from 'vue'
import { getPersonalizedWelcome } from '@/utils/welcome'

export function showWelcomeNotification(
  username: string,
  options: {
    duration?: number
    closable?: boolean
    className?: string
    onClick?: () => void
    onClose?: () => void
  } = {},
) {
  const { icon, title, message, iconColor } = getPersonalizedWelcome(username)

  notification.open({
    description: h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
      h(Icon, {
        icon,
        style: {
          fontSize: '24px',
          color: iconColor,
        },
      }),
      h('span', { style: { fontWeight: 500 } }, title),
    ]),
    title: message,
    placement: 'bottomRight',
    duration: options.duration ?? 4.5,
    closable: options.closable ?? true,
    class: options.className,
    style: {
      borderRadius: '8px',
    },
    onClick: options.onClick,
    onClose: options.onClose,
  })
}

export function closeWelcomeNotifications() {
  notification.destroy()
}

export function useWelcomeNotification() {
  return {
    showWelcomeNotification,
    closeWelcomeNotifications,
  }
}
