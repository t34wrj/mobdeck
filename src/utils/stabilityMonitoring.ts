import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from './logger';
import { crashReporting } from './crashReporting';
import { errorTracking } from '../services/errorTracking';

export interface PerformanceMetrics {
  memoryUsage: number;
  cpuUsage: number;
  networkLatency: number;
  renderTime: number;
  jsHeapSize: number;
  batteryLevel: number;
}

export interface StabilityMetrics {
  uptime: number;
  sessionDuration: number;
  crashFrequency: number;
  errorRate: number;
  performanceScore: number;
  stabilityScore: number;
  lastUpdated: number;
}

export interface StabilityThresholds {
  maxCrashFrequency: number;
  maxErrorRate: number;
  minPerformanceScore: number;
  minStabilityScore: number;
  maxMemoryUsage: number;
  maxRenderTime: number;
}

export interface StabilityStatus {
  isHealthy: boolean;
  issues: string[];
  recommendations: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

const STABILITY_METRICS_KEY = 'mobdeck_stability_metrics';
const STABILITY_THRESHOLDS_KEY = 'mobdeck_stability_thresholds';
const PERFORMANCE_HISTORY_KEY = 'mobdeck_performance_history';
const SESSION_TRACKING_KEY = 'mobdeck_session_tracking';
const MAX_HISTORY_ENTRIES = 100;

class StabilityMonitoringService {
  private initialized = false;
  private startTime: number = 0;
  private sessionStartTime: number = 0;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private performanceInterval: NodeJS.Timeout | null = null;
  private currentAppState: AppStateStatus = 'active';
  private performanceHistory: PerformanceMetrics[] = [];
  private isMonitoring = false;

  private readonly defaultThresholds: StabilityThresholds = {
    maxCrashFrequency: 5,
    maxErrorRate: 0.1,
    minPerformanceScore: 70,
    minStabilityScore: 80,
    maxMemoryUsage: 100 * 1024 * 1024, // 100MB
    maxRenderTime: 16.67, // 60fps target
  };

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.startTime = Date.now();
      this.sessionStartTime = this.startTime;
      
      await this.loadPerformanceHistory();
      await this.setupAppStateHandling();
      
      this.startMonitoring();
      this.initialized = true;
      
      logger.info('Stability monitoring service initialized');
    } catch (error) {
      logger.error('Failed to initialize stability monitoring:', error);
    }
  }

  private async setupAppStateHandling(): Promise<void> {
    AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (this.currentAppState === 'background' && nextAppState === 'active') {
        this.onAppForeground();
      } else if (this.currentAppState === 'active' && nextAppState === 'background') {
        this.onAppBackground();
      }
      this.currentAppState = nextAppState;
    });
  }

  private onAppForeground(): void {
    this.sessionStartTime = Date.now();
    this.startMonitoring();
    logger.info('App entered foreground - monitoring resumed');
  }

  private onAppBackground(): void {
    this.stopMonitoring();
    this.saveSessionData();
    logger.info('App entered background - monitoring paused');
  }

  private startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    
    // Monitor stability metrics every 30 seconds
    this.monitoringInterval = setInterval(() => {
      this.collectStabilityMetrics();
    }, 30000);

    // Monitor performance metrics every 5 seconds
    this.performanceInterval = setInterval(() => {
      this.collectPerformanceMetrics();
    }, 5000);
  }

  private stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.performanceInterval) {
      clearInterval(this.performanceInterval);
      this.performanceInterval = null;
    }
  }

  private async collectStabilityMetrics(): Promise<void> {
    try {
      const currentTime = Date.now();
      const uptime = currentTime - this.startTime;
      const sessionDuration = currentTime - this.sessionStartTime;
      
      const crashMetrics = await crashReporting.getCrashMetrics();
      const stabilityReport = await errorTracking.getStabilityReport();
      
      const crashFrequency = crashMetrics.crashFrequency;
      const errorRate = this.calculateErrorRate(stabilityReport);
      const performanceScore = this.calculatePerformanceScore();
      const stabilityScore = this.calculateStabilityScore(crashFrequency, errorRate, performanceScore);

      const metrics: StabilityMetrics = {
        uptime,
        sessionDuration,
        crashFrequency,
        errorRate,
        performanceScore,
        stabilityScore,
        lastUpdated: currentTime,
      };

      await this.saveStabilityMetrics(metrics);
      
      // Check for stability issues
      const status = await this.analyzeStabilityStatus(metrics);
      if (!status.isHealthy) {
        this.handleStabilityIssues(status);
      }
    } catch (error) {
      logger.error('Failed to collect stability metrics:', error);
    }
  }

  private async collectPerformanceMetrics(): Promise<void> {
    try {
      const metrics = await this.getCurrentPerformanceMetrics();
      
      // Add to history
      this.performanceHistory.push(metrics);
      
      // Keep only recent entries
      if (this.performanceHistory.length > MAX_HISTORY_ENTRIES) {
        this.performanceHistory = this.performanceHistory.slice(-MAX_HISTORY_ENTRIES);
      }
      
      // Save to storage periodically
      if (this.performanceHistory.length % 10 === 0) {
        await this.savePerformanceHistory();
      }
    } catch (error) {
      logger.error('Failed to collect performance metrics:', error);
    }
  }

  private async getCurrentPerformanceMetrics(): Promise<PerformanceMetrics> {
    // Simulate performance measurements
    const metrics: PerformanceMetrics = {
      memoryUsage: this.getMemoryUsage(),
      cpuUsage: this.getCPUUsage(),
      networkLatency: await this.getNetworkLatency(),
      renderTime: this.getRenderTime(),
      jsHeapSize: this.getJSHeapSize(),
      batteryLevel: await this.getBatteryLevel(),
    };

    return metrics;
  }

  private getMemoryUsage(): number {
    // React Native doesn't provide direct memory API
    // This is a placeholder for platform-specific implementation
    return Math.random() * 50 * 1024 * 1024; // Mock 0-50MB
  }

  private getCPUUsage(): number {
    // Mock CPU usage calculation
    return Math.random() * 100;
  }

  private async getNetworkLatency(): Promise<number> {
    try {
      const start = Date.now();
      await fetch('https://httpbin.org/get', { 
        method: 'HEAD',
        timeout: 5000 
      });
      return Date.now() - start;
    } catch {
      return 1000; // Default high latency if failed
    }
  }

  private getRenderTime(): number {
    // Mock render time calculation
    return Math.random() * 20; // 0-20ms
  }

  private getJSHeapSize(): number {
    // Mock JS heap size
    return Math.random() * 30 * 1024 * 1024; // 0-30MB
  }

  private async getBatteryLevel(): Promise<number> {
    // Mock battery level - would need native module in real implementation
    return Math.random() * 100;
  }

  private calculateErrorRate(stabilityReport: any): number {
    const totalErrors = Object.values(stabilityReport.errorCategories).reduce((sum: number, count: any) => sum + count, 0);
    const totalSessions = stabilityReport.appStability.sessionCount || 1;
    return totalErrors / totalSessions;
  }

  private calculatePerformanceScore(): number {
    if (this.performanceHistory.length === 0) return 100;

    const recent = this.performanceHistory.slice(-10);
    const avgMemory = recent.reduce((sum, m) => sum + m.memoryUsage, 0) / recent.length;
    const avgCPU = recent.reduce((sum, m) => sum + m.cpuUsage, 0) / recent.length;
    const avgRender = recent.reduce((sum, m) => sum + m.renderTime, 0) / recent.length;

    let score = 100;
    
    // Deduct points for high resource usage
    if (avgMemory > this.defaultThresholds.maxMemoryUsage) {
      score -= 20;
    }
    if (avgCPU > 80) {
      score -= 15;
    }
    if (avgRender > this.defaultThresholds.maxRenderTime) {
      score -= 15;
    }

    return Math.max(0, Math.min(100, score));
  }

  private calculateStabilityScore(crashFrequency: number, errorRate: number, performanceScore: number): number {
    let score = 100;
    
    // Deduct points for crashes
    if (crashFrequency > this.defaultThresholds.maxCrashFrequency) {
      score -= 30;
    }
    
    // Deduct points for high error rate
    if (errorRate > this.defaultThresholds.maxErrorRate) {
      score -= 20;
    }
    
    // Include performance score
    score = (score * 0.7) + (performanceScore * 0.3);
    
    return Math.max(0, Math.min(100, score));
  }

  private async analyzeStabilityStatus(metrics: StabilityMetrics): Promise<StabilityStatus> {
    const thresholds = await this.getStabilityThresholds();
    const issues: string[] = [];
    const recommendations: string[] = [];
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

    if (metrics.crashFrequency > thresholds.maxCrashFrequency) {
      issues.push(`High crash frequency: ${metrics.crashFrequency} crashes`);
      recommendations.push('Review error logs and implement crash fixes');
      severity = 'critical';
    }

    if (metrics.errorRate > thresholds.maxErrorRate) {
      issues.push(`High error rate: ${(metrics.errorRate * 100).toFixed(1)}%`);
      recommendations.push('Improve error handling and input validation');
      if (severity === 'low') severity = 'high';
    }

    if (metrics.performanceScore < thresholds.minPerformanceScore) {
      issues.push(`Low performance score: ${metrics.performanceScore.toFixed(1)}`);
      recommendations.push('Optimize memory usage and render performance');
      if (severity === 'low') severity = 'medium';
    }

    if (metrics.stabilityScore < thresholds.minStabilityScore) {
      issues.push(`Low stability score: ${metrics.stabilityScore.toFixed(1)}`);
      recommendations.push('Address stability issues and monitor trends');
      if (severity === 'low') severity = 'medium';
    }

    return {
      isHealthy: issues.length === 0,
      issues,
      recommendations,
      severity,
    };
  }

  private handleStabilityIssues(status: StabilityStatus): void {
    logger.warn('Stability issues detected:', status);
    
    // Log issues for development
    if (__DEV__) {
      console.warn('Stability Issues:');
      status.issues.forEach((issue, index) => {
        console.warn(`  ${index + 1}. ${issue}`);
      });
      console.warn('Recommendations:');
      status.recommendations.forEach((rec, index) => {
        console.warn(`  ${index + 1}. ${rec}`);
      });
    }
  }

  private async saveStabilityMetrics(metrics: StabilityMetrics): Promise<void> {
    try {
      await AsyncStorage.setItem(STABILITY_METRICS_KEY, JSON.stringify(metrics));
    } catch (error) {
      logger.error('Failed to save stability metrics:', error);
    }
  }

  private async loadPerformanceHistory(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(PERFORMANCE_HISTORY_KEY);
      if (stored) {
        this.performanceHistory = JSON.parse(stored);
      }
    } catch (error) {
      logger.error('Failed to load performance history:', error);
    }
  }

  private async savePerformanceHistory(): Promise<void> {
    try {
      await AsyncStorage.setItem(PERFORMANCE_HISTORY_KEY, JSON.stringify(this.performanceHistory));
    } catch (error) {
      logger.error('Failed to save performance history:', error);
    }
  }

  private async saveSessionData(): Promise<void> {
    try {
      const sessionData = {
        duration: Date.now() - this.sessionStartTime,
        endTime: Date.now(),
      };
      await AsyncStorage.setItem(SESSION_TRACKING_KEY, JSON.stringify(sessionData));
    } catch (error) {
      logger.error('Failed to save session data:', error);
    }
  }

  async getStabilityMetrics(): Promise<StabilityMetrics | null> {
    try {
      const stored = await AsyncStorage.getItem(STABILITY_METRICS_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      logger.error('Failed to get stability metrics:', error);
      return null;
    }
  }

  async getStabilityThresholds(): Promise<StabilityThresholds> {
    try {
      const stored = await AsyncStorage.getItem(STABILITY_THRESHOLDS_KEY);
      return stored ? JSON.parse(stored) : this.defaultThresholds;
    } catch (error) {
      logger.error('Failed to get stability thresholds:', error);
      return this.defaultThresholds;
    }
  }

  async updateStabilityThresholds(thresholds: Partial<StabilityThresholds>): Promise<void> {
    try {
      const current = await this.getStabilityThresholds();
      const updated = { ...current, ...thresholds };
      await AsyncStorage.setItem(STABILITY_THRESHOLDS_KEY, JSON.stringify(updated));
    } catch (error) {
      logger.error('Failed to update stability thresholds:', error);
    }
  }

  async getPerformanceHistory(): Promise<PerformanceMetrics[]> {
    return [...this.performanceHistory];
  }

  async getStabilityStatus(): Promise<StabilityStatus> {
    const metrics = await this.getStabilityMetrics();
    if (!metrics) {
      return {
        isHealthy: false,
        issues: ['No stability data available'],
        recommendations: ['Initialize stability monitoring'],
        severity: 'medium',
      };
    }
    
    return this.analyzeStabilityStatus(metrics);
  }

  async exportStabilityData(): Promise<string> {
    try {
      const [metrics, thresholds, history, status] = await Promise.all([
        this.getStabilityMetrics(),
        this.getStabilityThresholds(),
        this.getPerformanceHistory(),
        this.getStabilityStatus(),
      ]);

      return JSON.stringify({
        stabilityMetrics: metrics,
        stabilityThresholds: thresholds,
        performanceHistory: history,
        stabilityStatus: status,
        exportTimestamp: Date.now(),
      }, null, 2);
    } catch (error) {
      logger.error('Failed to export stability data:', error);
      return JSON.stringify({ error: 'Failed to export stability data' });
    }
  }

  async clearStabilityData(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.removeItem(STABILITY_METRICS_KEY),
        AsyncStorage.removeItem(PERFORMANCE_HISTORY_KEY),
        AsyncStorage.removeItem(SESSION_TRACKING_KEY),
      ]);
      
      this.performanceHistory = [];
      this.startTime = Date.now();
      this.sessionStartTime = this.startTime;
      
      logger.info('Stability monitoring data cleared');
    } catch (error) {
      logger.error('Failed to clear stability data:', error);
    }
  }

  async shutdown(): Promise<void> {
    this.stopMonitoring();
    await this.saveSessionData();
    await this.savePerformanceHistory();
    this.initialized = false;
    logger.info('Stability monitoring service shutdown');
  }
}

export const stabilityMonitoring = new StabilityMonitoringService();

export const initializeStabilityMonitoring = () => {
  stabilityMonitoring.initialize();
};

export const getStabilityMetrics = () => {
  return stabilityMonitoring.getStabilityMetrics();
};

export const getStabilityStatus = () => {
  return stabilityMonitoring.getStabilityStatus();
};

export const exportStabilityData = () => {
  return stabilityMonitoring.exportStabilityData();
};