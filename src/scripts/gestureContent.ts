import { GestureCompressor } from './internal/gestureCompression';
import { GestureOverlay } from './overlay';
import { DEFAULT_SETTINGS, type ExtensionSettings, type GestureAction } from './shared';

interface Session {
  active: boolean;
  pointerId: number;
  suppressContextMenu: boolean;
  lastMoveTime: number;
  compressor: GestureCompressor | null;
}

const overlay = new GestureOverlay();
let settings: ExtensionSettings = DEFAULT_SETTINGS;

const session: Session = {
  active: false,
  pointerId: -1,
  suppressContextMenu: false,
  lastMoveTime: 0,
  compressor: null,
};

const log = (...args: unknown[]): void => {
  if (settings.debug) {
    console.debug('[tabineko]', ...args);
  }
};

async function loadSettings(): Promise<void> {
  const result = await chrome.storage.local.get('settings');
  settings = { ...DEFAULT_SETTINGS, ...(result.settings ?? {}) };
}

function isBlockedUrl(url: string): boolean {
  return settings.blacklist.some((entry) => url.startsWith(entry));
}

function runPageAction(action: GestureAction): void {
  switch (action) {
    case 'PAGE_BACK':
      history.back();
      break;
    case 'PAGE_FORWARD':
      history.forward();
      break;
    case 'PAGE_RELOAD':
      location.reload();
      break;
    case 'PAGE_TOP':
      window.scrollTo({ top: 0, behavior: 'smooth' });
      break;
    case 'PAGE_BOTTOM':
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
      break;
    default:
      break;
  }
}

function startGesture(event: PointerEvent): void {
  if (!settings.enabled || isBlockedUrl(location.href) || window !== window.top) return;
  if (event.button !== 2) return;

  session.active = true;
  session.pointerId = event.pointerId;
  session.suppressContextMenu = false;
  session.lastMoveTime = event.timeStamp;
  session.compressor = new GestureCompressor(
    { x: event.clientX, y: event.clientY },
    { directionThreshold: settings.directionThreshold }
  );

  overlay.start(event.clientX, event.clientY);
  log('gesture-start');
}

function moveGesture(event: PointerEvent): void {
  if (!session.active || session.pointerId !== event.pointerId || !session.compressor) return;
  if (!(event.buttons & 2)) {
    endGesture(event);
    return;
  }

  if (event.timeStamp - session.lastMoveTime < settings.moveThrottleMs) {
    return;
  }
  session.lastMoveTime = event.timeStamp;

  session.compressor.addPoint({ x: event.clientX, y: event.clientY });
  overlay.push(event.clientX, event.clientY);
  overlay.setDirections(session.compressor.getDirections());
}

function endGesture(_event: PointerEvent): void {
  if (!session.active || !session.compressor) return;

  session.active = false;
  const pattern = session.compressor.getPattern();
  const distance = session.compressor.getDistance();
  overlay.clear();

  if (!pattern || distance < settings.minGestureDistance) {
    session.suppressContextMenu = false;
    log('gesture-cancel', { distance, pattern });
    return;
  }

  session.suppressContextMenu = true;
  const action = settings.gestures[pattern];
  if (action?.startsWith('PAGE_')) {
    runPageAction(action);
  }

  chrome.runtime.sendMessage({ type: 'GESTURE_EXECUTE', pattern });
  log('gesture-complete', { pattern, distance });
}

function init(): void {
  loadSettings();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings?.newValue) {
      settings = { ...DEFAULT_SETTINGS, ...changes.settings.newValue };
    }
  });

  document.addEventListener('pointerdown', startGesture, { capture: true, passive: true });
  document.addEventListener('pointermove', moveGesture, { capture: true, passive: true });
  document.addEventListener('pointerup', endGesture, { capture: true, passive: true });
  document.addEventListener(
    'contextmenu',
    (event) => {
      if (session.suppressContextMenu) {
        event.preventDefault();
        session.suppressContextMenu = false;
      }
    },
    { capture: true }
  );
}

init();
