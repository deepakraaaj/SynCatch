<div align="center">

# 🎯 MissionControl

### The Desktop Workspace for Deep Focus.

**One mission. One clock. Total clarity.**

[![Tauri 2](https://img.shields.io/badge/Tauri_2-FFC131?style=for-the-badge&logo=tauri&logoColor=white)](https://v2.tauri.app)
[![React 19](https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Rust](https://img.shields.io/badge/Rust-000000?style=for-the-badge&logo=rust&logoColor=white)](https://rust-lang.org)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://sqlite.org)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)

<br/>

<img src="docs/screenshots/dashboard.png" alt="MissionControl Dashboard" width="820" />

<br/>

*A premium desktop productivity studio built with Tauri 2, React 19, and Rust.*
*Designed for people who think in missions, not to-do lists.*

</div>

---

## 🚀 The Philosophy

MissionControl isn't another task app. It's a **Focus Operating System** for your desktop.

Most productivity tools optimize for *capturing everything*. MissionControl optimizes for **finishing one thing at a time**. It respects your attention by providing a beautiful, distraction-free interface that lives where you work, helping you move from "busy" to "impactful."

---

## ✨ Core Features

### 🧠 Focus-First Dashboard
Every pixel is designed to reduce cognitive load. The dashboard shows exactly what matters: your active mission, session clock, and momentum metrics. No clutter, just flow.

### 🪟 Multi-Window Architecture
Three purpose-built surfaces for three states of mind:
- **Main App**: Plan, prioritize, and review your high-level roadmap.
- **HUD (Always-on-Top)**: A minimalist floating overlay that keeps your active task visible across all workspaces.
- **Quick Add**: A global popup (`Ctrl+Shift+Space`) to capture ideas without breaking your current focus.

### 🤖 Local Intelligence Engine
MissionControl doesn't just store tasks; it understands them. Using a local heuristic engine, it:
- **Refines Titles**: Cleans messy input into professional, scannable mission titles.
- **Infers Energy**: Automatically categorizes tasks into *Shallow*, *Deep*, or *Admin* work.
- **Suggests Outcomes**: Generates concrete "Definitions of Done" based on task types (Research, Implementation, etc.).
- **Estimates Time**: Predicts session duration based on task complexity and historical patterns.

### 📊 Distraction & Session Analytics
Stop guessing where your time goes. MissionControl tracks:
- **Deep Work Sessions**: Log focus periods and associate them with specific missions.
- **Distraction Logging**: Categorize interruptions (Messages, People, Internal) and get actionable **Avoidance Tips** to protect your future focus.
- **Momentum Metrics**: Visualize your daily and weekly rhythm to optimize for your peak energy hours.

### ☁️ Hybrid Persistence
Choose how you work:
- **Local Mode**: High-performance SQLite storage. Your data stays on your machine, always offline-first.
- **Cloud Sync**: Securely sync across devices using Supabase integration for a seamless multi-device experience.

### 🎨 Premium Design System
Switch between four curated themes that match your work energy:
- **Dark Focus**: Deep navy + crisp cyan for intense deep work.
- **Light Studio**: Warm paper tones for planning and brainstorming.
- **Midnight Purple**: Velvet indigo for late-night productivity.
- **Zen Mode**: Sage + sand for calm, steady flow.

---

## 🛠️ Technical Specifications

### Frontend Stack
- **React 19**: Leveraging the latest concurrent features for a fluid UI.
- **TypeScript 5.x**: Strict type safety across the entire application.
- **Vite**: Ultra-fast HMR and optimized build pipelines.
- **Zustand 5**: Lightweight, reactive state management with middleware for persistence.
- **Framer Motion 12**: Smooth, high-performance layout transitions and micro-animations.
- **TailwindCSS 3**: Utility-first styling bound to a tokenized CSS custom property system.

### Backend & OS Integration (Tauri 2)
- **Rust Backend**: High-performance, memory-safe desktop shell.
- **Tauri Plugin SQL**: Reliable local persistence via SQLite.
- **Global Shortcut Plugin**: System-wide event listeners for instant task capture.
- **Autostart Plugin**: Seamlessly integrates into your OS login flow.
- **Window Management**: Custom handling for transparent, always-on-top, and taskbar-skipping windows.
- **Inter-Process Communication (IPC)**: Reactive state synchronization across independent Tauri windows using the Tauri event system.

### Typography & Assets
- **Space Grotesk**: Primary UI font for a modern, architectural feel.
- **JetBrains Mono**: Monospace font for precision-focused timers and data metrics.
- **Lucide Icons**: Consistent, lightweight vector iconography.

---

## 📱 Mobile Support (Android)

MissionControl is a truly cross-platform tool. The current architecture supports:
- **Mobile-Responsive UI**: Layouts that adapt from 27" monitors to 6" phone screens.
- **Native Android Pipeline**: Dedicated scripts for environment validation, emulator testing, and generating signed release APKs.

---

## 💿 Installation & Deployment

### Windows
1. Download the latest `.msi` or `.exe` from [Releases](https://github.com/deepakraaaj/MissionControl/releases).
2. Run the installer and launch **MissionControl**.

### Linux (Ubuntu/Debian)
1. Download the latest `.deb` package.
2. Install via terminal:
   ```bash
   sudo apt install ./MissionControl_0.1.12_amd64.deb
   ```

### Android
- Download the `.apk` from the latest release assets (when available) or build from source using the provided scripts.

---

## ⌨️ Keyboard Mastery

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+Space` | Open Quick Add (Global) |
| `Ctrl+Enter` | Save Task / Confirm |
| `Escape` | Close Popup / Dismiss |
| `Tab` | Focus Navigation |

---

## 🏗️ Developer Setup

### Prerequisites
- **Node.js** ≥ 18
- **Rust** Toolchain
- **System Dependencies** (Ubuntu):
  ```bash
  sudo apt install build-essential libssl-dev libglib2.0-dev libgtk-3-dev \
      libayatana-appindicator3-dev librsvg2-dev libsoup-3.0-dev \
      libwebkit2gtk-4.1-dev libxdo-dev
  ```

### Build Scripts
- `npm run tauri:dev`: Launch the desktop development environment.
- `npm run tauri:build`: Build production installers for the current platform.
- `npm run android:build:release`: Generate a production Android APK.

---

## 📄 License

MissionControl is licensed under the **MIT License**. See [LICENSE](LICENSE) for more details.

---

<div align="center">

**Built with obsessive attention to detail.**
*MissionControl — because your work deserves a premium interface.*

[⬆ Back to top](#-missioncontrol)

</div>
