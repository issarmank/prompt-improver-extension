// The packed extension can only reach hosts declared in host_permissions, and
// a wrong pattern fails silently at runtime — so pin the derivation here.
import { describe, expect, it } from 'vitest';
import buildManifest, {
  backendHostPermissions,
} from '../src/manifest.config.ts';

describe('backendHostPermissions', () => {
  it('covers both loopback spellings for the dev backend', () => {
    expect(backendHostPermissions('http://localhost:8787')).toEqual([
      'http://localhost/*',
      'http://127.0.0.1/*',
    ]);
    expect(backendHostPermissions('http://127.0.0.1:8787')).toEqual([
      'http://localhost/*',
      'http://127.0.0.1/*',
    ]);
  });

  it('drops the port from a production origin — match patterns reject it', () => {
    expect(
      backendHostPermissions(
        'https://prompt-polish-server.eastus.azurecontainerapps.io',
      ),
    ).toEqual(['https://prompt-polish-server.eastus.azurecontainerapps.io/*']);
  });

  it('ignores any path on the configured URL', () => {
    expect(backendHostPermissions('https://api.example.com/rewrite')).toEqual([
      'https://api.example.com/*',
    ]);
  });
});

describe('buildManifest', () => {
  it('puts the production backend into host_permissions', () => {
    const manifest = buildManifest('https://api.example.com');
    expect(manifest.host_permissions).toContain('https://api.example.com/*');
    // The loopback dev grants must not survive into a production build.
    expect(manifest.host_permissions).not.toContain('http://localhost/*');
  });

  it('keeps the chat sites the content script is injected into', () => {
    const manifest = buildManifest('http://localhost:8787');
    expect(manifest.content_scripts?.[0]?.matches).toEqual([
      'https://chatgpt.com/*',
      'https://claude.ai/*',
      'https://gemini.google.com/*',
      'https://grok.com/*',
      'https://chat.deepseek.com/*',
    ]);
  });
});
