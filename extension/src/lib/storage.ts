// Wrappers around chrome.storage.sync for user settings (per-site toggles).

export const SITE_IDS = [
  'chatgpt',
  'claude',
  'gemini',
  'grok',
  'deepseek',
] as const;
export type SiteId = (typeof SITE_IDS)[number];

export type EnabledSites = Record<SiteId, boolean>;

const ENABLED_SITES_KEY = 'enabledSites';

const DEFAULTS: EnabledSites = {
  chatgpt: true,
  claude: true,
  gemini: true,
  grok: true,
  deepseek: true,
};

/** Read the per-site toggles; missing or corrupt entries fall back to enabled. */
export async function getEnabledSites(): Promise<EnabledSites> {
  const stored = await chrome.storage.sync.get(ENABLED_SITES_KEY);
  const raw = stored[ENABLED_SITES_KEY] as
    | Partial<Record<SiteId, unknown>>
    | undefined;
  const result = { ...DEFAULTS };
  if (raw && typeof raw === 'object') {
    for (const id of SITE_IDS) {
      const value = raw[id];
      if (typeof value === 'boolean') result[id] = value;
    }
  }
  return result;
}

export async function setSiteEnabled(
  siteId: SiteId,
  enabled: boolean,
): Promise<void> {
  const sites = await getEnabledSites();
  sites[siteId] = enabled;
  await chrome.storage.sync.set({ [ENABLED_SITES_KEY]: sites });
}

/** Unknown site ids read as disabled so a stale adapter never injects UI. */
export async function isSiteEnabled(siteId: string): Promise<boolean> {
  if (!(SITE_IDS as readonly string[]).includes(siteId)) return false;
  const sites = await getEnabledSites();
  return sites[siteId as SiteId];
}
