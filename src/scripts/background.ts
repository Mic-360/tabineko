interface GestureSettings {
  enabled: boolean;
  trailColor: string;
  sensitivity: 'low' | 'medium' | 'high';
  showDirectionLabel: boolean;
  gestureMap: Record<string, string>;
}

type GestureAction =
  | 'NEXT_TAB'
  | 'PREV_TAB'
  | 'SCROLL_TOP'
  | 'SCROLL_BOTTOM'
  | 'GO_BACK'
  | 'GO_FORWARD'
  | 'RELOAD'
  | 'DUPLICATE_TAB'
  | 'CLOSE_TAB'
  | 'RESTORE_CLOSED_TAB'
  | 'NEW_TAB_RIGHT'
  | 'TOGGLE_PIN_TAB'
  | 'HARD_RELOAD';

interface GestureMessage {
  type: 'GESTURE_ACTION';
  action: GestureAction;
  shiftKey: boolean;
}

const DEFAULT_SETTINGS: GestureSettings = {
  enabled: true,
  trailColor: '#86ac7f',
  sensitivity: 'medium',
  showDirectionLabel: true,
  gestureMap: {},
};

let enabledCache = true;
let lastActionAt = 0;
const closedTabUrlStack: string[] = [];
const tabUrlCache = new Map<number, string>();
const MAX_CLOSED_STACK = 10;

async function initSettings(): Promise<void> {
  try {
    const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
    enabledCache = Boolean(stored.enabled);
    await updateBadge();
  } catch {
    enabledCache = true;
  }
}

function debounceAction(): boolean {
  const now = Date.now();
  if (now - lastActionAt < 300) {
    return true;
  }
  lastActionAt = now;
  return false;
}

async function updateBadge(): Promise<void> {
  await chrome.action.setBadgeText({ text: enabledCache ? '●' : '' });
  if (enabledCache) {
    await chrome.action.setBadgeBackgroundColor({ color: '#86ac7f' });
  }
}

async function withActiveTab<T>(callback: (tab: chrome.tabs.Tab) => Promise<T>): Promise<void> {
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab?.id) return;
    await callback(activeTab);
  } catch {
    // ignored on restricted pages
  }
}

async function switchTab(direction: 'next' | 'prev'): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const activeIndex = tabs.findIndex((tab) => tab.active);
    if (activeIndex < 0 || tabs.length <= 1) return;
    const targetIndex = direction === 'next' ? (activeIndex + 1) % tabs.length : (activeIndex - 1 + tabs.length) % tabs.length;
    const targetTab = tabs[targetIndex];
    if (targetTab?.id) {
      await chrome.tabs.update(targetTab.id, { active: true });
    }
  } catch {
    // ignored
  }
}

async function scrollPage(position: 'top' | 'bottom'): Promise<void> {
  await withActiveTab(async (tab) => {
    if (!tab.id) return;
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (mode: 'top' | 'bottom') => {
        const top = mode === 'top' ? 0 : document.documentElement.scrollHeight;
        window.scrollTo({ top, behavior: 'smooth' });
      },
      args: [position],
    });
  });
}

async function goHistory(direction: 'back' | 'forward'): Promise<void> {
  await withActiveTab(async (tab) => {
    if (!tab.id) return;
    if (direction === 'back') {
      await chrome.tabs.goBack(tab.id);
    } else {
      await chrome.tabs.goForward(tab.id);
    }
  });
}

async function reloadTab(hard = false): Promise<void> {
  await withActiveTab(async (tab) => {
    if (!tab.id) return;
    await chrome.tabs.reload(tab.id, { bypassCache: hard });
  });
}

async function duplicateTab(): Promise<void> {
  await withActiveTab(async (tab) => {
    if (!tab.id) return;
    await chrome.tabs.duplicate(tab.id);
  });
}

async function closeTab(): Promise<void> {
  await withActiveTab(async (tab) => {
    if (!tab.id) return;
    await chrome.tabs.remove(tab.id);
  });
}

async function restoreLastClosedTab(): Promise<void> {
  try {
    const sessions = await chrome.sessions.getRecentlyClosed({ maxResults: 1 });
    const session = sessions[0];
    if (session?.tab?.sessionId) {
      await chrome.sessions.restore(session.tab.sessionId);
      return;
    }
    if (session?.window?.sessionId) {
      await chrome.sessions.restore(session.window.sessionId);
      return;
    }
  } catch {
    // fallback below
  }

  const fallbackUrl = closedTabUrlStack.shift();
  if (!fallbackUrl) return;
  try {
    await chrome.tabs.create({ url: fallbackUrl });
  } catch {
    // ignored
  }
}

async function newTabToRight(): Promise<void> {
  await withActiveTab(async (tab) => {
    const index = typeof tab.index === 'number' ? tab.index + 1 : undefined;
    await chrome.tabs.create({ index });
  });
}

async function togglePin(): Promise<void> {
  await withActiveTab(async (tab) => {
    if (!tab.id) return;
    await chrome.tabs.update(tab.id, { pinned: !tab.pinned });
  });
}

async function runGestureAction(action: GestureAction, shiftKey: boolean): Promise<void> {
  switch (action) {
    case 'NEXT_TAB':
      await switchTab('next');
      break;
    case 'PREV_TAB':
      await switchTab('prev');
      break;
    case 'SCROLL_TOP':
      await scrollPage('top');
      break;
    case 'SCROLL_BOTTOM':
      await scrollPage('bottom');
      break;
    case 'GO_BACK':
      await goHistory('back');
      break;
    case 'GO_FORWARD':
      await goHistory('forward');
      break;
    case 'RELOAD':
      await reloadTab(shiftKey);
      break;
    case 'DUPLICATE_TAB':
      await duplicateTab();
      break;
    case 'CLOSE_TAB':
      await closeTab();
      break;
    case 'RESTORE_CLOSED_TAB':
      await restoreLastClosedTab();
      break;
    case 'NEW_TAB_RIGHT':
      await newTabToRight();
      break;
    case 'TOGGLE_PIN_TAB':
      await togglePin();
      break;
    case 'HARD_RELOAD':
      await reloadTab(true);
      break;
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void chrome.storage.sync.set(DEFAULT_SETTINGS);
  void initSettings();
});

chrome.runtime.onStartup.addListener(() => {
  void initSettings();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync' || !changes.enabled) return;
  enabledCache = Boolean(changes.enabled.newValue);
  void updateBadge();
});

chrome.tabs.onUpdated.addListener((tabId, _changeInfo, tab) => {
  if (tab.url && /^https?:/.test(tab.url)) {
    tabUrlCache.set(tabId, tab.url);
  }
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  if (removeInfo.isWindowClosing) return;
  const cachedUrl = tabUrlCache.get(tabId);
  tabUrlCache.delete(tabId);
  if (!cachedUrl) return;
  closedTabUrlStack.unshift(cachedUrl);
  if (closedTabUrlStack.length > MAX_CLOSED_STACK) {
    closedTabUrlStack.pop();
  }
});

chrome.runtime.onMessage.addListener((message: GestureMessage) => {
  if (message.type !== 'GESTURE_ACTION' || !enabledCache || debounceAction()) {
    return false;
  }
  void runGestureAction(message.action, message.shiftKey);
  return false;
});

void initSettings();
