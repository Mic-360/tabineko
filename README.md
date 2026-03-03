# TabiNeko (MV3)

High-performance Chrome gesture extension using a modular architecture:

- `background.ts`: service worker and tab/window actions
- `gestureContent.ts`: pointer gesture detection, filtering, and messaging
- `overlay.ts`: lightweight canvas trail renderer
- `popup.tsx`: quick gesture mapping UI
- `options.tsx`: full settings UI with live gesture predictor

## Performance-focused gesture engine

- Pointer Events (`pointerdown/move/up`) with throttled movement sampling
- Compressed direction patterns (`R,D,L...`) with deduplication
- Canvas overlay drawn in `requestAnimationFrame`
- Context menu remains available for short right-click drags
- Optional debug logging and blacklist filtering

## Build

```bash
bun install
bun run build
```

## Test

```bash
bun test
```

## Load unpacked

Load `dist/` in `chrome://extensions`.
