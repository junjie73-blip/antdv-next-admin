#!/usr/bin/env perl
# Mechanical package-refactor path remap for docs/en (scratch, delete after use).
# Order matters: specific file renames first, generic prefixes last.
my @map = (
  # --- specific file renames / moves (content-bearing) ---
  ['packages/shared/src/utils/menu.ts',            'packages/utils/src/menu.ts'],
  ['packages/composables/src/useRouteLoading.ts',  'packages/core/hooks/src/use-route-loading.ts'],
  ['packages/composables/src/useChunkUpload.ts',   'packages/core/hooks/src/use-chunk-upload.ts'],
  ['packages/composables/src/useFileReader.ts',    'packages/core/hooks/src/use-file-reader.ts'],
  ['packages/core/composables/src/usePrint.ts',    'packages/core/hooks/src/use-print.ts'],
  ['packages/composables/src/index.ts',            'packages/core/hooks/src/index.ts'],
  ['packages/composables/__tests__/echarts.test.ts','packages/core/hooks/__tests__/echarts.test.ts'],
  ['packages/composables/package.json',            'packages/core/hooks/package.json'],
  ['packages/preferences/src/store.ts',            'packages/core/preferences/src/preferences.ts'],
  ['packages/core/preferences/src/store.ts',       'packages/core/preferences/src/preferences.ts'],
  ['packages/preferences/src/defaults.ts',         'packages/core/preferences/src/config.ts'],
  ['packages/core/preferences/src/defaults.ts',    'packages/core/preferences/src/config.ts'],
  ['packages/utils/src/css-vars.ts',               'packages/core/base/shared/src/constants/css-vars.ts'],
  ['packages/types/src/app-router.ts',             'packages/core/base/typings/src/app-router.ts'],
  ['packages/types/src/micro-app.ts',              'packages/core/base/typings/src/micro-app.ts'],
  ['packages/types/src/menu.ts',                   'packages/core/base/typings/src/menu.ts'],
  ['apps/web/src/enums/cache.ts',                  'packages/enums/src/cache.ts'],
  ['apps/web/src/stores/modules/route.ts',         'packages/stores/src/route.ts'],
  ['apps/web/src/stores/modules/user.ts',          'packages/stores/src/user.ts'],
  ['apps/web/src/utils/crud-actions.ts',           'packages/core/hooks/src/use-crud.ts'],
  ['apps/web/src/components/common/Loading/PageLoading.vue','packages/layouts/src/basic/content/page-loading.vue'],
  ['packages/ui-kit/layout-ui/src/components/LayoutBreadcrumb.vue','packages/layouts/src/widgets/breadcrumb.vue'],
  ['packages/design/src/permission.css',           'packages/core/base/design/src/css/permission.css'],
  ['packages/design/src/index.css',                'packages/core/base/design/src/index.css'],
  # --- generic directory prefixes (pure moves, line numbers hold) ---
  ['packages/shared/',      'packages/core/base/shared/'],
  ['packages/types/',       'packages/core/base/typings/'],
  ['packages/icons/',       'packages/core/base/icons/'],
  ['packages/design/',      'packages/core/base/design/'],
  ['packages/ui-kit/',      'packages/core/ui-kit/'],
  ['packages/preferences/','packages/core/preferences/'],
  ['packages/core/composables/', 'packages/core/hooks/'],
  ['packages/composables/', 'packages/core/hooks/'],
);
local $/;
for my $f (@ARGV) {
  open my $in, '<', $f or next;
  my $t = <$in>; close $in;
  my $orig = $t;
  for my $p (@map) { my ($a,$b)=@$p; my $ea=$a; $ea=~s/[.\/]/\\$&/g; $t =~ s/$ea/$b/g; }
  if ($t ne $orig) { open my $out,'>',$f or next; print $out $t; close $out; print "updated $f\n"; }
}
