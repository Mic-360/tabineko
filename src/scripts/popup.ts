interface PopupSettings {
  enabled: boolean;
}

const DEFAULT_SETTINGS: PopupSettings = {
  enabled: true,
};

async function initPopup(): Promise<void> {
  const toggle = document.getElementById('enabled-toggle') as HTMLInputElement | null;
  const versionBadge = document.getElementById('version-badge');
  if (!toggle) return;

  try {
    const settings = (await chrome.storage.sync.get(DEFAULT_SETTINGS)) as PopupSettings;
    toggle.checked = Boolean(settings.enabled);
  } catch {
    toggle.checked = true;
  }

  if (versionBadge) {
    versionBadge.textContent = `v${chrome.runtime.getManifest().version}`;
  }

  toggle.addEventListener('change', async () => {
    try {
      await chrome.storage.sync.set({ enabled: toggle.checked });
    } catch {
      toggle.checked = !toggle.checked;
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !changes.enabled) return;
    toggle.checked = Boolean(changes.enabled.newValue);
  });
}

void initPopup();
