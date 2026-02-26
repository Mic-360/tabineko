/**
 * background.ts — TabiNeko background service worker
 *
 * Handles tab-switching messages from the content script.
 * Uses chrome.tabs API to cycle through tabs with wrap-around.
 */

// ─── Type Definitions ───────────────────────────────────────────

/** Messages received from the content script */
interface TabMessage {
  type: 'NEXT_TAB' | 'PREV_TAB';
}

// ─── Tab Navigation ─────────────────────────────────────────────

/**
 * Switch to the next or previous tab in the current window.
 * Wraps around: last tab → first tab, first tab → last tab.
 */
async function switchTab(direction: 'next' | 'prev'): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });

    if (tabs.length <= 1) return;

    // Find the currently active tab
    const activeIndex = tabs.findIndex((tab) => tab.active);
    if (activeIndex === -1) return;

    let targetIndex: number;

    if (direction === 'next') {
      // Wrap from last to first
      targetIndex = (activeIndex + 1) % tabs.length;
    } else {
      // Wrap from first to last
      targetIndex = (activeIndex - 1 + tabs.length) % tabs.length;
    }

    const targetTab = tabs[targetIndex];
    if (targetTab?.id != null) {
      await chrome.tabs.update(targetTab.id, { active: true });
    }
  } catch {
    // Tab may have been closed during the operation
  }
}

// ─── Message Listener ───────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (message: TabMessage, _sender, _sendResponse) => {
    switch (message.type) {
      case 'NEXT_TAB':
        switchTab('next');
        break;

      case 'PREV_TAB':
        switchTab('prev');
        break;
    }

    // Return false (synchronous) — no response needed
    return false;
  }
);
