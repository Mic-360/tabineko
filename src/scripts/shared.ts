export type Direction = 'U' | 'D' | 'L' | 'R';

export type GestureAction =
  | 'TAB_NEXT'
  | 'TAB_PREV'
  | 'TAB_CLOSE'
  | 'TAB_REOPEN'
  | 'TAB_DUPLICATE'
  | 'TAB_NEW'
  | 'PAGE_BACK'
  | 'PAGE_FORWARD'
  | 'PAGE_RELOAD'
  | 'PAGE_TOP'
  | 'PAGE_BOTTOM';

export interface ExtensionSettings {
  enabled: boolean;
  debug: boolean;
  minGestureDistance: number;
  directionThreshold: number;
  moveThrottleMs: number;
  blacklist: string[];
  gestures: Record<string, GestureAction>;
  advanced: {
    rockerGestures: boolean;
    wheelGestures: boolean;
    chainedGestures: boolean;
  };
}

export interface GestureExecuteMessage {
  type: 'GESTURE_EXECUTE';
  pattern: string;
}

export interface SettingsUpdatedMessage {
  type: 'SETTINGS_UPDATED';
  settings: ExtensionSettings;
}

export interface UpdateSettingsMessage {
  type: 'UPDATE_SETTINGS';
  settings: ExtensionSettings;
}

export interface ExportSettingsMessage {
  type: 'EXPORT_SETTINGS';
}

export type RuntimeMessage =
  | GestureExecuteMessage
  | SettingsUpdatedMessage
  | UpdateSettingsMessage
  | ExportSettingsMessage;

export const DEFAULT_SETTINGS: ExtensionSettings = {
  enabled: true,
  debug: false,
  minGestureDistance: 22,
  directionThreshold: 16,
  moveThrottleMs: 16,
  blacklist: ['chrome://', 'chrome-extension://'],
  gestures: {
    R: 'PAGE_FORWARD',
    L: 'PAGE_BACK',
    U: 'PAGE_TOP',
    D: 'PAGE_BOTTOM',
    'R,D': 'TAB_NEXT',
    'L,D': 'TAB_PREV',
    'D,L': 'TAB_CLOSE',
    'U,D': 'TAB_REOPEN',
  },
  advanced: {
    rockerGestures: false,
    wheelGestures: false,
    chainedGestures: false,
  },
};

export const ACTION_LABELS: Record<GestureAction, string> = {
  TAB_NEXT: 'Next tab',
  TAB_PREV: 'Previous tab',
  TAB_CLOSE: 'Close tab',
  TAB_REOPEN: 'Reopen closed tab',
  TAB_DUPLICATE: 'Duplicate tab',
  TAB_NEW: 'Open new tab',
  PAGE_BACK: 'Back',
  PAGE_FORWARD: 'Forward',
  PAGE_RELOAD: 'Reload',
  PAGE_TOP: 'Scroll to top',
  PAGE_BOTTOM: 'Scroll to bottom',
};
