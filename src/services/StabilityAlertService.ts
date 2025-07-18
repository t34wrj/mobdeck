import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';
import { stabilityMonitoring, StabilityStatus, StabilityThresholds } from '../utils/stabilityMonitoring';
import { errorTracking } from './errorTracking';

export interface AlertConfig {
  enabled: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  throttleMs: number;
  maxAlertsPerHour: number;
  developerOnly: boolean;
}

export interface StabilityAlert {
  id: string;
  type: 'crash_spike' | 'error_rate' | 'performance_degradation' | 'memory_leak' | 'stability_decline';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  data: Record<string, any>;
  timestamp: number;
  acknowledged: boolean;
  dismissed: boolean;
}

export interface AlertRule {
  id: string;
  name: string;
  type: StabilityAlert['type'];
  condition: (status: StabilityStatus, thresholds: StabilityThresholds) => boolean;
  message: (data: Record<string, any>) => string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  throttleMs: number;
  enabled: boolean;
}

const ALERT_CONFIG_KEY = 'mobdeck_stability_alert_config';
const ALERT_HISTORY_KEY = 'mobdeck_stability_alert_history';
const ALERT_THROTTLE_KEY = 'mobdeck_stability_alert_throttle';
const MAX_ALERT_HISTORY = 100;
const DEFAULT_THROTTLE_MS = 300000; // 5 minutes

class StabilityAlertService {
  private initialized = false;
  private alertConfig: AlertConfig;
  private alertHistory: StabilityAlert[] = [];
  private alertThrottleMap = new Map<string, number>();
  private checkInterval: NodeJS.Timeout | null = null;
  private lastStatusCheck: StabilityStatus | null = null;
  private appState: AppStateStatus = 'active';

  private readonly defaultConfig: AlertConfig = {
    enabled: true,
    severity: 'medium',
    throttleMs: DEFAULT_THROTTLE_MS,
    maxAlertsPerHour: 10,
    developerOnly: __DEV__,
  };

  private readonly alertRules: AlertRule[] = [
    {
      id: 'crash_spike',
      name: 'Crash Spike Detected',
      type: 'crash_spike',
      condition: (status, thresholds) => {
        const crashMetrics = status as any;
        return crashMetrics.crashFrequency > thresholds.maxCrashFrequency;
      },
      message: (data) => `Crash frequency (${data.crashFrequency}) exceeds threshold (${data.threshold})`,
      severity: 'critical',
      throttleMs: 600000, // 10 minutes
      enabled: true,
    },
    {
      id: 'error_rate_high',
      name: 'High Error Rate',
      type: 'error_rate',
      condition: (status, thresholds) => {
        const errorData = status as any;
        return errorData.errorRate > thresholds.maxErrorRate;
      },
      message: (data) => `Error rate (${(data.errorRate * 100).toFixed(1)}%) exceeds threshold (${(data.threshold * 100).toFixed(1)}%)`,
      severity: 'high',
      throttleMs: 300000, // 5 minutes
      enabled: true,
    },
    {
      id: 'performance_degradation',
      name: 'Performance Degradation',
      type: 'performance_degradation',
      condition: (status, thresholds) => {
        const perfData = status as any;
        return perfData.performanceScore < thresholds.minPerformanceScore;
      },
      message: (data) => `Performance score (${data.performanceScore.toFixed(1)}) below threshold (${data.threshold})`,
      severity: 'medium',
      throttleMs: 900000, // 15 minutes
      enabled: true,
    },
    {
      id: 'stability_decline',
      name: 'Stability Decline',
      type: 'stability_decline',
      condition: (status, thresholds) => {
        const stabilityData = status as any;
        return stabilityData.stabilityScore < thresholds.minStabilityScore;
      },
      message: (data) => `Stability score (${data.stabilityScore.toFixed(1)}) below threshold (${data.threshold})`,
      severity: 'medium',
      throttleMs: 900000, // 15 minutes
      enabled: true,
    },
    {
      id: 'memory_leak',
      name: 'Memory Leak Detected',
      type: 'memory_leak',
      condition: (status, thresholds) => {
        const memoryData = status as any;
        return memoryData.memoryUsage > thresholds.maxMemoryUsage;
      },
      message: (data) => `Memory usage (${this.formatBytes(data.memoryUsage)}) exceeds threshold (${this.formatBytes(data.threshold)})`,
      severity: 'high',
      throttleMs: 300000, // 5 minutes
      enabled: true,
    },
  ];

  constructor() {
    this.alertConfig = this.defaultConfig;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.loadAlertConfig();
      await this.loadAlertHistory();
      await this.loadAlertThrottleMap();
      
      this.setupAppStateHandling();
      this.startAlertChecking();
      
      this.initialized = true;
      logger.info('Stability alert service initialized');
    } catch (error) {
      logger.error('Failed to initialize stability alert service:', error);
    }
  }

  private setupAppStateHandling(): void {
    AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (this.appState === 'background' && nextAppState === 'active') {
        this.startAlertChecking();
      } else if (this.appState === 'active' && nextAppState === 'background') {
        this.stopAlertChecking();
      }
      this.appState = nextAppState;
    });
  }

  private startAlertChecking(): void {
    if (this.checkInterval) return;

    this.checkInterval = setInterval(() => {
      this.checkStabilityAlerts();
    }, 60000); // Check every minute
  }

  private stopAlertChecking(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  private async checkStabilityAlerts(): Promise<void> {
    if (!this.alertConfig.enabled) return;

    try {
      const [status, metrics, thresholds] = await Promise.all([
        stabilityMonitoring.getStabilityStatus(),
        stabilityMonitoring.getStabilityMetrics(),
        stabilityMonitoring.getStabilityThresholds(),
      ]);

      if (!status || !metrics || !thresholds) return;

      // Check each alert rule
      for (const rule of this.alertRules) {
        if (!rule.enabled) continue;

        const ruleData = {
          ...metrics,
          ...status,
        };

        if (rule.condition(status, thresholds)) {
          await this.triggerAlert(rule, ruleData, thresholds);
        }
      }

      this.lastStatusCheck = status;
    } catch (error) {
      logger.error('Failed to check stability alerts:', error);
    }
  }

  private async triggerAlert(rule: AlertRule, data: Record<string, any>, thresholds: StabilityThresholds): Promise<void> {
    const now = Date.now();
    const throttleKey = `${rule.id}_${rule.type}`;
    const lastTriggered = this.alertThrottleMap.get(throttleKey) || 0;

    // Check throttle
    if (now - lastTriggered < rule.throttleMs) {
      return;
    }

    // Check hourly rate limit
    const hourlyAlerts = this.alertHistory.filter(
      alert => now - alert.timestamp < 3600000 && alert.type === rule.type
    );
    if (hourlyAlerts.length >= this.alertConfig.maxAlertsPerHour) {
      logger.warn(`Alert rate limit exceeded for ${rule.type}`);
      return;
    }

    // Create alert
    const alert: StabilityAlert = {
      id: `alert_${now}_${Math.random().toString(36).substr(2, 9)}`,
      type: rule.type,
      severity: rule.severity,
      message: rule.message({ ...data, threshold: this.getThresholdValue(rule.type, thresholds) }),
      data: {
        ...data,
        rule: rule.name,
        threshold: this.getThresholdValue(rule.type, thresholds),
      },
      timestamp: now,
      acknowledged: false,
      dismissed: false,
    };

    // Store alert
    this.alertHistory.unshift(alert);
    if (this.alertHistory.length > MAX_ALERT_HISTORY) {
      this.alertHistory = this.alertHistory.slice(0, MAX_ALERT_HISTORY);
    }

    // Update throttle
    this.alertThrottleMap.set(throttleKey, now);

    // Save to storage
    await this.saveAlertHistory();
    await this.saveAlertThrottleMap();

    // Log alert
    logger.warn(`Stability alert triggered: ${rule.name}`, alert);

    // Handle alert based on configuration
    await this.handleAlert(alert);
  }

  private async handleAlert(alert: StabilityAlert): Promise<void> {
    // Developer-only alerts
    if (this.alertConfig.developerOnly && !__DEV__) {
      return;
    }

    // Log to console in development
    if (__DEV__) {
      console.warn(`🚨 STABILITY ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`);
      console.warn('Alert data:', alert.data);
    }

    // Track as error for severe alerts
    if (alert.severity === 'critical' || alert.severity === 'high') {
      errorTracking.trackError(
        new Error(`Stability Alert: ${alert.message}`),
        'other',
        {
          alertId: alert.id,
          alertType: alert.type,
          alertSeverity: alert.severity,
          alertData: alert.data,
        }
      );
    }

    // Could add push notifications, email alerts, etc. here
  }

  private getThresholdValue(alertType: StabilityAlert['type'], thresholds: StabilityThresholds): number {
    switch (alertType) {
      case 'crash_spike':
        return thresholds.maxCrashFrequency;
      case 'error_rate':
        return thresholds.maxErrorRate;
      case 'performance_degradation':
        return thresholds.minPerformanceScore;
      case 'stability_decline':
        return thresholds.minStabilityScore;
      case 'memory_leak':
        return thresholds.maxMemoryUsage;
      default:
        return 0;
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  private async loadAlertConfig(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(ALERT_CONFIG_KEY);
      if (stored) {
        this.alertConfig = { ...this.defaultConfig, ...JSON.parse(stored) };
      }
    } catch (error) {
      logger.error('Failed to load alert config:', error);
    }
  }

  private async saveAlertConfig(): Promise<void> {
    try {
      await AsyncStorage.setItem(ALERT_CONFIG_KEY, JSON.stringify(this.alertConfig));
    } catch (error) {
      logger.error('Failed to save alert config:', error);
    }
  }

  private async loadAlertHistory(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(ALERT_HISTORY_KEY);
      if (stored) {
        this.alertHistory = JSON.parse(stored);
      }
    } catch (error) {
      logger.error('Failed to load alert history:', error);
    }
  }

  private async saveAlertHistory(): Promise<void> {
    try {
      await AsyncStorage.setItem(ALERT_HISTORY_KEY, JSON.stringify(this.alertHistory));
    } catch (error) {
      logger.error('Failed to save alert history:', error);
    }
  }

  private async loadAlertThrottleMap(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(ALERT_THROTTLE_KEY);
      if (stored) {
        const throttleData = JSON.parse(stored);
        this.alertThrottleMap = new Map(Object.entries(throttleData));
      }
    } catch (error) {
      logger.error('Failed to load alert throttle map:', error);
    }
  }

  private async saveAlertThrottleMap(): Promise<void> {
    try {
      const throttleData = Object.fromEntries(this.alertThrottleMap);
      await AsyncStorage.setItem(ALERT_THROTTLE_KEY, JSON.stringify(throttleData));
    } catch (error) {
      logger.error('Failed to save alert throttle map:', error);
    }
  }

  // Public API methods
  async getAlertConfig(): Promise<AlertConfig> {
    return { ...this.alertConfig };
  }

  async updateAlertConfig(config: Partial<AlertConfig>): Promise<void> {
    this.alertConfig = { ...this.alertConfig, ...config };
    await this.saveAlertConfig();
    logger.info('Alert config updated:', config);
  }

  async getAlertHistory(): Promise<StabilityAlert[]> {
    return [...this.alertHistory];
  }

  async getActiveAlerts(): Promise<StabilityAlert[]> {
    return this.alertHistory.filter(alert => !alert.dismissed && !alert.acknowledged);
  }

  async acknowledgeAlert(alertId: string): Promise<void> {
    const alert = this.alertHistory.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      await this.saveAlertHistory();
      logger.info(`Alert acknowledged: ${alertId}`);
    }
  }

  async dismissAlert(alertId: string): Promise<void> {
    const alert = this.alertHistory.find(a => a.id === alertId);
    if (alert) {
      alert.dismissed = true;
      await this.saveAlertHistory();
      logger.info(`Alert dismissed: ${alertId}`);
    }
  }

  async clearAlertHistory(): Promise<void> {
    this.alertHistory = [];
    await this.saveAlertHistory();
    logger.info('Alert history cleared');
  }

  async getAlertRules(): Promise<AlertRule[]> {
    return [...this.alertRules];
  }

  async updateAlertRule(ruleId: string, updates: Partial<AlertRule>): Promise<void> {
    const rule = this.alertRules.find(r => r.id === ruleId);
    if (rule) {
      Object.assign(rule, updates);
      logger.info(`Alert rule updated: ${ruleId}`, updates);
    }
  }

  async testAlert(type: StabilityAlert['type']): Promise<void> {
    const rule = this.alertRules.find(r => r.type === type);
    if (rule) {
      const testAlert: StabilityAlert = {
        id: `test_${Date.now()}`,
        type,
        severity: rule.severity,
        message: `Test alert: ${rule.name}`,
        data: { test: true },
        timestamp: Date.now(),
        acknowledged: false,
        dismissed: false,
      };

      await this.handleAlert(testAlert);
      logger.info(`Test alert triggered: ${type}`);
    }
  }

  async exportAlertData(): Promise<string> {
    try {
      const data = {
        config: this.alertConfig,
        history: this.alertHistory,
        rules: this.alertRules,
        throttleMap: Object.fromEntries(this.alertThrottleMap),
        exportTimestamp: Date.now(),
      };

      return JSON.stringify(data, null, 2);
    } catch (error) {
      logger.error('Failed to export alert data:', error);
      return JSON.stringify({ error: 'Failed to export alert data' });
    }
  }

  async shutdown(): Promise<void> {
    this.stopAlertChecking();
    await this.saveAlertHistory();
    await this.saveAlertThrottleMap();
    this.initialized = false;
    logger.info('Stability alert service shutdown');
  }
}

export const stabilityAlertService = new StabilityAlertService();

export const initializeStabilityAlerts = () => {
  stabilityAlertService.initialize();
};

export const getStabilityAlerts = () => {
  return stabilityAlertService.getAlertHistory();
};

export const acknowledgeStabilityAlert = (alertId: string) => {
  return stabilityAlertService.acknowledgeAlert(alertId);
};

export const dismissStabilityAlert = (alertId: string) => {
  return stabilityAlertService.dismissAlert(alertId);
};