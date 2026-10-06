import { defineConfig } from 'tsdown';

/**
 * tsdown（rolldown 的打包 CLI）产出单文件 ESM + d.ts。
 *
 * `platform: 'node'` + package.json 里声明为 dependencies 的包默认保持 external，
 * 不要把 chalk / execa / dayjs 打进产物：Node 侧包被 vite、tsx、nitro 同时消费，
 * 依赖出现多副本会让终端颜色、进程句柄、时区初始化各自为政。
 */
export default defineConfig({
  clean: true,
  dts: true,
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
});
