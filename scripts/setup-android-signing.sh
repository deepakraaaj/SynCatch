#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ANDROID_DIR="${REPO_ROOT}/src-tauri/gen/android"
KEYSTORE_PROPERTIES_PATH="${ANDROID_DIR}/keystore.properties"
KEYSTORE_DIR="${HOME}/.config/missioncontrol"
KEYSTORE_PATH="${ANDROID_KEYSTORE_PATH:-${KEYSTORE_DIR}/android-upload-keystore.jks}"
KEY_ALIAS="${ANDROID_KEY_ALIAS:-upload}"
KEY_PASSWORD="${ANDROID_KEY_PASSWORD:-$(node -e "console.log(require('node:crypto').randomBytes(24).toString('base64url'))")}"
KEY_DNAME="${ANDROID_KEY_DNAME:-CN=MissionControl, OU=Release, O=MissionControl, L=Remote, ST=Remote, C=US}"
SYNC_GITHUB_SECRETS="false"

for arg in "$@"; do
  case "$arg" in
    --github)
      SYNC_GITHUB_SECRETS="true"
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

if ! command -v keytool >/dev/null 2>&1; then
  echo "keytool is required but was not found in PATH." >&2
  exit 1
fi

mkdir -p "${KEYSTORE_DIR}"
mkdir -p "${ANDROID_DIR}"

if [[ ! -f "${KEYSTORE_PATH}" ]]; then
  keytool -genkeypair \
    -keystore "${KEYSTORE_PATH}" \
    -storetype PKCS12 \
    -storepass "${KEY_PASSWORD}" \
    -keypass "${KEY_PASSWORD}" \
    -alias "${KEY_ALIAS}" \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -dname "${KEY_DNAME}"
fi

cat > "${KEYSTORE_PROPERTIES_PATH}" <<EOF
password=${KEY_PASSWORD}
keyAlias=${KEY_ALIAS}
storeFile=${KEYSTORE_PATH}
EOF

if [[ "${SYNC_GITHUB_SECRETS}" == "true" ]]; then
  if ! command -v gh >/dev/null 2>&1; then
    echo "gh is required to sync GitHub secrets." >&2
    exit 1
  fi

  KEYSTORE_BASE64="$(base64 < "${KEYSTORE_PATH}" | tr -d '\n')"
  gh secret set ANDROID_KEY_ALIAS --body "${KEY_ALIAS}"
  gh secret set ANDROID_KEY_PASSWORD --body "${KEY_PASSWORD}"
  gh secret set ANDROID_KEY_BASE64 --body "${KEYSTORE_BASE64}"
fi

cat <<EOF
Android release signing is configured.
Keystore: ${KEYSTORE_PATH}
Properties: ${KEYSTORE_PROPERTIES_PATH}
Key alias: ${KEY_ALIAS}

Next steps:
  1. Local build: npm exec tauri android build -- --apk --aab --ci
  2. CI build: tag a release after syncing GitHub secrets with --github
EOF
