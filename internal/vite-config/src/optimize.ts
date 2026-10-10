export function createChunkGroups() {
  return {
    groups: [
      {
        // 函数式 name 拿不到静态名字，打包耗时报告里会显示成匿名；补一个 debugName
        debugName: 'antdv-vendor',
        name(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('antdv-next')) return 'vendor-ui';
            if (
              id.includes('vue') ||
              id.includes('pinia') ||
              id.includes('vue-router')
            )
              return 'vendor-vue';
            if (id.includes('echarts')) return 'vendor-echarts';
            if (
              id.includes('@vueuse') ||
              id.includes('es-toolkit') ||
              id.includes('dayjs') ||
              id.includes('xlsx')
            )
              return 'vendor-utils';
            if (id.includes('@vue-office')) return 'vendor-office';
            if (id.includes('pdfjs-dist')) return 'vendor-pdfjs';
            if (id.includes('@intlify') || id.includes('vue-i18n'))
              return 'vendor-i18n';
            if (id.includes('highlight.js')) return 'vendor-highlight';
            if (
              id.includes('@form-create') ||
              id.includes('prosemirror') ||
              id.includes('marked')
            )
              return 'vendor-editor';
            return 'vendor';
          }
        },
      },
    ],
  };
}
