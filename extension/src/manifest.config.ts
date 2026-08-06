import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'Prompt Polish',
  version: '0.1.0',
  description: 'Improves your prompt before you send it to a web-based LLM chat interface.',
  permissions: ['storage'],
  // Match patterns can't name a port, so the localhost entries cover the dev
  // backend on :8787.
  host_permissions: [
    'http://localhost/*',
    'http://127.0.0.1/*',
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
});
