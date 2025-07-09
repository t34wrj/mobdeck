#!/bin/bash

# Setup script for Android device performance testing
# This script checks for device availability and prepares the testing environment

set -e

echo "🔍 Checking ADB and device availability..."

# Check if ADB is available
if ! command -v adb &> /dev/null; then
    echo "❌ ADB not found. Please install Android SDK and add ADB to your PATH."
    exit 1
fi

# Check for connected devices
DEVICES=$(adb devices | grep -v "List of devices attached" | grep -v "^$" | wc -l)

if [ "$DEVICES" -eq 0 ]; then
    echo "❌ No Android devices or emulators found."
    echo "Please connect an Android device or start an emulator."
    echo ""
    echo "To start an emulator:"
    echo "  emulator -avd <avd_name>"
    echo ""
    echo "To check connected devices:"
    echo "  adb devices"
    exit 1
fi

echo "✅ Found $DEVICES Android device(s)/emulator(s):"
adb devices

# Check if the app is installed
APP_PACKAGE="com.mobdeck"
echo ""
echo "🔍 Checking if Mobdeck app is installed..."

if adb shell pm list packages | grep -q "$APP_PACKAGE"; then
    echo "✅ Mobdeck app is installed"
else
    echo "❌ Mobdeck app is not installed."
    echo "Please install the app first:"
    echo "  npm run android"
    exit 1
fi

# Check if app can be launched
echo ""
echo "🚀 Testing app launch..."

# Kill any existing app instances
adb shell am force-stop "$APP_PACKAGE" 2>/dev/null || true

# Launch the app
if adb shell am start -n "$APP_PACKAGE/.MainActivity" >/dev/null 2>&1; then
    echo "✅ App launched successfully"
    
    # Wait for app to start
    sleep 3
    
    # Check if app is running
    if adb shell "ps | grep $APP_PACKAGE" >/dev/null 2>&1; then
        echo "✅ App is running"
    else
        echo "❌ App failed to start properly"
        exit 1
    fi
else
    echo "❌ Failed to launch app"
    exit 1
fi

# Test basic ADB commands
echo ""
echo "🧪 Testing ADB commands..."

# Test input commands
echo "Testing touch input..."
adb shell input tap 100 100 >/dev/null 2>&1 && echo "✅ Touch input working" || echo "❌ Touch input failed"

# Test text input
echo "Testing text input..."
adb shell input text "test" >/dev/null 2>&1 && echo "✅ Text input working" || echo "❌ Text input failed"

# Test key events
echo "Testing key events..."
adb shell input keyevent 4 >/dev/null 2>&1 && echo "✅ Key events working" || echo "❌ Key events failed"

# Test dumpsys commands
echo "Testing performance monitoring..."
adb shell dumpsys cpuinfo | head -n 1 >/dev/null 2>&1 && echo "✅ CPU monitoring working" || echo "❌ CPU monitoring failed"
adb shell dumpsys meminfo | head -n 1 >/dev/null 2>&1 && echo "✅ Memory monitoring working" || echo "❌ Memory monitoring failed"

echo ""
echo "✅ Device setup complete! Ready for performance testing."
echo ""
echo "To run device performance tests:"
echo "  RUN_DEVICE_TESTS=true npm run test:performance:device"
echo "  RUN_DEVICE_TESTS=true npm run test:performance:network-device"
echo ""
echo "Device Information:"
echo "  Device ID: $(adb get-serialno)"
echo "  Android Version: $(adb shell getprop ro.build.version.release)"
echo "  API Level: $(adb shell getprop ro.build.version.sdk)"
echo "  Model: $(adb shell getprop ro.product.model)"
echo "  Architecture: $(adb shell getprop ro.product.cpu.abi)"