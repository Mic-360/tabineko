import {
  ACTION_LABELS,
  DEFAULT_SETTINGS,
  type ExtensionSettings,
  type GestureAction,
  type RuntimeMessage,
} from './shared';

const tabOrderCache = new Map<number, number[]>();
let settings: ExtensionSettings = DEFAULT_SETTINGS;

const debug = (...args: unknown[]): void => {
  if (settings.debug) {
    console.debug('[tabineko:bg]', ...args);
  }
};

async function hydrateSettings(): Promise<void> {
  const result = await chrome.storage.local.get('settings');
  settings = { ...DEFAULT_SETTINGS, ...(result.settings ?? {}) };
}

async function refreshWindowCache(windowId: number): Promise<void> {
  const tabs = await chrome.tabs.query({ windowId });
  tabOrderCache.set(
    windowId,
    tabs.map((tab) => tab.id).filter((id): id is number => Number.isInteger(id))
  );
}

async function getOrderedTabs(windowId: number): Promise<number[]> {
  const cached = tabOrderCache.get(windowId);
  if (cached?.length) return cached;
  await refreshWindowCache(windowId);
  return tabOrderCache.get(windowId) ?? [];
}

async function switchTab(activeTab: chrome.tabs.Tab, direction: 1 | -1): Promise<void> {
  if (activeTab.windowId == null || activeTab.id == null) return;
  const tabs = await getOrderedTabs(activeTab.windowId);
  const currentIndex = tabs.indexOf(activeTab.id);
  if (tabs.length < 2 || currentIndex < 0) return;
  const target = tabs[(currentIndex + direction + tabs.length) % tabs.length];
  await chrome.tabs.update(target, { active: true });
}

async function executeAction(action: GestureAction, senderTab?: chrome.tabs.Tab): Promise<void> {
  if (!senderTab?.id) return;

  switch (action) {
    case 'TAB_NEXT':
      await switchTab(senderTab, 1);
      break;
    case 'TAB_PREV':
      await switchTab(senderTab, -1);
      break;
    case 'TAB_CLOSE':
      await chrome.tabs.remove(senderTab.id);
      break;
    case 'TAB_REOPEN':
      await chrome.sessions.restore();
      break;
    case 'TAB_DUPLICATE':
      await chrome.tabs.duplicate(senderTab.id);
      break;
    case 'TAB_NEW':
      await chrome.tabs.create({ index: senderTab.index + 1 });
      break;
    default:
      break;
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await hydrateSettings();
  const existing = await chrome.storage.local.get('settings');
  if (!existing.settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.settings?.newValue) {
    settings = { ...DEFAULT_SETTINGS, ...changes.settings.newValue };
  }
});

chrome.tabs.onCreated.addListener((tab) => {
  if (tab.windowId != null) refreshWindowCache(tab.windowId);
});
chrome.tabs.onRemoved.addListener((_tabId, removeInfo) => {
  if (removeInfo.windowId != null) refreshWindowCache(removeInfo.windowId);
});
chrome.tabs.onMoved.addListener((_tabId, moveInfo) => refreshWindowCache(moveInfo.windowId));
chrome.tabs.onAttached.addListener((_tabId, attachInfo) => refreshWindowCache(attachInfo.newWindowId));

chrome.runtime.onMessage.addListener((message: RuntimeMessage, sender, sendResponse) => {
  if (message.type === 'GESTURE_EXECUTE') {
    const action = settings.gestures[message.pattern];
    if (action) {
      debug('exec', message.pattern, ACTION_LABELS[action]);
      void executeAction(action, sender.tab);
    }
    return false;
  }

  if (message.type === 'UPDATE_SETTINGS') {
    settings = { ...DEFAULT_SETTINGS, ...message.settings };
    void chrome.storage.local.set({ settings });
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'EXPORT_SETTINGS') {
    sendResponse({ settings });
    return true;
  }

  return false;
});

void hydrateSettings();
