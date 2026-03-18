# Release Notes — v0.2.0

## 🎯 "Make It Famous" Release

*March 18, 2026*

This release transforms MissionControl from a powerful internal tool into a showcase-ready open source project. Every change is designed to make the first impression unforgettable.

---

### ✨ New: Premium GitHub README

A comprehensive `README.md` that sells the product at first glance:

- **Hero section** with app screenshot and tagline
- **Tech stack badges** — Tauri 2, React 19, TypeScript, Rust, SQLite
- **Feature highlights** — Focus-first design, multi-window architecture, 4 themes, keyboard-first UX
- **Screenshot gallery** — Dashboard, Tasks, Workspace, Settings views
- **Architecture diagram** — Full project structure with component breakdown
- **Quick Start guide** — Prerequisites, install, run, and build commands
- **Keyboard shortcuts reference** — Complete shortcut table
- **Theming documentation** — How the tokenized CSS system works
- **AI layer overview** — Pluggable provider abstraction
- **Roadmap** — Phase 1–4 progression
- **Contributing guide** — Fork → branch → PR workflow

### 🌐 New: Landing Page

A standalone `docs/index.html` ready for GitHub Pages deployment:

- Dark premium design matching the app's aesthetic
- Animated gradient hero with "locked in" tagline
- 6 glassmorphic feature cards with scroll-reveal animations
- 3 window specification cards (Main, HUD, Quick Add)
- 4 theme palette swatches
- Installation CTA with terminal commands
- Sticky navigation with smooth scroll
- Tech stack badges (Tauri, React, TypeScript, Rust, SQLite, Framer Motion)
- Fully responsive down to mobile
- SEO-optimized meta tags and Open Graph support

### 🎨 New: App Branding

- **SVG favicon** with gradient MissionControl logomark across all 3 windows
- **Meta tags** — `theme-color`, description, and proper `<title>` tags

### ✨ Enhanced: Dashboard Polish

- **Animated gradient shimmer** on the Dashboard hero card — a slow-moving 3-color gradient that brings the surface to life
- **Keyboard shortcut badge** with pulsing dot indicator — `Ctrl+Shift+Space for Quick Add` for discoverability
- **New CSS utility classes** — `.hero-gradient`, `.kbd-badge`, `.pulse-dot` with corresponding keyframe animations

---

### 📁 Files Changed

| Action | File | Description |
|--------|------|-------------|
| ✅ NEW | `README.md` | Premium GitHub README |
| ✅ NEW | `docs/index.html` | Landing page for GitHub Pages |
| ✅ NEW | `docs/screenshots/*.png` | 4 app view screenshots |
| ✅ NEW | `public/favicon.svg` | SVG favicon |
| 📝 MOD | `index.html` | Favicon + meta tags |
| 📝 MOD | `hud.html` | Favicon |
| 📝 MOD | `quick-add.html` | Favicon |
| 📝 MOD | `src/styles/globals.css` | Animated gradient + badge CSS |
| 📝 MOD | `src/app/main/MainApp.tsx` | Hero gradient + shortcut badge |

### ✅ Verification

- `npm run build` — 0 errors
- `npm run lint` — 0 errors
- Visual verification — all 4 app views + landing page confirmed

---

### 🚀 Deployment

To enable the landing page:
1. Go to GitHub → Settings → Pages
2. Set source to **Deploy from a branch**
3. Select `main` branch, `/docs` folder
4. Save — your site will be live at `https://deepakraaaj.github.io/MissionControl/`
