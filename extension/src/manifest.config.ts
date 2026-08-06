import type { ManifestV3Export } from '@crxjs/vite-plugin';

// @crxjs exports only the union (object | promise | factory); narrow it to the
// plain object so callers and tests can read fields off the result. Annotating
// the return type checks the literal exactly as defineManifest() did — that
// helper is `(manifest) => manifest`, so nothing is lost by dropping it.
export type Manifest = Extract<ManifestV3Export, { manifest_version: number }>;

/**
 * Match patterns for the backend origin. MV3 only lets the service worker skip
 * CORS for hosts declared here, so a packed build that omits its own backend
 * can't reach it. Match patterns can't name a port, hence the hostname-only
 * pattern — and loopback gets both spellings so either resolves in dev.
 */
export function backendHostPermissions(backendUrl: string): string[] {
  const { protocol, hostname } = new URL(backendUrl);
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return ['http://localhost/*', 'http://127.0.0.1/*'];
  }
  return [`${protocol}//${hostname}/*`];
}

/** `backendUrl` comes from VITE_BACKEND_URL, resolved in vite.config.ts. */
export default function buildManifest(backendUrl: string): Manifest {
  return {
    manifest_version: 3,
    name: 'Prompt Polish',
    version: '0.1.0',
    description:
      'Improves your prompt before you send it to a web-based LLM chat interface.',
    permissions: ['storage'],
    host_permissions: [
      ...backendHostPermissions(backendUrl),
      'https://grok.com/*',
      'https://chat.deepseek.com/*',
    ],
    background: {
      service_worker: 'src/background/service-worker.ts',
      type: 'module',
    },
    content_scripts: [
      {
        matches: [
          'https://chatgpt.com/*',
          'https://claude.ai/*',
          'https://gemini.google.com/*',
          'https://grok.com/*',
          'https://chat.deepseek.com/*',
        ],
        js: ['src/content/index.ts'],
        run_at: 'document_idle',
      },
    ],
    options_ui: {
      page: 'src/options/index.html',
      open_in_tab: true,
    },
  };
}
