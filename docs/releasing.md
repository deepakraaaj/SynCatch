# Pushing & Releasing SynCatch

How to ship a new version. Releases are fully automated by GitHub Actions — **pushing a version tag** builds every platform and publishes a GitHub Release.

- Workflow: [`.github/workflows/release.yml`](../.github/workflows/release.yml)
- Trigger: any tag matching `v*` (e.g. `v0.5.1`)
- Builds: **Ubuntu `.deb`**, **Windows `.exe` (NSIS)**, **Android `.apk`** (universal)
- Publishes: a GitHub Release with auto-generated notes and all three artifacts attached

---

## 1. Push day-to-day work

```bash
git add -A
git commit -m "feat: ..."
git push origin main
```
Pushing to `main` does **not** trigger a release — only tags do. Iterate freely.

---

## 2. Cut a release

### Step 1 — Bump versions
Keep these in sync before tagging:

| File | Field |
|------|-------|
| `package.json` | `version` |
| `src-tauri/tauri.conf.json` | `version` |
| `src-tauri/Cargo.toml` | `version` (under `[package]`) |

Commit the bump:
```bash
git commit -am "chore: release v0.5.1"
git push origin main
```

### Step 2 — Tag and push
```bash
git tag -a v0.5.1 -m "SynCatch v0.5.1"
git push origin v0.5.1
```
The push triggers the `release` workflow. It builds all three platforms in parallel, then the `publish` job creates the GitHub Release titled `SynCatch 0.5.1` with `--generate-notes`.

### Step 3 — Watch the build
```bash
gh run list --workflow=release.yml --limit=5
gh run watch          # live status of the latest run
```
Or open <https://github.com/deepakraaaj/SynCatch/actions>.

### Step 4 — Verify the release
Once green, check <https://github.com/deepakraaaj/SynCatch/releases> for the `.deb`, `.exe`, and `.apk` assets. Edit the notes if needed.

---

## 3. Required GitHub secrets

Set these in **Settings → Secrets and variables → Actions** (the build fails silently if missing):

| Secret | Purpose |
|--------|---------|
| `ANDROID_KEY_BASE64` | Base64-encoded Android upload keystore |
| `ANDROID_KEY_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Key alias (usually `upload`) |
| `VITE_SUPABASE_URL` | Supabase project URL (baked into the build) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `VITE_CEREBRAS_API_KEY` | Cerebras key for the AI assistant |
| `VITE_CEREBRAS_MODEL` | *(optional)* defaults to `gpt-oss-120b` |

For generating and syncing the Android keystore secrets, see [Android Release](android-release.md).

---

## 4. Re-tagging after a late fix

If you need to change the tagged commit:
```bash
git tag -d v0.5.1                       # delete local
git push origin --delete v0.5.1         # delete remote (also removes the in-progress run's ref)
# commit the fix, then re-tag:
git tag -a v0.5.1 -m "SynCatch v0.5.1"
git push origin v0.5.1
```
The publish job is idempotent: if the release already exists it re-uploads assets with `--clobber`; otherwise it creates it.

---

## 5. Local build (before tagging)

Smoke-test bundles locally so you don't burn a CI run on a broken build:
```bash
npm run tauri:build             # desktop installers for the current OS
npm run android:build:release   # signed Android APK
```
Desktop artifacts land in `src-tauri/target/release/bundle/`; the APK in
`src-tauri/gen/android/app/build/outputs/apk/universal/release/`.

> **AppImage build failing** with `there is no 'libdir' variable for 'librsvg-2.0'` / `failed to run linuxdeploy`? Install the dev package the GTK plugin needs:
> ```bash
> sudo apt install librsvg2-dev
> ```
> The `.deb` and `.rpm` build fine without it, and CI (which installs `librsvg2-dev` and only builds the `.deb`) is unaffected.

---

## 6. Pre-release checklist

- [ ] Versions bumped in all three files and in sync
- [ ] `npm run lint` and `npm run build` pass
- [ ] Local `npm run tauri:build` produces a working `.deb`
- [ ] Local Android build passes with the keystore
- [ ] GitHub secrets present and current
- [ ] Tag pushed; all three CI artifacts verified on the Release page

Hit a build problem? See [Release Troubleshooting](release-troubleshooting.md).
