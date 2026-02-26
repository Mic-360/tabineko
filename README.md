# 🐾 TabiNeko

<img src="public/assets/images/icon128.png" align="right" width="128" height="128" title="TabiNeko">

**Right-click. Swipe. Flow.**

TabiNeko is a premium, production-ready mouse gesture extension for Chrome (Manifest V3). Navigate your browser with fluid, intuitive gestures inspired by Japanese minimalist design.

---

## 🌟 Features

- **Gesture System**: High-performance gesture detection with right-click drag.
- **Visual Feedback**: Real-time smooth line trail and cardinal direction labels.
- **Premium Design**: Calming sage-green aesthetics with fluid motion language.
- **Built with Modern Tech**: Astro, Bun, and TypeScript for a fast, type-safe developer experience.

---

## 🎮 Gesture Mapping

| Gesture                 | Action               |
| :---------------------- | :------------------- |
| `→ ↓` (Right then Down) | **Next Tab**         |
| `← ↑` (Left then Up)    | **Previous Tab**     |
| `↑` (Up)                | **Scroll to Top**    |
| `↓` (Down)              | **Scroll to Bottom** |
| `←` (Left)              | **Go Back**          |
| `→` (Right)             | **Go Forward**       |
| `↻` (Circle)            | **Refresh Page**     |

---

## 🏗️ Architecture

- **Manifest V3**: Using modern extension standards.
- **Astro**: For building a beautiful, performant popup UI.
- **Bun**: Fast runtime for bundling and development tools.
- **Sharp**: For high-quality, dependency-free icon generation.

---

## 🛠️ Development

### Setup

```bash
bun install
```

### Build

To build the extension for loading:

```bash
bun run build
```

This will compile the Astro popup, bundle the background and content scripts, and extract inline scripts for CSP compliance into the `dist/` folder.

### Icons

If you change the source icon in `public/assets/images/icon.png`, regenerate sizes with:

```bash
bun run icons
```

### Format

```bash
bun run format
```

---

## 🚀 How to Load

1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** in the top right.
3. Click **Load unpacked**.
4. Select the `dist/` folder from this project.

---

## 📄 License

MIT © [AminoffZ/catonaut](https://github.com/AminoffZ/catonaut) (Original Template)
TabiNeko modifications & Branding: Custom Implementation
