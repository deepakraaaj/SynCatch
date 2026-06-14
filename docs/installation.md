# Installing SynCatch on Ubuntu

SynCatch ships as a `.deb` package, an AppImage, and an `.rpm`. On Ubuntu/Debian the `.deb` is the recommended path.

> **Note on identifiers:** the binary and package are internally named `mission-control` / `missioncontrol` (legacy bundle identifier `com.missioncontrol.desktop`). The app shows as **SynCatch** in your launcher. These internal names are expected.

---

## Option A — `.deb` package (recommended)

1. Download the latest `SynCatch_<version>_amd64.deb` from [Releases](https://github.com/deepakraaaj/SynCatch/releases).
2. Install it:
   ```bash
   sudo apt install ./SynCatch_<version>_amd64.deb
   ```
   `apt` resolves the WebKitGTK and other runtime dependencies automatically. (You can also double-click the file to install via the Software app.)
3. Launch **SynCatch** from your application menu, or from a terminal:
   ```bash
   missioncontrol
   ```

### Update
Install the newer `.deb` over the old one — `apt` upgrades in place:
```bash
sudo apt install ./SynCatch_<newversion>_amd64.deb
```

### Uninstall
```bash
sudo apt remove --purge syncatch        # or 'mission-control' for older installs
```
To also wipe local data (database, settings):
```bash
rm -rf ~/.local/share/com.missioncontrol.desktop
```

---

## Option B — AppImage (no install)

1. Download `SynCatch_<version>_amd64.AppImage`.
2. Make it executable and run:
   ```bash
   chmod +x SynCatch_<version>_amd64.AppImage
   ./SynCatch_<version>_amd64.AppImage
   ```
3. If it fails to start, install FUSE (older AppImages need it):
   ```bash
   sudo apt install libfuse2
   ```

---

## Runtime dependencies

The `.deb` declares these, but if you hit a missing-library error (common with the AppImage), install:
```bash
sudo apt install libwebkit2gtk-4.1-0 libgtk-3-0 libayatana-appindicator3-1 librsvg2-2
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Blank/white window on launch | Ensure `libwebkit2gtk-4.1-0` is installed; try launching from a terminal to see errors. |
| App won't reopen after closing | Single-instance guard may be holding a lock — `pkill -f missioncontrol`, then relaunch. |
| Want a clean reset | Remove the data dir: `rm -rf ~/.local/share/com.missioncontrol.desktop` |

To **build from source** instead of installing a release, see the [Local Development guide](developer-guide.md).
