import { configureSharedEnv } from '@antdv/shared/env';
configureSharedEnv({
  cacheEncryptKey: import.meta.env.VITE_CACHE_ENCRYPT_KEY,
  cachePrefix: import.meta.env.VITE_APP_TITLE ?? 'app_cache',
  minioPublicUrl: import.meta.env.VITE_MINIO_PUBLIC_URL,
  production: import.meta.env.PROD,
});
