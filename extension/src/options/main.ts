// Options page: per-site on/off toggles persisted via chrome.storage.sync.
import {
  getEnabledSites,
  setSiteEnabled,
  type SiteId,
} from '../lib/storage';

const status = document.getElementById('status')!;
let statusTimer: ReturnType<typeof setTimeout> | undefined;

function flashStatus(text: string): void {
  status.textContent = text;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    status.textContent = '';
  }, 1500);
}

async function init(): Promise<void> {
  const enabled = await getEnabledSites();
  const checkboxes =
    document.querySelectorAll<HTMLInputElement>('input[data-site-id]');

  for (const checkbox of checkboxes) {
    const siteId = checkbox.dataset.siteId as SiteId;
    checkbox.checked = enabled[siteId];
    checkbox.addEventListener('change', () => {
      void setSiteEnabled(siteId, checkbox.checked).then(() => {
        flashStatus('Saved — reload the site tab to apply.');
      });
    });
  }
}

void init();
