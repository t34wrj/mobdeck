import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';
import { logger } from './logger';

export interface CrashReport {
  id: string;
  timestamp: number;
  error: {
    name: string;
    message: string;
    stack?: string;
  };
  deviceInfo: {
    platform: string;
    version: string;
    model: string;
    appVersion: string;
    buildNumber: string;
    isEmulator: boolean;
  };
  appState: {
    component?: string;
    route?: string;
    userAgent?: string;
  };
  context?: Record<string, any>;
}

export interface CrashMetrics {
  totalCrashes: number;
  crashFrequency: number;
  lastCrashTime: number;
  sessionsSinceLastCrash: number;
  averageSessionDuration: number;
}

const CRASH_STORAGE_KEY = 'mobdeck_crash_reports';
const CRASH_METRICS_KEY = 'mobdeck_crash_metrics';
const SESSION_START_KEY = 'mobdeck_session_start';
const MAX_STORED_CRASHES = 50;

class CrashReportingService {
  private initialized = false;
  private sessionStartTime: number = 0;
  private currentRoute: string = '';
  private currentComponent: string = '';

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.sessionStartTime = Date.now();
      await AsyncStorage.setItem(SESSION_START_KEY, this.sessionStartTime.toString());
      await this.updateSessionMetrics();
      this.initialized = true;
      logger.info('Crash reporting service initialized');
    } catch (error) {
      logger.error('Failed to initialize crash reporting:', error);
    }
  }

  async reportCrash(error: Error, context?: Record<string, any>): Promise<void> {
    try {
      const crashReport = await this.createCrashReport(error, context);
      await this.storeCrashReport(crashReport);
      await this.updateCrashMetrics();
      logger.error('Crash reported:', crashReport);
    } catch (reportError) {
      logger.error('Failed to report crash:', reportError);
    }
  }

  private async createCrashReport(error: Error, context?: Record<string, any>): Promise<CrashReport> {
    const deviceInfo = await this.getDeviceInfo();
    
    return {
      id: `crash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      deviceInfo,
      appState: {
        component: this.currentComponent,
        route: this.currentRoute,
        userAgent: Platform.OS === 'android' ? 'Android' : 'iOS',
      },
      context,
    };
  }

  private async getDeviceInfo() {
    try {
      const [model, appVersion, buildNumber, isEmulator] = await Promise.all([
        DeviceInfo.getModel(),
        DeviceInfo.getVersion(),
        DeviceInfo.getBuildNumber(),
        DeviceInfo.isEmulator(),
      ]);

      return {
        platform: Platform.OS,
        version: Platform.Version.toString(),
        model,
        appVersion,
        buildNumber,
        isEmulator,
      };
    } catch (error) {
      logger.error('Failed to get device info:', error);
      return {
        platform: Platform.OS,
        version: Platform.Version.toString(),
        model: 'unknown',
        appVersion: 'unknown',
        buildNumber: 'unknown',
        isEmulator: false,
      };
    }
  }

  private async storeCrashReport(crashReport: CrashReport): Promise<void> {
    try {
      const existingReports = await this.getCrashReports();
      const updatedReports = [crashReport, ...existingReports].slice(0, MAX_STORED_CRASHES);
      
      await AsyncStorage.setItem(CRASH_STORAGE_KEY, JSON.stringify(updatedReports));
    } catch (error) {
      logger.error('Failed to store crash report:', error);
    }
  }

  async getCrashReports(): Promise<CrashReport[]> {
    try {
      const storedReports = await AsyncStorage.getItem(CRASH_STORAGE_KEY);
      return storedReports ? JSON.parse(storedReports) : [];
    } catch (error) {
      logger.error('Failed to retrieve crash reports:', error);
      return [];
    }
  }

  async getCrashMetrics(): Promise<CrashMetrics> {
    try {
      const storedMetrics = await AsyncStorage.getItem(CRASH_METRICS_KEY);
      if (storedMetrics) {
        return JSON.parse(storedMetrics);
      }
      
      // Initialize default metrics
      return {
        totalCrashes: 0,
        crashFrequency: 0,
        lastCrashTime: 0,
        sessionsSinceLastCrash: 0,
        averageSessionDuration: 0,
      };
    } catch (error) {
      logger.error('Failed to retrieve crash metrics:', error);
      return {
        totalCrashes: 0,
        crashFrequency: 0,
        lastCrashTime: 0,
        sessionsSinceLastCrash: 0,
        averageSessionDuration: 0,
      };
    }
  }

  private async updateCrashMetrics(): Promise<void> {
    try {
      const currentMetrics = await this.getCrashMetrics();
      const crashes = await this.getCrashReports();
      
      const now = Date.now();
      const sessionDuration = now - this.sessionStartTime;
      
      const updatedMetrics: CrashMetrics = {
        totalCrashes: crashes.length,
        crashFrequency: this.calculateCrashFrequency(crashes),
        lastCrashTime: crashes.length > 0 ? crashes[0].timestamp : 0,
        sessionsSinceLastCrash: crashes.length > 0 ? 1 : currentMetrics.sessionsSinceLastCrash + 1,
        averageSessionDuration: this.calculateAverageSessionDuration(
          currentMetrics.averageSessionDuration,
          sessionDuration
        ),
      };

      await AsyncStorage.setItem(CRASH_METRICS_KEY, JSON.stringify(updatedMetrics));
    } catch (error) {
      logger.error('Failed to update crash metrics:', error);
    }
  }

  private calculateCrashFrequency(crashes: CrashReport[]): number {
    if (crashes.length === 0) return 0;
    
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;
    const recentCrashes = crashes.filter(crash => now - crash.timestamp < dayInMs);
    
    return recentCrashes.length;
  }

  private calculateAverageSessionDuration(currentAverage: number, newDuration: number): number {
    if (currentAverage === 0) return newDuration;
    return (currentAverage + newDuration) / 2;
  }

  private async updateSessionMetrics(): Promise<void> {
    try {
      const currentMetrics = await this.getCrashMetrics();
      const sessionDuration = Date.now() - this.sessionStartTime;
      
      const updatedMetrics: CrashMetrics = {
        ...currentMetrics,
        sessionsSinceLastCrash: currentMetrics.sessionsSinceLastCrash + 1,
        averageSessionDuration: this.calculateAverageSessionDuration(
          currentMetrics.averageSessionDuration,
          sessionDuration
        ),
      };

      await AsyncStorage.setItem(CRASH_METRICS_KEY, JSON.stringify(updatedMetrics));
    } catch (error) {
      logger.error('Failed to update session metrics:', error);
    }
  }

  async clearCrashReports(): Promise<void> {
    try {
      await AsyncStorage.removeItem(CRASH_STORAGE_KEY);
      await AsyncStorage.removeItem(CRASH_METRICS_KEY);
      logger.info('Crash reports cleared');
    } catch (error) {
      logger.error('Failed to clear crash reports:', error);
    }
  }

  setCurrentRoute(route: string): void {
    this.currentRoute = route;
  }

  setCurrentComponent(component: string): void {
    this.currentComponent = component;
  }

  async exportCrashData(): Promise<string> {
    try {
      const reports = await this.getCrashReports();
      const metrics = await this.getCrashMetrics();
      
      return JSON.stringify({
        reports,
        metrics,
        exportTimestamp: Date.now(),
      }, null, 2);
    } catch (error) {
      logger.error('Failed to export crash data:', error);
      return JSON.stringify({ error: 'Failed to export crash data' });
    }
  }
}

export const crashReporting = new CrashReportingService();

export const reportCrash = (error: Error, context?: Record<string, any>) => {
  crashReporting.reportCrash(error, context);
};

export const initializeCrashReporting = () => {
  crashReporting.initialize();
};

export const setCurrentRoute = (route: string) => {
  crashReporting.setCurrentRoute(route);
};

export const setCurrentComponent = (component: string) => {
  crashReporting.setCurrentComponent(component);
};