/**
 * vite-config 对外可选参数类型集中在这里：
 * 插件签名散在各文件里，选项字段的注释与默认值口径容易走偏。
 */

export interface NitroMockPluginOptions {
  /** monorepo 里 mock 服务的包名，其 dir 会作为 Nitro 的 rootDir */
  mockServerPackage?: string;
  /** 固定端口：前端 dev proxy 的 target 写死同一个数字才能对上 */
  port?: number;
  /** 是否输出 Nitro 启动/配置变更日志 */
  verbose?: boolean;
}

export interface PrintPluginOptions {
  /** 启动成功后额外打印的信息，key 加粗、value 高亮 */
  infoMap?: Record<string, string | undefined>;
}
