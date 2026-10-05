// utils/menu.ts
import type { MenuProps } from 'antdv-next'

import { Icon } from '@iconify/vue'
import { Badge } from 'antdv-next'
import { h } from 'vue'

import type { MenuConfig, MenuBadge } from '#/menu'

type AntdMenuItem = NonNullable<MenuProps['items']>[number]

function renderExternalLabel(title: string, href: string) {
  return h(
    'a',
    {
      href,
      target: '_blank',
      rel: 'noopener noreferrer',
      onClick: (e: MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        window.open(href, '_blank', 'noopener,noreferrer')
      },
    },
    title,
  )
}

/** ★ 构造菜单 label：标题 + Badge + 右侧 extra */
function renderLabel(m: MenuConfig) {
  const labelText =
    m.isExternal && m.path ? renderExternalLabel(m.title, m.path) : m.title

  // 没有 badge 也没有 extra → 直接返回纯文本，避免多余 DOM
  if (!m.badge && !m.extra) return labelText

  return h(
    'span',
    {
      class:
        'menu-label-wrapper flex w-full min-w-0 items-center justify-between gap-2',
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        width: '100%',
        minWidth: 0,
      },
    },
    [
      // 左侧：标题 + Badge
      h(
        'span',
        {
          style: {
            display: 'flex min-w-0 flex-1 items-center gap-1.5',
            alignItems: 'center',
            gap: '6px',
            minWidth: 0,
            flex: 1,
            overflow: 'hidden',
          },
        },
        [
          h(
            'span',
            {
              class: 'menu-label-text truncate',
              style: {
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              },
            },
            [labelText],
          ),
          m.badge ? renderBadge(m.badge) : null,
        ],
      ),
      // 右侧：extra
      m.extra
        ? h(
            'span',
            {
              class:
                'menu-extra shrink-0 text-[11px] text-slate-400 dark:text-slate-500',
              style: {
                flexShrink: 0,
                fontSize: '11px',
              },
            },
            m.extra,
          )
        : null,
    ],
  )
}

function renderBadge(badge: MenuBadge) {
  return h(
    Badge,
    {
      count: badge.dot ? undefined : badge.text,
      dot: badge.dot,
      status: badge.status,
      overflowCount: badge.overflowCount ?? 99,
      size: 'small',
      offset: [2, -2],
    },
    // dot 模式
  )
}

export function buildMenuItems(menus: MenuConfig[]): AntdMenuItem[] {
  return menus
    .filter((m) => !m.hidden)
    .map((m) => {
      const key = m.name || m.title
      const item: Record<string, unknown> = {
        key,
        label: renderLabel(m), // ★ 用新函数
        disabled: m.disabled,
      }

      if (m.icon) {
        item.icon = () => h(Icon, { icon: m.icon!, class: 'text-lg' })
      }
      if (m.children?.length) {
        item.children = buildMenuItems(m.children)
      }
      return item as AntdMenuItem
    })
}
