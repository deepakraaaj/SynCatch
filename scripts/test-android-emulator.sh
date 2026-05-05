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
export PATH="${ANDROID_HOME}/platform-tools:${PATH}"

SDKMANAGER_BIN="${ANDROID_HOME}/cmdline-tools/latest/bin/sdkmanager"
AVDMANAGER_BIN="${ANDROID_HOME}/cmdline-tools/latest/bin/avdmanager"
EMULATOR_BIN="${ANDROID_HOME}/emulator/emulator"

AVD_NAME="${ANDROID_AVD_NAME:-Medium_Phone_API_36.1}"
AVD_DEVICE="${ANDROID_AVD_DEVICE:-medium_phone}"
SYSTEM_IMAGE="${ANDROID_SYSTEM_IMAGE:-system-images;android-36.1;google_apis;x86_64}"
SYSTEM_IMAGE_DIR="${ANDROID_HOME}/${SYSTEM_IMAGE//;/\/}"
APK_PATH="${1:-${REPO_ROOT}/src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk}"
PACKAGE_NAME="${ANDROID_APP_ID:-com.missioncontrol.desktop}"
TMP_DIR="${REPO_ROOT}/.tmp"
EMULATOR_LOG="${TMP_DIR}/android-emulator.log"
LOGCAT_LOG="${TMP_DIR}/android-logcat.log"
RUN_DIR="/run/user/$(id -u)/avd/running"

mkdir -p "${TMP_DIR}"

install_sdk_package() {
  local package="$1"

  set +o pipefail
  yes | "${SDKMANAGER_BIN}" --install "${package}"
  set -o pipefail
}

ensure_requirements() {
  if [[ ! -x "${SDKMANAGER_BIN}" || ! -x "${AVDMANAGER_BIN}" ]]; then
    echo "Android cmdline-tools are missing under ${ANDROID_HOME}." >&2
    exit 1
  fi

  if [[ ! -x "${EMULATOR_BIN}" ]]; then
    echo "Installing Android emulator package..."
    install_sdk_package "emulator"
  fi

  if [[ ! -d "${SYSTEM_IMAGE_DIR}" ]]; then
    echo "Installing Android system image ${SYSTEM_IMAGE}..."
    install_sdk_package "${SYSTEM_IMAGE}"
  fi
}

ensure_avd() {
  local avd_dir="${HOME}/.android/avd/${AVD_NAME}.avd"
  local avd_ini="${HOME}/.android/avd/${AVD_NAME}.ini"

  if [[ -d "${avd_dir}" && -f "${avd_ini}" ]]; then
    return
  fi

  rm -f "${avd_ini}"
  echo "Creating AVD ${AVD_NAME}..."
  echo "no" | "${AVDMANAGER_BIN}" create avd \
    -n "${AVD_NAME}" \
    -k "${SYSTEM_IMAGE}" \
    -d "${AVD_DEVICE}" \
    --force >/dev/null
}

stop_existing_avd() {
  if [[ ! -d "${RUN_DIR}" ]]; then
    return
  fi

  while IFS= read -r pid_file; do
    if grep -q "^avd.id=${AVD_NAME}$" "${pid_file}"; then
      local pid
      pid="$(basename "${pid_file}")"
      pid="${pid#pid_}"
      pid="${pid%.ini}"
      kill "${pid}" 2>/dev/null || true
    fi
  done < <(find "${RUN_DIR}" -maxdepth 1 -type f -name 'pid_*.ini' 2>/dev/null)

  sleep 2
  adb kill-server >/dev/null 2>&1 || true
}

build_apk_if_missing() {
  if [[ -f "${APK_PATH}" ]]; then
    return
  fi

  echo "APK not found at ${APK_PATH}. Building release APK first..."
  "${SCRIPT_DIR}/build-android-release.sh" --target aarch64
}

launch_emulator() {
  local -a args

  args=(
    -avd "${AVD_NAME}"
    -no-audio
    -no-snapshot
    -gpu swiftshader_indirect
    -no-boot-anim
  )

  if [[ "${ANDROID_EMULATOR_HEADLESS:-1}" == "1" ]]; then
    args=(-no-window "${args[@]}")
  fi

  if [[ "${ANDROID_EMULATOR_WIPE_DATA:-0}" == "1" ]]; then
    args=(-wipe-data "${args[@]}")
  fi

  if [[ -n "${ANDROID_EMULATOR_EXTRA_ARGS:-}" ]]; then
    read -r -a extra_args <<< "${ANDROID_EMULATOR_EXTRA_ARGS}"
    args+=("${extra_args[@]}")
  fi

  : > "${EMULATOR_LOG}"
  nohup "${EMULATOR_BIN}" "${args[@]}" >"${EMULATOR_LOG}" 2>&1 &
}

wait_for_serial() {
  local serial=""

  adb start-server >/dev/null

  for _ in $(seq 1 90); do
    serial="$(adb devices | awk '/^emulator-[0-9]+\t/{print $1; exit}')"
    if [[ -n "${serial}" ]]; then
      printf '%s\n' "${serial}"
      return
    fi
    sleep 2
  done

  echo "Timed out waiting for emulator serial. See ${EMULATOR_LOG}." >&2
  exit 1
}

wait_for_device_state() {
  local serial="$1"

  for _ in $(seq 1 180); do
    if [[ "$(adb -s "${serial}" get-state 2>/dev/null || true)" == "device" ]]; then
      return
    fi
    sleep 2
  done

  echo "Emulator ${serial} never reached device state. See ${EMULATOR_LOG}." >&2
  exit 1
}

wait_for_boot() {
  local serial="$1"

  for _ in $(seq 1 180); do
    if [[ "$(adb -s "${serial}" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; then
      return
    fi
    sleep 2
  done

  echo "Emulator ${serial} never reported boot completion. See ${EMULATOR_LOG}." >&2
  exit 1
}

smoke_test_apk() {
  local serial="$1"

  adb -s "${serial}" logcat -c || true
  adb -s "${serial}" install -r "${APK_PATH}"
  adb -s "${serial}" shell monkey -p "${PACKAGE_NAME}" -c android.intent.category.LAUNCHER 1 >/dev/null
  sleep 8

  adb -s "${serial}" logcat -d -t 200 > "${LOGCAT_LOG}" || true

  if ! adb -s "${serial}" shell pidof "${PACKAGE_NAME}" >/dev/null 2>&1; then
    echo "App process ${PACKAGE_NAME} did not stay running. See ${LOGCAT_LOG}." >&2
    exit 1
  fi

  if grep -Eq 'FATAL EXCEPTION|AndroidRuntime' "${LOGCAT_LOG}"; then
    echo "Detected fatal Android runtime logs. See ${LOGCAT_LOG}." >&2
    exit 1
  fi

  echo "APK installed and launched successfully on ${serial}."
  echo "Emulator log: ${EMULATOR_LOG}"
  echo "Logcat: ${LOGCAT_LOG}"
}

ensure_requirements
ensure_avd
build_apk_if_missing
stop_existing_avd
launch_emulator

SERIAL="$(wait_for_serial)"
wait_for_device_state "${SERIAL}"
wait_for_boot "${SERIAL}"

adb -s "${SERIAL}" shell input keyevent 82 >/dev/null 2>&1 || true
smoke_test_apk "${SERIAL}"
