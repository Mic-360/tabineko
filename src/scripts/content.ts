/**
 * content.ts — TabiNeko content script
 *
 * Injected into every webpage. Handles:
 * - Mouse event listeners for gesture tracking
 * - Executing page-level actions (scroll, back, forward, reload)
 * - Sending tab-switch messages to the background service worker
 * - Suppressing context menu when a gesture was performed
 */

import { GestureTracker } from './internal/gesture';

// ─── Type Definitions ───────────────────────────────────────────

/** Messages sent to the background service worker */
interface TabMessage {
  type: 'NEXT_TAB' | 'PREV_TAB';
}

/**
 * Visual trail that follows the gesture path as a smooth, connected line.
 * Uses a Canvas element for high-performance rendering.
 */
class GestureTrail {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private points: { x: number; y: number }[] = [];
  private isVisible = false;

  /** Show the trail overlay and initialize canvas */
  show(): void {
    if (this.canvas) return;

    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('data-tabineko-trail', 'true');

    // Full screen canvas
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Scale for high-DPI displays
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;

    Object.assign(this.canvas.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: `${width}px`,
      height: `${height}px`,
      pointerEvents: 'none',
      zIndex: '2147483647',
      opacity: '1',
      transition: 'opacity 0.3s ease-out',
    });

    this.ctx = this.canvas.getContext('2d');
    if (this.ctx) {
      this.ctx.scale(dpr, dpr);
    }

    document.documentElement.appendChild(this.canvas);
    this.isVisible = true;
    this.points = [];
  }

  /** Add a point and redraw the line */
  addPoint(x: number, y: number): void {
    if (!this.ctx || !this.isVisible) return;

    this.points.push({ x, y });
    this.draw();
  }

  /** Redraw the entire path */
  private draw(): void {
    if (!this.ctx || !this.canvas || this.points.length < 2) return;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.beginPath();
    this.ctx.lineWidth = 3;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    // TabiSage Color with a slight glow
    this.ctx.strokeStyle = '#9CAF88';
    this.ctx.shadowColor = 'rgba(156, 175, 136, 0.4)';
    this.ctx.shadowBlur = 4;

    this.ctx.moveTo(this.points[0].x, this.points[0].y);

    // Quadratic curve for smoother lines
    for (let i = 1; i < this.points.length - 1; i++) {
      const xc = (this.points[i].x + this.points[i + 1].x) / 2;
      const yc = (this.points[i].y + this.points[i + 1].y) / 2;
      this.ctx.quadraticCurveTo(this.points[i].x, this.points[i].y, xc, yc);
    }

    // For the last point
    if (this.points.length > 1) {
      const last = this.points[this.points.length - 1];
      this.ctx.lineTo(last.x, last.y);
    }

    this.ctx.stroke();
  }

  /** Hide and cleanup */
  hide(): void {
    if (!this.canvas) return;

    const ref = this.canvas;
    ref.style.opacity = '0';

    setTimeout(() => {
      ref.remove();
    }, 300);

    this.canvas = null;
    this.ctx = null;
    this.points = [];
    this.isVisible = false;
  }
}

// ─── Gesture Label Overlay ──────────────────────────────────────

/**
 * Shows a small label near the gesture start point indicating
 * the currently recognized gesture directions.
 */
class GestureLabel {
  private element: HTMLDivElement | null = null;

  show(x: number, y: number): void {
    if (this.element) return;

    this.element = document.createElement('div');
    this.element.setAttribute('data-tabineko-label', 'true');

    Object.assign(this.element.style, {
      position: 'fixed',
      left: `${x}px`,
      top: `${y - 30}px`,
      padding: '4px 10px',
      borderRadius: '8px',
      backgroundColor: 'rgba(46, 47, 44, 0.85)',
      color: '#EEF3EA',
      fontFamily:
        "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontSize: '12px',
      fontWeight: '500',
      letterSpacing: '0.5px',
      pointerEvents: 'none',
      zIndex: '2147483647',
      opacity: '0',
      transform: 'translateY(4px)',
      transition: 'opacity 0.15s ease-out, transform 0.15s ease-out',
      whiteSpace: 'nowrap',
    });

    document.documentElement.appendChild(this.element);

    // Trigger entrance animation
    requestAnimationFrame(() => {
      if (this.element) {
        this.element.style.opacity = '1';
        this.element.style.transform = 'translateY(0)';
      }
    });
  }

  update(directions: readonly string[]): void {
    if (!this.element) return;

    if (directions.length === 0) {
      this.element.textContent = '';
      this.element.style.opacity = '0';
      return;
    }

    // Map direction letters to arrow symbols
    const arrowMap: Record<string, string> = {
      U: '↑',
      D: '↓',
      L: '←',
      R: '→',
    };

    const label = directions.map((d) => arrowMap[d] ?? d).join(' ');
    this.element.textContent = label;
    this.element.style.opacity = '1';
  }

  showCircle(): void {
    if (!this.element) return;
    this.element.textContent = '↻';
    this.element.style.opacity = '1';
  }

  hide(): void {
    if (!this.element) return;

    this.element.style.opacity = '0';
    this.element.style.transform = 'translateY(4px)';

    const ref = this.element;
    setTimeout(() => ref.remove(), 200);
    this.element = null;
  }
}

// ─── Action Executor ────────────────────────────────────────────

/** Execute the action corresponding to a gesture signature */
function executeGesture(gesture: string): void {
  switch (gesture) {
    case 'U':
      window.scrollTo({ top: 0, behavior: 'smooth' });
      break;

    case 'D':
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: 'smooth',
      });
      break;

    case 'L':
      history.back();
      break;

    case 'R':
      history.forward();
      break;

    case 'CIRCLE':
      location.reload();
      break;

    case 'R,D':
      sendMessage({ type: 'NEXT_TAB' });
      break;

    case 'L,U':
      sendMessage({ type: 'PREV_TAB' });
      break;
  }
}

/** Send a message to the background service worker */
function sendMessage(message: TabMessage): void {
  try {
    chrome.runtime.sendMessage(message);
  } catch {
    // Extension context may be invalidated (e.g., after update)
  }
}

// ─── Main Initialization ────────────────────────────────────────

function init(): void {
  const tracker = new GestureTracker();
  const trail = new GestureTrail();
  const label = new GestureLabel();

  /** Whether the context menu should be suppressed */
  let suppressContextMenu = false;

  /** The starting position of the gesture (for label placement) */
  let gestureStartX = 0;
  let gestureStartY = 0;

  // ── Mouse Down: Start tracking on right-click ──

  document.addEventListener(
    'mousedown',
    (e: MouseEvent) => {
      // Button 2 = right mouse button
      if (e.button !== 2) return;

      gestureStartX = e.clientX;
      gestureStartY = e.clientY;

      tracker.start(e.clientX, e.clientY);
      trail.show();
      label.show(e.clientX, e.clientY);
    },
    { capture: true }
  );

  // ── Mouse Move: Track gesture while right button held ──

  document.addEventListener(
    'mousemove',
    (e: MouseEvent) => {
      if (!tracker.isActive) return;

      // Verify right button is still pressed (buttons bitmask: bit 1 = right)
      if (!(e.buttons & 2)) {
        // Right button was released without mouseup firing (edge case)
        const gesture = tracker.end();
        trail.hide();
        label.hide();
        if (gesture) {
          suppressContextMenu = true;
          executeGesture(gesture);
        }
        return;
      }

      tracker.move(e.clientX, e.clientY);
      trail.addPoint(e.clientX, e.clientY);

      // Update the label with current direction sequence
      label.update(tracker.currentDirections);
    },
    { capture: true }
  );

  // ── Mouse Up: Finish gesture and execute action ──

  document.addEventListener(
    'mouseup',
    (e: MouseEvent) => {
      if (e.button !== 2) return;
      if (!tracker.isActive) return;

      const gesture = tracker.end();
      trail.hide();
      label.hide();

      if (gesture) {
        suppressContextMenu = true;
        executeGesture(gesture);
      }
    },
    { capture: true }
  );

  // ── Context Menu: Suppress only when a gesture was used ──

  document.addEventListener(
    'contextmenu',
    (e: MouseEvent) => {
      if (suppressContextMenu) {
        e.preventDefault();
        e.stopPropagation();
        suppressContextMenu = false;
      }
    },
    { capture: true }
  );
}

// Run initialization
init();
