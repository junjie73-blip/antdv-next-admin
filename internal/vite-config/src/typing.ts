/**
 * vite-config 对外可选参数类型集中在这里：
 * 插件签名散在各文件里，选项字段的注释与默认值口径容易走偏。
 */

export interface PrintPluginOptions {
  /** 启动成功后额外打印的信息，key 加粗、value 高亮 */
  infoMap?: Record<string, string | undefined>;
}
