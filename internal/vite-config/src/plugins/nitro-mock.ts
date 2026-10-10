import type { PluginOption } from 'vite';

import type { NitroMockPluginOptions } from '../typing';

import { createServer } from 'node:net';

import { colors, consola, getPackage } from '@antdv/node-utils';
import {
  build as buildNitro,
  createDevServer,
  createNitro,
  prepare,
} from 'nitropack';

const hmrKeyRe = /^runtimeConfig\.|routeRules\./;

/**
 * 端口占用探测。
 * 不引 get-port：这里只需要"这个固定端口能不能用"，
 * 而不是"帮我找一个可用端口"——mock 端口写死在前端 proxy 里，换端口没有意义。
 */
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

/** 与 utils/proxy.ts 的 MOCK_SERVER_PORT 一致，插件独立可用所以这里也留一份兜底值 */
const FALLBACK_MOCK_PORT = 5320;

export const viteNitroMockPlugin = ({
  mockServerPackage = '@antdv/backend-mock',
  port: requestedPort = FALLBACK_MOCK_PORT,
  verbose = true,
}: NitroMockPluginOptions = {}): PluginOption => {
  /*
   * 端口归一：历史上调用方写的是 `Number(envConfig.VITE_MOCK_PORT)`，
   * 而这个变量在项目里并不存在 → NaN 一路传进 `server.listen()`，
   * dev server 启动直接抛 `ERR_SOCKET_BAD_PORT`，前端整个起不来。
   * 显式传参不会触发形参默认值，所以必须在这里再兜一次。
   */
  const port =
    Number.isFinite(requestedPort) &&
    requestedPort > 0 &&
    requestedPort < 65_536
      ? requestedPort
      : FALLBACK_MOCK_PORT;

  return {
    async configureServer(server) {
      const available = await isPortAvailable(port);
      if (!available) {
        verbose &&
          consola.log(
            `端口 ${port} 已被占用，跳过 Nitro Mock 启动（可能已有实例在运行）`,
          );
        return;
      }

      const pkg = await getPackage(mockServerPackage);
      if (!pkg) {
        consola.log(
          `Package ${mockServerPackage} not found. Skip mock server.`,
        );
        return;
      }

      runNitroServer(pkg.dir, port, verbose);

      const _printUrls = server.printUrls;
      server.printUrls = () => {
        _printUrls();

        consola.log(
          `  ${colors.green('➜')}  ${colors.bold('Nitro Mock Server')}: ${colors.cyan(`http://localhost:${port}/api`)}`,
        );
      };
    },
    enforce: 'pre',
    name: 'vite:mock-server',
  };
};

async function runNitroServer(
  rootDir: string,
  port: number,
  verbose: boolean,
): Promise<void> {
  let nitro: any;
  const reload = async (): Promise<void> => {
    if (nitro) {
      consola.info('Restarting dev server...');
      if ('unwatch' in nitro.options._c12) {
        await nitro.options._c12.unwatch();
      }
      await nitro.close();
    }
    nitro = await createNitro(
      {
        dev: true,
        preset: 'nitro-dev',
        rootDir,
      },
      {
        c12: {
          // c12 的配置热更新：只有 runtimeConfig / routeRules 变化能就地生效，
          // 其他改动（新增接口文件等）必须整站重启。
          async onUpdate({
            getDiff,
            newConfig,
          }: {
            getDiff: () => { key: string }[];
            newConfig: { config: any };
          }) {
            const diff = getDiff();
            if (diff.length === 0) {
              return;
            }
            verbose &&
              consola.info(
                `Nitro config updated:\n${diff
                  .map((entry) => `  ${entry.key}`)
                  .join('\n')}`,
              );
            await (diff.every((e) => hmrKeyRe.test(e.key))
              ? nitro.updateConfig(newConfig.config)
              : reload());
          },
        },
        watch: true,
      },
    );
    nitro.hooks.hookOnce('restart', reload);

    const server = createDevServer(nitro);
    await server.listen(port, { showURL: false });
    await prepare(nitro);
    await buildNitro(nitro);

    if (verbose) {
      console.log('');
      consola.success(colors.bold(colors.green('Nitro Mock Server started.')));
    }
  };
  return await reload();
}
