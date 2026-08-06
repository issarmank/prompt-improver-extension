import { defineConfig, loadEnv } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import buildManifest from './src/manifest.config.ts';

export const DEV_BACKEND_URL = 'http://localhost:8787';

export default defineConfig(({ mode }) => {
  // Same .env resolution vite applies to import.meta.env, so the URL baked into
  // backend-client.ts and the one in host_permissions can never drift apart.
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const backendUrl = env.VITE_BACKEND_URL || DEV_BACKEND_URL;

  return { plugins: [crx({ manifest: buildManifest(backendUrl) })] };
});
