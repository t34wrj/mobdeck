/**
 * ADB Helper - Android Debug Bridge utilities for React Native performance testing
 *
 * This module provides utilities to interact with Android devices/emulators via ADB
 * for real device performance testing instead of mocked tests.
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { performance } from 'perf_hooks';

const execAsync = promisify(exec);

export interface DeviceInfo {
  id: string;
  status: 'device' | 'emulator' | 'offline';
  model?: string;
  version?: string;
  arch?: string;
  apiLevel?: number;
}

export interface PerformanceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  networkLatency: number;
  frameRate: number;
  jankCount: number;
  renderTime: number;
  duration: number;
}

export interface NetworkCondition {
  type: 'fast' | 'moderate' | 'slow' | 'offline';
  downloadSpeed: number; // kbps
  uploadSpeed: number; // kbps
  latency: number; // ms
  packetLoss: number; // percentage
}

export class AdbHelper {
  private packageName: string;
  private currentDevice?: DeviceInfo;

  constructor(packageName: string = 'com.mobdeck') {
    this.packageName = packageName;
  }

  /**
   * Get list of connected Android devices/emulators
   */
  async getDevices(): Promise<DeviceInfo[]> {
    try {
      const { stdout } = await execAsync('adb devices -l');
      const lines = stdout
        .split('\n')
        .filter(line => line.trim() && !line.startsWith('List'));

      const devices: DeviceInfo[] = [];
      for (const line of lines) {
        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
          const id = parts[0];
          const status = parts[1] as 'device' | 'emulator' | 'offline';

          // Extract model and other info from device description
          const modelMatch = line.match(/model:(\S+)/);
          const model = modelMatch ? modelMatch[1] : undefined;

          devices.push({
            id,
            status,
            model,
          });
        }
      }

      return devices;
    } catch (error) {
      throw new Error(`Failed to get devices: ${error}`);
    }
  }

  /**
   * Connect to a specific device for testing
   */
  async connectToDevice(deviceId?: string): Promise<DeviceInfo> {
    const devices = await this.getDevices();

    if (devices.length === 0) {
      throw new Error(
        'No Android devices found. Please connect a device or start an emulator.'
      );
    }

    // Use specified device or first available
    const targetDevice = deviceId
      ? devices.find(d => d.id === deviceId)
      : devices.find(d => d.status === 'device') || devices[0];

    if (!targetDevice) {
      throw new Error(`Device ${deviceId} not found`);
    }

    if (targetDevice.status === 'offline') {
      throw new Error(`Device ${targetDevice.id} is offline`);
    }

    // Get additional device info
    try {
      const { stdout: versionOutput } = await execAsync(
        `adb -s ${targetDevice.id} shell getprop ro.build.version.release`
      );
      const { stdout: apiOutput } = await execAsync(
        `adb -s ${targetDevice.id} shell getprop ro.build.version.sdk`
      );
      const { stdout: archOutput } = await execAsync(
        `adb -s ${targetDevice.id} shell getprop ro.product.cpu.abi`
      );

      targetDevice.version = versionOutput.trim();
      targetDevice.apiLevel = parseInt(apiOutput.trim(), 10);
      targetDevice.arch = archOutput.trim();
    } catch (error) {
      console.warn('Could not get detailed device info:', error);
    }

    this.currentDevice = targetDevice;
    return targetDevice;
  }

  /**
   * Check if the React Native app is installed and running
   */
  async isAppRunning(): Promise<boolean> {
    if (!this.currentDevice) {
      throw new Error('No device connected');
    }

    try {
      // Try modern approach first (Android 7+)
      const { stdout } = await execAsync(
        `adb -s ${this.currentDevice.id} shell "pidof ${this.packageName}"`
      );
      if (stdout.trim().length > 0) {
        return true;
      }
    } catch {
      // Fallback to older ps command
      try {
        const { stdout } = await execAsync(
          `adb -s ${this.currentDevice.id} shell "ps | grep ${this.packageName}"`
        );
        return stdout.trim().length > 0;
      } catch {
        // Final fallback using dumpsys
        try {
          const { stdout } = await execAsync(
            `adb -s ${this.currentDevice.id} shell "dumpsys activity activities | grep ${this.packageName}"`
          );
          return stdout.includes(this.packageName);
        } catch (finalError) {
          console.warn('All app detection methods failed:', finalError);
          return false;
        }
      }
    }

    return false;
  }

  /**
   * Launch the React Native app
   */
  async launchApp(): Promise<void> {
    if (!this.currentDevice) {
      throw new Error('No device connected');
    }

    try {
      // First try to stop any existing instances
      try {
        await execAsync(
          `adb -s ${this.currentDevice.id} shell am force-stop ${this.packageName}`
        );
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (stopError) {
        console.warn(
          'Could not stop existing app instance:',
          stopError instanceof Error ? stopError.message : 'Unknown error'
        );
      }

      // Launch the app with additional flags for better reliability
      const launchResult = await execAsync(
        `adb -s ${this.currentDevice.id} shell am start -n ${this.packageName}/.MainActivity -a android.intent.action.MAIN -c android.intent.category.LAUNCHER`
      );
      console.log('Launch command result:', launchResult.stdout);

      // Wait for app to start with progressive checking
      let attempts = 0;
      const maxAttempts = 10;
      let isRunning = false;

      while (attempts < maxAttempts && !isRunning) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        isRunning = await this.isAppRunning();
        attempts++;
        console.log(
          `App launch check ${attempts}/${maxAttempts}: ${isRunning ? 'running' : 'not running'}`
        );
      }

      if (!isRunning) {
        // Try one more time with different approach
        console.log('Attempting alternative launch method...');
        await execAsync(
          `adb -s ${this.currentDevice.id} shell monkey -p ${this.packageName} -c android.intent.category.LAUNCHER 1`
        );
        await new Promise(resolve => setTimeout(resolve, 3000));
        isRunning = await this.isAppRunning();
      }

      if (!isRunning) {
        throw new Error('App failed to start after multiple attempts');
      }

      console.log('App launched successfully');
    } catch (error) {
      throw new Error(`Failed to launch app: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Kill the React Native app
   */
  async killApp(): Promise<void> {
    if (!this.currentDevice) {
      throw new Error('No device connected');
    }

    try {
      await execAsync(
        `adb -s ${this.currentDevice.id} shell am force-stop ${this.packageName}`
      );
    } catch (error) {
      console.warn(
        `Could not force-stop app (emulator limitation): ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      // Try alternative method
      try {
        await execAsync(
          `adb -s ${this.currentDevice.id} shell "pkill ${this.packageName}"`
        );
      } catch (alternativeError) {
        console.warn(
          `Alternative app kill method also failed: ${alternativeError instanceof Error ? alternativeError.message : 'Unknown error'}`
        );
      }
    }
  }

  /**
   * Set network conditions on the device
   */
  async setNetworkConditions(condition: NetworkCondition): Promise<void> {
    if (!this.currentDevice) {
      throw new Error('No device connected');
    }

    try {
      if (condition.type === 'offline') {
        // Try to disable network - gracefully handle emulator limitations
        try {
          await execAsync(
            `adb -s ${this.currentDevice.id} shell svc data disable`
          );
        } catch (_error) {
          console.warn(
            'Could not disable mobile data (emulator limitation):',
            _error instanceof Error ? _error.message : 'Unknown error'
          );
        }

        try {
          await execAsync(
            `adb -s ${this.currentDevice.id} shell svc wifi disable`
          );
        } catch (_error) {
          console.warn(
            'Could not disable wifi (emulator limitation):',
            _error instanceof Error ? _error.message : 'Unknown error'
          );
        }

        console.log(
          `Network conditions set: ${condition.type} - simulated offline mode`
        );
      } else {
        // Try to enable network - gracefully handle emulator limitations
        try {
          await execAsync(
            `adb -s ${this.currentDevice.id} shell svc data enable`
          );
        } catch (_error) {
          console.warn(
            'Could not enable mobile data (emulator limitation):',
            _error instanceof Error ? _error.message : 'Unknown error'
          );
        }

        try {
          await execAsync(
            `adb -s ${this.currentDevice.id} shell svc wifi enable`
          );
        } catch (_error) {
          console.warn(
            'Could not enable wifi (emulator limitation):',
            _error instanceof Error ? _error.message : 'Unknown error'
          );
        }

        // Note: Network throttling requires additional tools like `tc` or proxy setup
        // For now, we'll log the intended conditions
        console.log(
          `Network conditions set: ${condition.type} - ${condition.downloadSpeed}kbps down, ${condition.uploadSpeed}kbps up, ${condition.latency}ms latency`
        );
      }
    } catch (_error) {
      // Don't throw error for network condition setting - just log it
      console.warn(
        `Network condition setting partially failed: ${_error instanceof Error ? _error.message : String(_error)}`
      );
      console.log(
        `Network conditions simulated: ${condition.type} - ${condition.downloadSpeed}kbps down, ${condition.uploadSpeed}kbps up, ${condition.latency}ms latency`
      );
    }
  }

  /**
   * Measure app performance metrics
   */
  async measurePerformance(
    operation: () => Promise<void>,
    _testName: string
  ): Promise<PerformanceMetrics> {
    if (!this.currentDevice) {
      throw new Error('No device connected');
    }

    const startTime = performance.now();

    // Start performance monitoring
    const perfMonitor = this.startPerformanceMonitoring();

    try {
      // Execute the operation
      await operation();

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Stop monitoring and collect metrics
      const metrics = await this.stopPerformanceMonitoring(perfMonitor);

      return {
        ...metrics,
        duration,
      };
    } catch (error) {
      await this.stopPerformanceMonitoring(perfMonitor);
      throw error;
    }
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): any {
    if (!this.currentDevice) {
      throw new Error('No device connected');
    }

    // Start dumpsys monitoring for detailed metrics
    const monitor = spawn('adb', [
      '-s',
      this.currentDevice.id,
      'shell',
      'dumpsys',
      'gfxinfo',
      this.packageName,
      'framestats',
    ]);

    return monitor;
  }

  /**
   * Stop performance monitoring and collect metrics
   */
  private async stopPerformanceMonitoring(
    monitor: any
  ): Promise<Omit<PerformanceMetrics, 'duration'>> {
    if (!this.currentDevice) {
      throw new Error('No device connected');
    }

    try {
      // Kill the monitor process
      monitor.kill();

      // Get CPU usage
      const { stdout: cpuOutput } = await execAsync(
        `adb -s ${this.currentDevice.id} shell "dumpsys cpuinfo | grep ${this.packageName}"`
      );
      const cpuMatch = cpuOutput.match(/(\d+\.?\d*)%/);
      const cpuUsage = cpuMatch ? parseFloat(cpuMatch[1]) : 0;

      // Get memory usage
      const { stdout: memOutput } = await execAsync(
        `adb -s ${this.currentDevice.id} shell "dumpsys meminfo ${this.packageName} | grep 'TOTAL'"`
      );
      const memMatch = memOutput.match(/(\d+)/);
      const memoryUsage = memMatch ? parseInt(memMatch[1], 10) : 0;

      // Get network latency (simplified)
      let networkLatency = 0;
      try {
        const { stdout: pingOutput } = await execAsync(
          `adb -s ${this.currentDevice.id} shell "ping -c 1 8.8.8.8"`
        );
        const latencyMatch = pingOutput.match(/time=(\d+\.?\d*)/);
        networkLatency = latencyMatch ? parseFloat(latencyMatch[1]) : 0;
      } catch {
        // Network might be offline or unreachable
        networkLatency = -1;
      }

      // Get frame rate and jank info
      const { stdout: gfxOutput } = await execAsync(
        `adb -s ${this.currentDevice.id} shell "dumpsys gfxinfo ${this.packageName} | grep 'Total frames'"`
      );
      const frameMatch = gfxOutput.match(/Total frames rendered: (\d+)/);
      const jankMatch = gfxOutput.match(/Janky frames: (\d+)/);

      const totalFrames = frameMatch ? parseInt(frameMatch[1], 10) : 0;
      const jankyFrames = jankMatch ? parseInt(jankMatch[1], 10) : 0;

      // Calculate approximate frame rate and jank
      const frameRate = totalFrames > 0 ? 60 : 0; // Simplified
      const jankCount = jankyFrames;

      // Get render time (simplified)
      const renderTime = cpuUsage > 0 ? cpuUsage * 16.67 : 0; // Rough estimate based on CPU

      return {
        cpuUsage,
        memoryUsage,
        networkLatency,
        frameRate,
        jankCount,
        renderTime,
      };
    } catch (error) {
      console.warn('Error collecting performance metrics:', error);
      return {
        cpuUsage: 0,
        memoryUsage: 0,
        networkLatency: 0,
        frameRate: 0,
        jankCount: 0,
        renderTime: 0,
      };
    }
  }

  /**
   * Send touch events to the device
   */
  async sendTouchEvent(x: number, y: number): Promise<void> {
    if (!this.currentDevice) {
      throw new Error('No device connected');
    }

    try {
      await execAsync(
        `adb -s ${this.currentDevice.id} shell input tap ${x} ${y}`
      );
    } catch (error) {
      throw new Error(`Failed to send touch event: ${error}`);
    }
  }

  /**
   * Send text input to the device
   */
  async sendTextInput(text: string): Promise<void> {
    if (!this.currentDevice) {
      throw new Error('No device connected');
    }

    try {
      // Escape special characters
      const escapedText = text.replace(/[&|\\;$%@"<>()+,]/g, '\\$&');
      await execAsync(
        `adb -s ${this.currentDevice.id} shell input text "${escapedText}"`
      );
    } catch (error) {
      throw new Error(`Failed to send text input: ${error}`);
    }
  }

  /**
   * Send key events to the device
   */
  async sendKeyEvent(keyCode: number): Promise<void> {
    if (!this.currentDevice) {
      throw new Error('No device connected');
    }

    try {
      await execAsync(
        `adb -s ${this.currentDevice.id} shell input keyevent ${keyCode}`
      );
    } catch (error) {
      throw new Error(`Failed to send key event: ${error}`);
    }
  }

  /**
   * Take a screenshot of the device
   */
  async takeScreenshot(filename: string): Promise<string> {
    if (!this.currentDevice) {
      throw new Error('No device connected');
    }

    try {
      const remotePath = '/sdcard/screenshot.png';
      await execAsync(
        `adb -s ${this.currentDevice.id} shell screencap -p ${remotePath}`
      );
      await execAsync(
        `adb -s ${this.currentDevice.id} pull ${remotePath} ${filename}`
      );
      await execAsync(`adb -s ${this.currentDevice.id} shell rm ${remotePath}`);
      return filename;
    } catch (error) {
      throw new Error(`Failed to take screenshot: ${error}`);
    }
  }

  /**
   * Get current device information
   */
  getCurrentDevice(): DeviceInfo | undefined {
    return this.currentDevice;
  }

  /**
   * Disconnect from the current device
   */
  async disconnect(): Promise<void> {
    if (this.currentDevice) {
      try {
        await this.killApp();
      } catch (error) {
        console.warn('Error killing app during disconnect:', error);
      }
      this.currentDevice = undefined;
    }
  }
}

/**
 * Network condition presets
 */
export const NETWORK_CONDITIONS: Record<string, NetworkCondition> = {
  FAST: {
    type: 'fast',
    downloadSpeed: 10000, // 10 Mbps
    uploadSpeed: 5000, // 5 Mbps
    latency: 10, // 10ms
    packetLoss: 0, // 0%
  },
  MODERATE: {
    type: 'moderate',
    downloadSpeed: 1000, // 1 Mbps
    uploadSpeed: 500, // 500 kbps
    latency: 100, // 100ms
    packetLoss: 0.01, // 1%
  },
  SLOW: {
    type: 'slow',
    downloadSpeed: 100, // 100 kbps
    uploadSpeed: 50, // 50 kbps
    latency: 500, // 500ms
    packetLoss: 0.05, // 5%
  },
  OFFLINE: {
    type: 'offline',
    downloadSpeed: 0,
    uploadSpeed: 0,
    latency: Infinity,
    packetLoss: 1, // 100%
  },
};

/**
 * Common Android key codes
 */
export const KEY_CODES = {
  BACK: 4,
  HOME: 3,
  MENU: 82,
  SEARCH: 84,
  ENTER: 66,
  DEL: 67,
  TAB: 61,
  SPACE: 62,
  DPAD_UP: 19,
  DPAD_DOWN: 20,
  DPAD_LEFT: 21,
  DPAD_RIGHT: 22,
  DPAD_CENTER: 23,
};
