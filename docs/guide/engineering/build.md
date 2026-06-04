# 构建部署

本项目基于 **Vite 7** 构建，配置了 PWA、代码压缩、图片优化、构建分析等完整的工程化能力。

## Vite 7 构建配置详解

### 核心配置文件

```
vite.config.ts          → 入口，调用 build/config/index.ts
build/config/index.ts   → 主配置（别名、服务器、插件、构建选项）
build/plugin/index.ts   → 插件集合
build/utils/env.ts      → 环境变量加载
build/utils/proxy.ts    → 代理配置
```

### 路径别名

```ts
// vite.config.ts
resolve: {
  alias: {
    '@': join(process.cwd(), './src'),    // 源码目录
    '#': join(process.cwd(), './types'),  // 类型声明目录
  },
}
```

使用示例：
```ts
import { useTable } from '@/components/business/Table/useTable'
import type { AppRouter } from '#/app-router'
```

### 开发服务器配置

```ts
server: {
  port: Number(envConfig.VITE_PORT),  // 从环境变量读取端口
  host: '0.0.0.0',                     // 允许局域网访问
  cors: true,                           // 启用跨域
  proxy: createProxy(...),              // API 代理
}
```

### 构建输出配置

```ts
build: {
  minify: 'terser',           // 使用 Terser 压缩（比 esbuild 更彻底）
  sourcemap: false,           // 生产环境不生成 sourcemap
  rollupOptions: {
    output: {
      assetFileNames: 'assets/[name]-[hash].[ext]',    // 静态资源
      chunkFileNames: 'js/[name]-[hash].js',            // chunk 文件
      entryFileNames: 'js/index-[name]-[hash].js',     // 入口文件
    },
  },
}
```

**输出目录结构：**
```
dist/
├── assets/
│   ├── logo-[hash].svg
│   └── image-[hash].png
├── js/
│   ├── index-vendor-[hash].js     (第三方库 chunk)
│   ├── index-[hash].js            (主入口)
│   └── views-About-[hash].js      (路由级 code-split)
└── index.html
```

## PWA 配置（Workbox）

通过 `vite-plugin-pwa` 集成 PWA 能力，支持离线访问和安装到桌面：

```ts
// build/plugin/index.ts 中配置
import { VitePWA } from 'vite-plugin-pwa'

VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
  manifest: {
    name: 'Antdv Next Admin',
    short_name: 'Admin',
    theme_color: '#1677ff',
    background_color: '#ffffff',
    display: 'standalone',
    icons: [
      { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
    runtimeCaching: [
      {
        urlPattern: /\/api\//,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-cache',
          expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 }, // 1 小时
        },
      },
    ],
  },
})
```

**Workbox 缓存策略：**
| 资源类型 | 策略 | 说明 |
|---------|------|------|
| 静态资源 (JS/CSS/HTML) | CacheFirst | 优先缓存，回退网络 |
| API 接口 | NetworkFirst | 优先网络，离线时用缓存 |
| 图片/字体 | StaleWhileRevalidate | 先返回缓存，后台更新 |

## Gzip/Brotli 压缩

通过 `vite-plugin-compression` 实现构建时预压缩：

```ts
import compression from 'vite-plugin-compression'

compression({
  algorithm: 'gzip',        // 或 'brotli'
  ext: '.gz',
  threshold: 10240,         // 大于 10KB 才压缩
  deleteOriginFile: false,  // 保留原始文件
  compressionOptions: { level: 9 },
})
```

**压缩效果对比：**

| 文件类型 | 原始大小 | Gzip 后 | Brotli 后 |
|---------|----------|---------|-----------|
| main.js | 245 KB | 78 KB (68%↓) | 68 KB (72%↓) |
| vendor.js | 512 KB | 156 KB (70%↓) | 134 KB (74%↓) |
| index.css | 45 KB | 8 KB (82%↓) | 6 KB (87%↓) |

Nginx 配合 `gzip_static on` 可直接返回预压缩文件，无需实时压缩。

## 构建分析可视化

使用 `rollup-plugin-visualizer` 分析打包体积：

```ts
import { visualizer } from 'rollup-plugin-visualizer'

visualizer({
  filename: 'stats.html',       // 输出文件名
  open: true,                    // 自动打开浏览器
  gzipSize: true,                // 显示 gzip 后的大小
  brotliSize: true,             // 显示 brotli 后的大小
})
```

执行构建后自动生成 `stats.html`，支持 treemap、sunburst、network 等多种可视化视图：

```bash
# 执行带分析的构建
pnpm run build
# 打开 stats.html 查看分析结果
```

## 图片压缩

使用 `vite-plugin-imagemin` 在构建时自动压缩图片：

```ts
import imagemin from 'vite-plugin-imagemin'

imagemin({
  gifsicle: { optimizationLevel: 7 },
  optipng: { optimizationLevel: 7 },
  mozjpeg: { quality: 80 },
  svgo: {
    plugins: [
      { name: 'removeViewBox', active: false },
      { name: 'removeEmptyAttrs', active: true },
    ],
  },
  webp: { quality: 75 },
})
```

**支持的格式和默认配置：**

| 格式 | 压缩工具 | 默认配置 |
|------|---------|---------|
| PNG | optipng | 压缩级别 7 |
| JPEG/JPG | mozjpeg | 质量 80% |
| GIF | gifsicle | 压缩级别 7 |
| SVG | svgo | 移除空属性 |
| WebP | webp | 质量 75% |

## 生产环境 console 移除

在 Terser 配置中启用 `drop_console`：

```ts
terserOptions: {
  mangle: true,               // 变量名混淆
  compress: {
    drop_console: true,        // 移除所有 console.*
    drop_debugger: false,      // 保留 debugger（可按需开启）
  },
}
```

> 如果需要保留特定日志（如错误上报），可以使用自定义 logger 替代 `console.log`。

## Docker 部署方案

### Dockerfile

```dockerfile
# 构建阶段
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

# 生产阶段
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Nginx 反向代理配置

```nginx
server {
    listen 80;
    server_name admin.example.com;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip 静态压缩
    gzip_static on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    gzip_min_length 1000;

    # SPA 路由 fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 反向代理
    location /api/ {
        proxy_pass http://backend:8080/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  frontend:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "80:80"
    restart: unless-stopped
    networks:
      - app-network

  backend:
    image: your-backend-image
    ports:
      - "8080:8080"
    networks:
      - app-network

networks:
  app-network:
    driver: bridge
```

### 部署命令

```bash
# 构建并启动
docker-compose up -d --build

# 查看日志
docker-compose logs -f frontend

# 更新部署
docker-compose pull && docker-compose up -d
```

## CI/CD 流程概览

典型的 CI/CD 流水线包含以下步骤：

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  代码提交    │ → │  Lint 检查  │ → │  类型检查    │ → │  单元测试    │ → │  E2E 测试   │
│  git push   │    │  eslint     │    │  vue-tsc    │    │  vitest     │    │  playwright │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                                                              ↓
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  镜像推送    │ ← │  Docker 构建 │ ← │  构建产物    │ ← │  版本发布    │ ← │  测试通过   │
│  registry   │    │  docker build│    │  dist/      │    │  version    │    │             │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### GitHub Actions 示例

```yaml
name: Build & Deploy

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm run lint:fix

      - name: Type check
        run: pnpm run type-check

      - name: Unit test
        run: pnpm run test:unit

      - name: Build
        run: pnpm run build

      - name: Deploy to Server
        if: success()
        uses: appleboy/scp-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_KEY }}
          source: "dist/*"
          target: "/var/www/admin"
```
