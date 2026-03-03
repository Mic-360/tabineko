import type { Direction } from './shared';

export class GestureOverlay {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr = window.devicePixelRatio || 1;
  private points: { x: number; y: number }[] = [];
  private rafId = 0;
  private dirty = false;
  private badge: HTMLDivElement;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.dataset.tabineko = 'overlay';
    this.canvas.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:2147483647;';

    this.badge = document.createElement('div');
    this.badge.style.cssText =
      'position:fixed;z-index:2147483647;pointer-events:none;padding:6px 10px;border-radius:9999px;background:rgba(17,24,39,.88);color:#f9fafb;font:500 12px/1.2 system-ui,sans-serif;transform:translate(-50%,-140%);';

    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    this.ctx = ctx;
    this.resize();
    window.addEventListener('resize', this.resize, { passive: true });
  }

  mount(): void {
    if (!this.canvas.isConnected) {
      document.documentElement.append(this.canvas, this.badge);
    }
  }

  start(x: number, y: number): void {
    this.points = [{ x, y }];
    this.badge.style.left = `${x}px`;
    this.badge.style.top = `${y}px`;
    this.badge.textContent = '';
    this.mount();
    this.requestDraw();
  }

  push(x: number, y: number): void {
    this.points.push({ x, y });
    this.requestDraw();
  }

  setDirections(directions: readonly Direction[]): void {
    const map: Record<Direction, string> = { U: '↑', D: '↓', L: '←', R: '→' };
    this.badge.textContent = directions.map((d) => map[d]).join(' ');
  }

  clear(): void {
    this.points = [];
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.badge.remove();
    this.canvas.remove();
  }

  private requestDraw(): void {
    this.dirty = true;
    if (this.rafId) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = 0;
      if (this.dirty) {
        this.dirty = false;
        this.draw();
      }
    });
  }

  private draw(): void {
    if (this.points.length < 2) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.ctx.clearRect(0, 0, w, h);
    this.ctx.beginPath();
    this.ctx.strokeStyle = '#38bdf8';
    this.ctx.lineWidth = 2.5;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.moveTo(this.points[0].x, this.points[0].y);

    for (let i = 1; i < this.points.length; i += 1) {
      const p = this.points[i];
      this.ctx.lineTo(p.x, p.y);
    }

    this.ctx.stroke();
  }

  private resize = (): void => {
    this.canvas.width = Math.floor(window.innerWidth * this.dpr);
    this.canvas.height = Math.floor(window.innerHeight * this.dpr);
    this.canvas.style.width = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  };
}
