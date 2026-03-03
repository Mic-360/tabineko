interface GestureSettings {
  enabled: boolean;
  trailColor: string;
  sensitivity: 'low' | 'medium' | 'high';
  showDirectionLabel: boolean;
  gestureMap: Record<string, string>;
}

type Direction8 = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

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

const DEFAULT_GESTURE_MAP: Record<string, GestureAction> = {
  'E,S': 'NEXT_TAB',
  'W,N': 'PREV_TAB',
  N: 'SCROLL_TOP',
  S: 'SCROLL_BOTTOM',
  W: 'GO_BACK',
  E: 'GO_FORWARD',
  'N,S': 'RELOAD',
  'S,N': 'DUPLICATE_TAB',
  'E,W': 'CLOSE_TAB',
  'W,E': 'RESTORE_CLOSED_TAB',
  'N,E': 'NEW_TAB_RIGHT',
  'S,W': 'TOGGLE_PIN_TAB',
  'N,S,N': 'HARD_RELOAD',
};

const DEFAULT_SETTINGS: GestureSettings = {
  enabled: true,
  trailColor: '#86ac7f',
  sensitivity: 'medium',
  showDirectionLabel: true,
  gestureMap: DEFAULT_GESTURE_MAP,
};

const SENSITIVITY_DEAD_ZONE: Record<GestureSettings['sensitivity'], number> = {
  low: 20,
  medium: 12,
  high: 6,
};

class RingBuffer {
  private readonly points: Array<{ x: number; y: number; t: number }>;
  private head = 0;
  private length = 0;

  constructor(private readonly capacity = 64) {
    this.points = new Array(capacity);
  }

  clear(): void {
    this.head = 0;
    this.length = 0;
  }

  push(x: number, y: number): void {
    this.points[this.head] = { x, y, t: performance.now() };
    this.head = (this.head + 1) % this.capacity;
    this.length = Math.min(this.length + 1, this.capacity);
  }

  toOrderedArray(): Array<{ x: number; y: number; t: number }> {
    const out: Array<{ x: number; y: number; t: number }> = [];
    for (let i = 0; i < this.length; i += 1) {
      const index = (this.head - this.length + i + this.capacity) % this.capacity;
      out.push(this.points[index]);
    }
    return out;
  }
}

class TrailOverlay {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private dpr = 1;
  private previousBounds: { minX: number; minY: number; maxX: number; maxY: number } | null = null;
  private labelShownAt = 0;
  private labelArrow = '•';

  show(): void {
    if (this.canvas) return;

    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('data-tabineko-overlay', 'true');
    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100vw';
    this.canvas.style.height = '100vh';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '2147483647';

    this.resize();
    this.ctx = this.canvas.getContext('2d');
    if (this.ctx) {
      this.ctx.scale(this.dpr, this.dpr);
    }

    document.documentElement.appendChild(this.canvas);
  }

  hide(): void {
    this.canvas?.remove();
    this.canvas = null;
    this.ctx = null;
    this.previousBounds = null;
  }

  resize(): void {
    if (!this.canvas) return;
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(window.innerWidth * this.dpr);
    this.canvas.height = Math.floor(window.innerHeight * this.dpr);
    if (this.ctx) {
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }
  }

  setDirectionArrow(arrow: string): void {
    this.labelArrow = arrow;
    this.labelShownAt = performance.now();
  }

  draw(points: RingBuffer, color: string, showLabel: boolean): void {
    if (!this.ctx || !this.canvas) return;

    const ordered = points.toOrderedArray();
    if (ordered.length < 2) return;

    if (this.previousBounds) {
      this.ctx.clearRect(
        this.previousBounds.minX - 1,
        this.previousBounds.minY - 1,
        this.previousBounds.maxX - this.previousBounds.minX + 2,
        this.previousBounds.maxY - this.previousBounds.minY + 2
      );
    }

    const bounds = this.computeBounds(ordered);
    this.previousBounds = bounds;

    this.ctx.beginPath();
    this.ctx.lineWidth = 3;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.strokeStyle = this.withAlpha(color, 0.85);
    this.ctx.shadowColor = this.withAlpha(color, 0.4);
    this.ctx.shadowBlur = 8;
    this.ctx.moveTo(ordered[0].x, ordered[0].y);

    for (let i = 1; i < ordered.length; i += 1) {
      this.ctx.lineTo(ordered[i].x, ordered[i].y);
    }
    this.ctx.stroke();

    if (showLabel) {
      this.drawDirectionLabel();
    }
  }

  private drawDirectionLabel(): void {
    if (!this.ctx) return;
    const elapsed = performance.now() - this.labelShownAt;
    const opacity = Math.min(elapsed / 120, 1);
    const text = this.labelArrow;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    this.ctx.save();
    this.ctx.font = '700 18px system-ui';
    const width = this.ctx.measureText(text).width + 28;
    const height = 34;
    const x = cx - width / 2;
    const y = cy - height / 2;

    this.ctx.globalAlpha = opacity * 0.95;
    this.roundRectPath(x, y, width, height, 17);
    this.ctx.fillStyle = 'rgba(26,31,30,0.88)';
    this.ctx.fill();

    this.ctx.globalAlpha = opacity;
    this.ctx.fillStyle = '#e8ede7';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(text, cx, cy + 1);
    this.ctx.restore();
  }

  private roundRectPath(x: number, y: number, w: number, h: number, r: number): void {
    if (!this.ctx) return;
    this.ctx.beginPath();
    this.ctx.moveTo(x + r, y);
    this.ctx.arcTo(x + w, y, x + w, y + h, r);
    this.ctx.arcTo(x + w, y + h, x, y + h, r);
    this.ctx.arcTo(x, y + h, x, y, r);
    this.ctx.arcTo(x, y, x + w, y, r);
    this.ctx.closePath();
  }

  private computeBounds(points: Array<{ x: number; y: number }>): { minX: number; minY: number; maxX: number; maxY: number } {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const point of points) {
      minX = Math.min(minX, point.x - 10);
      minY = Math.min(minY, point.y - 10);
      maxX = Math.max(maxX, point.x + 10);
      maxY = Math.max(maxY, point.y + 10);
    }

    return { minX, minY, maxX, maxY };
  }

  private withAlpha(hex: string, alpha: number): string {
    const safe = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#86ac7f';
    const r = Number.parseInt(safe.slice(1, 3), 16);
    const g = Number.parseInt(safe.slice(3, 5), 16);
    const b = Number.parseInt(safe.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}

class GestureEngine {
  private settings: GestureSettings = { ...DEFAULT_SETTINGS };
  private ringBuffer = new RingBuffer(64);
  private overlay = new TrailOverlay();
  private tracking = false;
  private rafId = 0;
  private latestPoint: { x: number; y: number; shiftKey: boolean } | null = null;
  private lastLockedPoint: { x: number; y: number } | null = null;
  private uniqueDirections: Direction8[] = [];
  private totalMovement = 0;
  private startPoint: { x: number; y: number } | null = null;
  private contextHandler: ((event: MouseEvent) => void) | null = null;
  private shiftKey = false;

  constructor() {
    this.loadSettings();
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      const next = { ...this.settings };
      for (const [key, value] of Object.entries(changes)) {
        (next as Record<string, unknown>)[key] = value.newValue;
      }
      this.settings = this.normalizeSettings(next);
    });

    window.addEventListener('resize', () => this.overlay.resize(), { passive: true });
    window.addEventListener('blur', () => this.cancelGesture(), { capture: true });
    window.addEventListener('scroll', () => this.cancelGesture(), { capture: true, passive: true });
  }

  init(): void {
    document.addEventListener('mousedown', this.onMouseDown, { capture: true });
    document.addEventListener('mousemove', this.onMouseMove, { capture: true, passive: true });
    document.addEventListener('mouseup', this.onMouseUp, { capture: true });
  }

  private async loadSettings(): Promise<void> {
    try {
      const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
      this.settings = this.normalizeSettings(stored as GestureSettings);
    } catch {
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  private normalizeSettings(settings: Partial<GestureSettings>): GestureSettings {
    const map = settings.gestureMap ?? DEFAULT_GESTURE_MAP;
    return {
      enabled: typeof settings.enabled === 'boolean' ? settings.enabled : true,
      trailColor: typeof settings.trailColor === 'string' ? settings.trailColor : '#86ac7f',
      sensitivity:
        settings.sensitivity === 'low' || settings.sensitivity === 'high' || settings.sensitivity === 'medium'
          ? settings.sensitivity
          : 'medium',
      showDirectionLabel: typeof settings.showDirectionLabel === 'boolean' ? settings.showDirectionLabel : true,
      gestureMap: map,
    };
  }

  private onMouseDown = (event: MouseEvent): void => {
    if (event.button !== 2 || !this.settings.enabled) return;

    this.tracking = true;
    this.startPoint = { x: event.clientX, y: event.clientY };
    this.lastLockedPoint = { x: event.clientX, y: event.clientY };
    this.latestPoint = { x: event.clientX, y: event.clientY, shiftKey: event.shiftKey };
    this.uniqueDirections = [];
    this.totalMovement = 0;
    this.shiftKey = event.shiftKey;
    this.ringBuffer.clear();
    this.ringBuffer.push(event.clientX, event.clientY);
    this.overlay.show();
    this.attachOneShotContextmenuGate();

    this.rafId = requestAnimationFrame(this.onAnimationFrame);
  };

  private onMouseMove = (event: MouseEvent): void => {
    if (!this.tracking) return;
    if (!(event.buttons & 2)) {
      this.finishGesture();
      return;
    }
    this.latestPoint = { x: event.clientX, y: event.clientY, shiftKey: event.shiftKey };
  };

  private onMouseUp = (event: MouseEvent): void => {
    if (event.button !== 2 || !this.tracking) return;
    this.finishGesture();
  };

  private onAnimationFrame = (): void => {
    if (!this.tracking || !this.latestPoint || !this.lastLockedPoint) return;

    const dx = this.latestPoint.x - this.lastLockedPoint.x;
    const dy = this.latestPoint.y - this.lastLockedPoint.y;
    const movement = Math.hypot(dx, dy);

    if (movement > 0) {
      this.shiftKey = this.latestPoint.shiftKey;
      this.totalMovement += movement;
      this.ringBuffer.push(this.latestPoint.x, this.latestPoint.y);
    }

    const threshold = SENSITIVITY_DEAD_ZONE[this.settings.sensitivity];
    if (movement >= threshold) {
      const direction = this.quantizeDirection(dx, dy);
      const last = this.uniqueDirections[this.uniqueDirections.length - 1];
      if (direction !== last) {
        this.uniqueDirections.push(direction);
        if (this.uniqueDirections.length > 4) {
          this.uniqueDirections.shift();
        }
        this.overlay.setDirectionArrow(this.toArrow(direction));
        this.tryDispatchGesture();
      }
      this.lastLockedPoint = { x: this.latestPoint.x, y: this.latestPoint.y };
    }

    this.overlay.draw(this.ringBuffer, this.settings.trailColor, this.settings.showDirectionLabel);
    this.rafId = requestAnimationFrame(this.onAnimationFrame);
  };

  private finishGesture(): void {
    this.tracking = false;
    cancelAnimationFrame(this.rafId);
    this.overlay.hide();
    this.cleanupContextmenuGate();
  }

  private cancelGesture(): void {
    if (!this.tracking) return;
    this.tracking = false;
    cancelAnimationFrame(this.rafId);
    this.overlay.hide();
    this.cleanupContextmenuGate();
  }

  private attachOneShotContextmenuGate(): void {
    this.contextHandler = (event: MouseEvent) => {
      if (this.totalMovement > 10) {
        event.preventDefault();
        event.stopPropagation();
      } else {
        this.cancelGesture();
      }
      this.cleanupContextmenuGate();
    };
    document.addEventListener('contextmenu', this.contextHandler, { capture: true });
  }

  private cleanupContextmenuGate(): void {
    if (this.contextHandler) {
      document.removeEventListener('contextmenu', this.contextHandler, { capture: true });
      this.contextHandler = null;
    }
  }

  private tryDispatchGesture(): void {
    const sequence = this.uniqueDirections.join(',');
    const actionKey = this.settings.gestureMap[sequence];
    if (!actionKey) return;

    const message: GestureMessage = {
      type: 'GESTURE_ACTION',
      action: actionKey as GestureAction,
      shiftKey: this.shiftKey,
    };

    try {
      chrome.runtime.sendMessage(message);
    } catch {
      // ignore extension context invalidation
    }

    this.finishGesture();
  }

  private quantizeDirection(dx: number, dy: number): Direction8 {
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const normalized = (angle + 360) % 360;
    const index = Math.round(normalized / 45) % 8;
    const dirs: Direction8[] = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
    return dirs[index];
  }

  private toArrow(direction: Direction8): string {
    const map: Record<Direction8, string> = {
      N: '↑',
      NE: '↗',
      E: '→',
      SE: '↘',
      S: '↓',
      SW: '↙',
      W: '←',
      NW: '↖',
    };
    return map[direction];
  }
}

new GestureEngine().init();
