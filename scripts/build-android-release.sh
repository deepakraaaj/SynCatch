#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [[ -z "${JAVA_HOME:-}" ]]; then
  for candidate in \
    "${JAVA_HOME_21_X64:-}" \
    "/usr/lib/jvm/java-21-openjdk-amd64" \
    "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home" \
    "/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home"
  do
    if [[ -n "${candidate}" && -d "${candidate}" ]]; then
      export JAVA_HOME="${candidate}"
      export PATH="${JAVA_HOME}/bin:${PATH}"
      break
    fi
  done
fi

export ANDROID_HOME="${ANDROID_HOME:-${HOME}/Android/Sdk}"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME}}"
export NDK_HOME="${NDK_HOME:-${ANDROID_HOME}/ndk/26.1.10909125}"

cd "${REPO_ROOT}"
exec npm exec tauri android build -- --apk --aab --ci "$@"
