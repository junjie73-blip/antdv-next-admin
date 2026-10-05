import type { Router } from 'vue-router'

import { useTitle } from '@vueuse/core'

export function setupTitleGuard(router: Router) {
  router.afterEach((to) => {
    const base = import.meta.env.VITE_APP_TITLE || 'Admin'
    const title = to.meta.title as string | undefined
    useTitle(title ? `${title} | ${base}` : base)
    window.scrollTo({ top: 0, behavior: 'instant' })
  })
}
