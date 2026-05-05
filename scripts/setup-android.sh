#!/bin/bash
set -e

echo "Starting Android Environment Setup for MissionControl..."

# 1. Add Rust targets
echo "Adding Rust targets for Android..."
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android

# 2. Setup Android SDK Directory
export ANDROID_HOME=$HOME/Android/Sdk
mkdir -p $ANDROID_HOME/cmdline-tools

# 3. Download Command Line Tools if not present
if [ ! -d "$ANDROID_HOME/cmdline-tools/latest" ]; then
    echo "Downloading Android Command Line Tools..."
    curl -o cmdline-tools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
    unzip -q cmdline-tools.zip
    mv cmdline-tools $ANDROID_HOME/cmdline-tools/latest
    rm cmdline-tools.zip
fi

# 4. Install necessary SDK components
echo "Installing SDK platforms and build tools..."
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
# Note: This usually requires accepting licenses interactively. 
# We'll try to automate it.
yes | $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --sdk_root=$ANDROID_HOME "platforms;android-34" "build-tools;34.0.0" "ndk;26.1.10909125" "platform-tools"

echo "Android environment setup complete!"
echo "Now you can run: npx tauri android init"
