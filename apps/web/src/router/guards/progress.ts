import type { Router } from 'vue-router';

import NProgress from 'nprogress';

NProgress.configure({ showSpinner: false, trickleSpeed: 200, minimum: 0.1 });

export function setupProgressGuard(router: Router) {
  router.beforeEach(() => {
    NProgress.start();
  });
  router.afterEach(() => {
    NProgress.done();
  });
  router.onError((error) => {
    console.log(error);
    NProgress.done();
  });
}
