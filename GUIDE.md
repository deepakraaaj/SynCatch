# MissionControl Developer Guide

This guide covers common troubleshooting steps and development workflows you've encountered while building and testing MissionControl.

## 0. PC Environment Setup (Prerequisites)
Before you can build for either platform, your Linux machine needs:

### A. General Tools
* **Rust**: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
* **Node.js**: Recommended via `nvm` (Node 20+).
* **Build Tools**: `sudo apt install build-essential curl wget libssl-dev`

### B. Linux Desktop Libraries
```bash
sudo apt install libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev
```

### C. Android Development
* **Android Studio**: Install and use the "SDK Manager" to install:
    * Android SDK Platform (API 34 or 35).
    * Android SDK Build-Tools.
    * **NDK (Side by side)**: Essential for Rust compilation.
    * **CMake**.
* **Java**: `sudo apt install openjdk-17-jdk`
* **Environment Variables**: Ensure your `~/.bashrc` or `~/.zshrc` has:
    ```bash
    export ANDROID_HOME=$HOME/Android/Sdk
    export NDK_HOME=$ANDROID_HOME/ndk/$(ls $ANDROID_HOME/ndk)
    ```

---

## 1. Managing Processes & Port Conflicts
If you see `Error: Port 1420 is already in use`, it means a previous dev session didn't close properly.

### Clean all ports and processes
Run this command to kill all Vite and Tauri processes:
```bash
# Kill processes by port
lsof -ti :1420,1421 | xargs kill -9 2>/dev/null

# Kill processes by name
pkill -f "vite"
pkill -f "missioncontrol"
```

### Check if something is still running
```bash
lsof -i :1420
ps aux | grep missioncontrol
```

---

## 2. Android Development Workflow

### Option A: Physical Device (Your Phone)
This is what you are currently using via USB.

**Prerequisites (One-time setup):**
* **Enable Developer Options**: Settings -> About Phone -> Tap "Build Number" 7 times.
* **Enable USB Debugging**: Settings -> System/Developer Options -> USB Debugging ON.
* **Trust Computer**: Accept the "Allow USB Debugging?" popup on your phone (Check "Always allow").

**Workflow:**
1. Connect your phone via USB.
2. Run the app:
   ```bash
   npm run tauri android dev
   ```

### Option B: Start the Emulator
If you don't have your phone handy:
1. **List your emulator names**:
   ```bash
   ~/Android/Sdk/emulator/emulator -list-avds
   ```
2. **Start the emulator**:
   ```bash
   # Replace 'Pixel_7' with your AVD name
   ~/Android/Sdk/emulator/emulator -avd Pixel_7 &
   ```
3. **Run the app**:
   ```bash
   npm run tauri android dev
   ```

---

## 3. Fresh Start (Deep Clean)
If you want to test a new version as if it were the first time installing it, follow these steps:

### Remove the installed App
```bash
# Uninstall the package
sudo apt remove --purge -y mission-control

# Remove the App Drawer shortcut (if it remains)
sudo rm /usr/share/applications/MissionControl.desktop

# Delete local database and settings (CRITICAL for fresh test)
rm -rf ~/.local/share/com.missioncontrol.desktop
```

### Clean the Build Cache
If you encounter weird Rust errors after changing configurations:
```bash
cd src-tauri
cargo clean
cd ..
```

---

## 4. Important Tips

### Desktop Dev vs. System Install
If you have MissionControl installed on your system, you **must** close it before running `npm run tauri:dev`. Because of the "Single Instance" feature, the dev version will exit immediately if the system version is already running.

### Mobile multi-window limitation
Android only supports a **single window**. Desktop features like the "HUD" or "Quick Add" windows are handled automatically in `lib.rs`:
- On **Desktop**: These windows are created dynamically at startup.
- On **Android**: Only the `main` window is created, and "Quick Add" opens as a mobile-friendly overlay inside that same window.

---

## 5. Quick Reference Commands

| Goal | Command |
| :--- | :--- |
| **Run Desktop Dev** | `npm run tauri:dev` |
| **Run Android Dev** | `npm run tauri android dev` |
| **Stop everything** | `lsof -ti :1420,1421 | xargs kill -9` |
| **Check Logs** | `adb logcat | grep "Web Console"` |
