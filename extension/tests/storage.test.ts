// Tests for the per-site toggle settings backed by chrome.storage.sync.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { syncStore, chromeStub } = vi.hoisted(() => {
  const syncStore = new Map<string, unknown>();
  const chromeStub = {
    storage: {
      sync: {
        get: vi.fn(async (key: string) => {
          return syncStore.has(key) ? { [key]: syncStore.get(key) } : {};
        }),
        set: vi.fn(async (items: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(items)) syncStore.set(k, v);
        }),
      },
    },
  };
  (globalThis as Record<string, unknown>).chrome = chromeStub;
  return { syncStore, chromeStub };
});

import {
  getEnabledSites,
  isSiteEnabled,
  setSiteEnabled,
} from '../src/lib/storage';

beforeEach(() => {
  vi.stubGlobal('chrome', chromeStub);
  syncStore.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('site toggles', () => {
  it('defaults every supported site to enabled', async () => {
    expect(await getEnabledSites()).toEqual({
      chatgpt: true,
      claude: true,
      gemini: true,
    });
    expect(await isSiteEnabled('claude')).toBe(true);
  });

  it('persists a toggle to chrome.storage.sync and reads it back', async () => {
    await setSiteEnabled('gemini', false);

    expect(syncStore.get('enabledSites')).toEqual({
      chatgpt: true,
      claude: true,
      gemini: false,
    });
    expect(await isSiteEnabled('gemini')).toBe(false);
    expect(await isSiteEnabled('chatgpt')).toBe(true);
  });

  it('survives a "reload": a fresh read sees only what storage holds', async () => {
    // Simulate state written by a previous session.
    syncStore.set('enabledSites', { chatgpt: false, claude: true, gemini: true });
    expect(await isSiteEnabled('chatgpt')).toBe(false);

    await setSiteEnabled('chatgpt', true);
    expect(await isSiteEnabled('chatgpt')).toBe(true);
  });

  it('falls back to enabled for missing or corrupt stored values', async () => {
    syncStore.set('enabledSites', { chatgpt: 'nope', gemini: false });
    expect(await getEnabledSites()).toEqual({
      chatgpt: true, // corrupt value ignored
      claude: true, // missing key defaults on
      gemini: false, // valid value respected
    });
  });

  it('treats unknown site ids as disabled', async () => {
    expect(await isSiteEnabled('perplexity')).toBe(false);
  });
});
