import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';
import { stabilityMonitoring } from '../utils/stabilityMonitoring';
import { stabilityAlertService } from './StabilityAlertService';
import { errorTracking } from './errorTracking';
import { crashReporting } from '../utils/crashReporting';

export interface StabilityIntegrationConfig {
  enabled: boolean;
  syncInterval: number;
  autoInitialize: boolean;
  errorTrackingEnabled: boolean;
  alertsEnabled: boolean;
  crashReportingEnabled: boolean;
}

export interface IntegrationMetrics {
  totalStabilityChecks: number;
  totalAlertsTriggered: number;
  totalErrorsTracked: number;
  totalCrashesReported: number;
  lastSyncTime: number;
  uptime: number;
}

const INTEGRATION_CONFIG_KEY = 'mobdeck_stability_integration_config';
const INTEGRATION_METRICS_KEY = 'mobdeck_stability_integration_metrics';

class StabilityIntegrationService {
  private initialized = false;
  private config: StabilityIntegrationConfig;
  private metrics: IntegrationMetrics;
  private syncInterval: NodeJS.Timeout | null = null;
  private appState: AppStateStatus = 'active';
  private startTime: number = 0;

  private readonly defaultConfig: StabilityIntegrationConfig = {
    enabled: true,
    syncInterval: 30000, // 30 seconds
    autoInitialize: true,
    errorTrackingEnabled: true,
    alertsEnabled: true,
    crashReportingEnabled: true,
  };

  private readonly defaultMetrics: IntegrationMetrics = {
    totalStabilityChecks: 0,
    totalAlertsTriggered: 0,
    totalErrorsTracked: 0,
    totalCrashesReported: 0,
    lastSyncTime: 0,
    uptime: 0,
  };

  constructor() {
    this.config = this.defaultConfig;
    this.metrics = this.defaultMetrics;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.startTime = Date.now();
      
      await this.loadConfig();
      await this.loadMetrics();
      
      if (this.config.enabled) {
        await this.initializeServices();
        this.setupAppStateHandling();
        this.startSyncProcess();
      }
      
      this.initialized = true;
      logger.info('Stability integration service initialized', {
        enabled: this.config.enabled,
        syncInterval: this.config.syncInterval,
      });
    } catch (error) {
      logger.error('Failed to initialize stability integration service:', error);
    }
  }

  private async initializeServices(): Promise<void> {
    const initPromises: Promise<void>[] = [];

    // Initialize stability monitoring
    initPromises.push(stabilityMonitoring.initialize());

    // Initialize error tracking if enabled
    if (this.config.errorTrackingEnabled) {
      initPromises.push(errorTracking.initialize());
    }

    // Initialize crash reporting if enabled
    if (this.config.crashReportingEnabled) {
      initPromises.push(crashReporting.initialize());
    }

    // Initialize alerts if enabled
    if (this.config.alertsEnabled) {
      initPromises.push(stabilityAlertService.initialize());
    }

    await Promise.all(initPromises);
    logger.info('All stability services initialized');
  }

  private setupAppStateHandling(): void {
    AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (this.appState === 'background' && nextAppState === 'active') {
        this.onAppForeground();
      } else if (this.appState === 'active' && nextAppState === 'background') {
        this.onAppBackground();
      }
      this.appState = nextAppState;
    });
  }

  private onAppForeground(): void {
    if (this.config.enabled) {
      this.startSyncProcess();
    }
    logger.info('App entered foreground - stability integration resumed');
  }

  private onAppBackground(): void {
    this.stopSyncProcess();
    this.saveMetrics();
    logger.info('App entered background - stability integration paused');
  }

  private startSyncProcess(): void {
    if (this.syncInterval || !this.config.enabled) return;

    this.syncInterval = setInterval(() => {
      this.syncStabilityData();
    }, this.config.syncInterval);
  }

  private stopSyncProcess(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  private async syncStabilityData(): Promise<void> {
    try {
      const now = Date.now();
      
      // Update uptime
      this.metrics.uptime = now - this.startTime;
      
      // Get current stability status
      const stabilityStatus = await stabilityMonitoring.getStabilityStatus();
      const stabilityMetrics = await stabilityMonitoring.getStabilityMetrics();
      
      // Update stability check count
      this.metrics.totalStabilityChecks++;
      
      // Check for stability issues and integrate with error tracking
      if (!stabilityStatus.isHealthy) {
        await this.handleStabilityIssues(stabilityStatus, stabilityMetrics);
      }
      
      // Sync with error tracking service
      if (this.config.errorTrackingEnabled) {
        await this.syncWithErrorTracking(stabilityStatus, stabilityMetrics);
      }
      
      // Update last sync time
      this.metrics.lastSyncTime = now;
      
      // Save metrics periodically
      if (this.metrics.totalStabilityChecks % 10 === 0) {
        await this.saveMetrics();
      }
      
    } catch (error) {
      logger.error('Failed to sync stability data:', error);
    }
  }

  private async handleStabilityIssues(status: any, metrics: any): Promise<void> {
    try {
      // Track stability issues as errors
      if (this.config.errorTrackingEnabled) {
        const stabilityError = new Error(`Stability Issue: ${status.issues.join(', ')}`);
        await errorTracking.trackError(stabilityError, 'other', {
          stabilityIssue: true,
          severity: status.severity,
          stabilityScore: metrics?.stabilityScore,
          performanceScore: metrics?.performanceScore,
          crashFrequency: metrics?.crashFrequency,
          errorRate: metrics?.errorRate,
        });
        
        this.metrics.totalErrorsTracked++;
      }
      
      // Report critical stability issues as crashes
      if (status.severity === 'critical' && this.config.crashReportingEnabled) {
        const criticalError = new Error(`Critical Stability Issue: ${status.issues.join(', ')}`);
        await crashReporting.reportCrash(criticalError, {
          stabilityIssue: true,
          severity: status.severity,
          stabilityMetrics: metrics,
        });
        
        this.metrics.totalCrashesReported++;
      }
      
    } catch (error) {
      logger.error('Failed to handle stability issues:', error);
    }
  }

  private async syncWithErrorTracking(status: any, metrics: any): Promise<void> {
    try {
      // Get error tracking data
      const errorReport = await errorTracking.getStabilityReport();
      
      // Correlate error patterns with stability metrics
      const correlatedData = this.correlateErrorsWithStability(errorReport, metrics);
      
      // Update error tracking with stability context
      if (correlatedData.hasCorrelation) {
        logger.info('Stability-error correlation detected', correlatedData);
        
        // Track correlated error
        const correlationError = new Error(`Stability-Error Correlation: ${correlatedData.description}`);
        await errorTracking.trackError(correlationError, 'other', {
          correlation: true,
          correlationData: correlatedData,
        });
      }
      
    } catch (error) {
      logger.error('Failed to sync with error tracking:', error);
    }
  }

  private correlateErrorsWithStability(errorReport: any, stabilityMetrics: any): any {
    const correlations = [];
    
    // Check for correlation between error rate and stability score
    if (errorReport.errorCategories && stabilityMetrics) {
      const totalErrors = Object.values(errorReport.errorCategories).reduce((sum: number, count: any) => sum + count, 0);
      const errorRate = totalErrors / (errorReport.appStability.sessionCount || 1);
      
      if (errorRate > 0.05 && stabilityMetrics.stabilityScore < 60) {
        correlations.push({
          type: 'error_rate_stability',
          description: `High error rate (${(errorRate * 100).toFixed(1)}%) correlates with low stability score (${stabilityMetrics.stabilityScore.toFixed(1)})`,
          severity: 'high',
        });
      }
    }
    
    // Check for correlation between crash frequency and performance
    if (errorReport.crashMetrics && stabilityMetrics) {
      if (errorReport.crashMetrics.crashFrequency > 3 && stabilityMetrics.performanceScore < 70) {
        correlations.push({
          type: 'crash_performance',
          description: `High crash frequency (${errorReport.crashMetrics.crashFrequency}) correlates with low performance score (${stabilityMetrics.performanceScore.toFixed(1)})`,
          severity: 'critical',
        });
      }
    }
    
    return {
      hasCorrelation: correlations.length > 0,
      correlations,
      description: correlations.map(c => c.description).join('; '),
    };
  }

  private async loadConfig(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(INTEGRATION_CONFIG_KEY);
      if (stored) {
        this.config = { ...this.defaultConfig, ...JSON.parse(stored) };
      }
    } catch (error) {
      logger.error('Failed to load integration config:', error);
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      await AsyncStorage.setItem(INTEGRATION_CONFIG_KEY, JSON.stringify(this.config));
    } catch (error) {
      logger.error('Failed to save integration config:', error);
    }
  }

  private async loadMetrics(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(INTEGRATION_METRICS_KEY);
      if (stored) {
        this.metrics = { ...this.defaultMetrics, ...JSON.parse(stored) };
      }
    } catch (error) {
      logger.error('Failed to load integration metrics:', error);
    }
  }

  private async saveMetrics(): Promise<void> {
    try {
      await AsyncStorage.setItem(INTEGRATION_METRICS_KEY, JSON.stringify(this.metrics));
    } catch (error) {
      logger.error('Failed to save integration metrics:', error);
    }
  }

  // Public API methods
  async getConfig(): Promise<StabilityIntegrationConfig> {
    return { ...this.config };
  }

  async updateConfig(updates: Partial<StabilityIntegrationConfig>): Promise<void> {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...updates };
    
    // Handle config changes
    if (oldConfig.enabled !== this.config.enabled) {
      if (this.config.enabled) {
        await this.initializeServices();
        this.startSyncProcess();
      } else {
        this.stopSyncProcess();
      }
    }
    
    if (oldConfig.syncInterval !== this.config.syncInterval) {
      this.stopSyncProcess();
      if (this.config.enabled) {
        this.startSyncProcess();
      }
    }
    
    await this.saveConfig();
    logger.info('Integration config updated', updates);
  }

  async getMetrics(): Promise<IntegrationMetrics> {
    // Update uptime before returning
    this.metrics.uptime = Date.now() - this.startTime;
    return { ...this.metrics };
  }

  async resetMetrics(): Promise<void> {
    this.metrics = { ...this.defaultMetrics };
    await this.saveMetrics();
    logger.info('Integration metrics reset');
  }

  async getIntegrationStatus(): Promise<{
    isHealthy: boolean;
    services: Record<string, boolean>;
    issues: string[];
  }> {
    const services = {
      stabilityMonitoring: this.initialized,
      errorTracking: this.config.errorTrackingEnabled,
      crashReporting: this.config.crashReportingEnabled,
      alertService: this.config.alertsEnabled,
    };
    
    const issues = [];
    
    if (!this.initialized) {
      issues.push('Integration service not initialized');
    }
    
    if (!this.config.enabled) {
      issues.push('Integration disabled');
    }
    
    if (this.config.enabled && !this.syncInterval) {
      issues.push('Sync process not running');
    }
    
    return {
      isHealthy: issues.length === 0,
      services,
      issues,
    };
  }

  async exportIntegrationData(): Promise<string> {
    try {
      const data = {
        config: this.config,
        metrics: await this.getMetrics(),
        status: await this.getIntegrationStatus(),
        exportTimestamp: Date.now(),
      };
      
      return JSON.stringify(data, null, 2);
    } catch (error) {
      logger.error('Failed to export integration data:', error);
      return JSON.stringify({ error: 'Failed to export integration data' });
    }
  }

  async performManualSync(): Promise<void> {
    if (!this.config.enabled) {
      throw new Error('Integration is disabled');
    }
    
    await this.syncStabilityData();
    logger.info('Manual stability sync completed');
  }

  async triggerStabilityCheck(): Promise<void> {
    if (!this.config.enabled) {
      throw new Error('Integration is disabled');
    }
    
    const status = await stabilityMonitoring.getStabilityStatus();
    const metrics = await stabilityMonitoring.getStabilityMetrics();
    
    if (!status.isHealthy) {
      await this.handleStabilityIssues(status, metrics);
    }
    
    logger.info('Manual stability check completed', {
      isHealthy: status.isHealthy,
      severity: status.severity,
    });
  }

  async shutdown(): Promise<void> {
    this.stopSyncProcess();
    await this.saveMetrics();
    
    // Shutdown individual services
    if (this.config.alertsEnabled) {
      await stabilityAlertService.shutdown();
    }
    
    if (this.config.crashReportingEnabled) {
      await stabilityMonitoring.shutdown();
    }
    
    this.initialized = false;
    logger.info('Stability integration service shutdown');
  }
}

export const stabilityIntegrationService = new StabilityIntegrationService();

export const initializeStabilityIntegration = () => {
  stabilityIntegrationService.initialize();
};

export const getStabilityIntegrationStatus = () => {
  return stabilityIntegrationService.getIntegrationStatus();
};

export const performManualStabilitySync = () => {
  return stabilityIntegrationService.performManualSync();
};

export const triggerStabilityCheck = () => {
  return stabilityIntegrationService.triggerStabilityCheck();
};