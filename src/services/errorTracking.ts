import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { crashReporting, CrashMetrics, reportCrash } from '../utils/crashReporting';
import { logger } from '../utils/logger';

export interface ErrorCategory {
  network: number;
  ui: number;
  database: number;
  authentication: number;
  sync: number;
  other: number;
}

export interface ErrorPattern {
  errorType: string;
  frequency: number;
  lastOccurrence: number;
  associatedRoutes: string[];
}

export interface StabilityReport {
  crashMetrics: CrashMetrics;
  errorCategories: ErrorCategory;
  errorPatterns: ErrorPattern[];
  appStability: {
    uptime: number;
    crashFreeRate: number;
    sessionCount: number;
    averageSessionLength: number;
  };
}

const ERROR_CATEGORIES_KEY = 'mobdeck_error_categories';
const ERROR_PATTERNS_KEY = 'mobdeck_error_patterns';
const STABILITY_METRICS_KEY = 'mobdeck_stability_metrics';
const APP_UPTIME_KEY = 'mobdeck_app_uptime';

class ErrorTrackingService {
  private initialized = false;
  private appStartTime: number = 0;
  private currentAppState: AppStateStatus = 'active';
  private sessionCount = 0;
  private totalUptime = 0;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.appStartTime = Date.now();
      this.sessionCount = await this.getSessionCount();
      this.totalUptime = await this.getTotalUptime();
      
      this.setupAppStateHandling();
      this.setupGlobalErrorHandlers();
      
      await this.incrementSessionCount();
      this.initialized = true;
      logger.info('Error tracking service initialized');
    } catch (error) {
      logger.error('Failed to initialize error tracking:', error);
    }
  }

  private setupAppStateHandling(): void {
    AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (this.currentAppState === 'background' && nextAppState === 'active') {
        this.onAppForeground();
      } else if (this.currentAppState === 'active' && nextAppState === 'background') {
        this.onAppBackground();
      }
      this.currentAppState = nextAppState;
    });
  }

  private setupGlobalErrorHandlers(): void {
    // Handle unhandled promise rejections
    const originalHandler = global.Promise.reject;
    global.Promise.reject = (reason: any) => {
      this.trackError(new Error(`Unhandled Promise Rejection: ${reason}`), 'promise');
      return originalHandler(reason);
    };

    // Handle JavaScript errors
    const originalErrorHandler = global.ErrorUtils?.setGlobalHandler;
    if (originalErrorHandler) {
      originalErrorHandler((error: any, isFatal?: boolean) => {
        if (isFatal) {
          reportCrash(error, { fatal: true, source: 'global' });
        } else {
          this.trackError(error, 'javascript');
        }
      });
    }
  }

  async trackError(error: Error, category: keyof ErrorCategory, context?: Record<string, any>): Promise<void> {
    try {
      // Update error categories
      await this.updateErrorCategories(category);
      
      // Update error patterns
      await this.updateErrorPatterns(error, context);
      
      // Log the error
      logger.error(`Error tracked [${category}]:`, error, context);
    } catch (trackingError) {
      logger.error('Failed to track error:', trackingError);
    }
  }

  private async updateErrorCategories(category: keyof ErrorCategory): Promise<void> {
    try {
      const categories = await this.getErrorCategories();
      categories[category] = (categories[category] || 0) + 1;
      await AsyncStorage.setItem(ERROR_CATEGORIES_KEY, JSON.stringify(categories));
    } catch (error) {
      logger.error('Failed to update error categories:', error);
    }
  }

  private async updateErrorPatterns(error: Error, context?: Record<string, any>): Promise<void> {
    try {
      const patterns = await this.getErrorPatterns();
      const errorType = `${error.name}: ${error.message}`;
      
      const existingPattern = patterns.find(p => p.errorType === errorType);
      
      if (existingPattern) {
        existingPattern.frequency += 1;
        existingPattern.lastOccurrence = Date.now();
        if (context?.route && !existingPattern.associatedRoutes.includes(context.route)) {
          existingPattern.associatedRoutes.push(context.route);
        }
      } else {
        patterns.push({
          errorType,
          frequency: 1,
          lastOccurrence: Date.now(),
          associatedRoutes: context?.route ? [context.route] : [],
        });
      }

      // Keep only top 100 patterns
      patterns.sort((a, b) => b.frequency - a.frequency);
      const limitedPatterns = patterns.slice(0, 100);

      await AsyncStorage.setItem(ERROR_PATTERNS_KEY, JSON.stringify(limitedPatterns));
    } catch (updateError) {
      logger.error('Failed to update error patterns:', updateError);
    }
  }

  private async getErrorCategories(): Promise<ErrorCategory> {
    try {
      const stored = await AsyncStorage.getItem(ERROR_CATEGORIES_KEY);
      return stored ? JSON.parse(stored) : {
        network: 0,
        ui: 0,
        database: 0,
        authentication: 0,
        sync: 0,
        other: 0,
      };
    } catch (error) {
      logger.error('Failed to get error categories:', error);
      return {
        network: 0,
        ui: 0,
        database: 0,
        authentication: 0,
        sync: 0,
        other: 0,
      };
    }
  }

  private async getErrorPatterns(): Promise<ErrorPattern[]> {
    try {
      const stored = await AsyncStorage.getItem(ERROR_PATTERNS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      logger.error('Failed to get error patterns:', error);
      return [];
    }
  }

  private async getSessionCount(): Promise<number> {
    try {
      const stored = await AsyncStorage.getItem('mobdeck_session_count');
      return stored ? parseInt(stored, 10) : 0;
    } catch (error) {
      logger.error('Failed to get session count:', error);
      return 0;
    }
  }

  private async incrementSessionCount(): Promise<void> {
    try {
      this.sessionCount += 1;
      await AsyncStorage.setItem('mobdeck_session_count', this.sessionCount.toString());
    } catch (error) {
      logger.error('Failed to increment session count:', error);
    }
  }

  private async getTotalUptime(): Promise<number> {
    try {
      const stored = await AsyncStorage.getItem(APP_UPTIME_KEY);
      return stored ? parseInt(stored, 10) : 0;
    } catch (error) {
      logger.error('Failed to get total uptime:', error);
      return 0;
    }
  }

  private async updateTotalUptime(): Promise<void> {
    try {
      const sessionUptime = Date.now() - this.appStartTime;
      this.totalUptime += sessionUptime;
      await AsyncStorage.setItem(APP_UPTIME_KEY, this.totalUptime.toString());
    } catch (error) {
      logger.error('Failed to update total uptime:', error);
    }
  }

  private onAppForeground(): void {
    this.appStartTime = Date.now();
    logger.info('App entered foreground');
  }

  private onAppBackground(): void {
    this.updateTotalUptime();
    logger.info('App entered background');
  }

  async getStabilityReport(): Promise<StabilityReport> {
    try {
      const [crashMetrics, errorCategories, errorPatterns] = await Promise.all([
        crashReporting.getCrashMetrics(),
        this.getErrorCategories(),
        this.getErrorPatterns(),
      ]);

      const currentUptime = Date.now() - this.appStartTime;
      const totalUptime = this.totalUptime + currentUptime;
      const averageSessionLength = this.sessionCount > 0 ? totalUptime / this.sessionCount : 0;
      
      const crashFreeRate = this.sessionCount > 0 
        ? Math.max(0, (this.sessionCount - crashMetrics.totalCrashes) / this.sessionCount)
        : 1;

      return {
        crashMetrics,
        errorCategories,
        errorPatterns,
        appStability: {
          uptime: totalUptime,
          crashFreeRate,
          sessionCount: this.sessionCount,
          averageSessionLength,
        },
      };
    } catch (error) {
      logger.error('Failed to generate stability report:', error);
      throw error;
    }
  }

  async exportStabilityData(): Promise<string> {
    try {
      const report = await this.getStabilityReport();
      const crashReports = await crashReporting.getCrashReports();
      
      return JSON.stringify({
        stabilityReport: report,
        crashReports,
        exportTimestamp: Date.now(),
      }, null, 2);
    } catch (exportError) {
      logger.error('Failed to export stability data:', exportError);
      return JSON.stringify({ error: 'Failed to export stability data' });
    }
  }

  async clearAllData(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.removeItem(ERROR_CATEGORIES_KEY),
        AsyncStorage.removeItem(ERROR_PATTERNS_KEY),
        AsyncStorage.removeItem(STABILITY_METRICS_KEY),
        AsyncStorage.removeItem(APP_UPTIME_KEY),
        AsyncStorage.removeItem('mobdeck_session_count'),
        crashReporting.clearCrashReports(),
      ]);
      
      this.sessionCount = 0;
      this.totalUptime = 0;
      this.appStartTime = Date.now();
      
      logger.info('All error tracking data cleared');
    } catch (clearError) {
      logger.error('Failed to clear error tracking data:', clearError);
    }
  }

  // Convenience methods for tracking specific error types
  async trackNetworkError(error: Error, context?: Record<string, any>): Promise<void> {
    return this.trackError(error, 'network', context);
  }

  async trackUIError(error: Error, context?: Record<string, any>): Promise<void> {
    return this.trackError(error, 'ui', context);
  }

  async trackDatabaseError(error: Error, context?: Record<string, any>): Promise<void> {
    return this.trackError(error, 'database', context);
  }

  async trackAuthenticationError(error: Error, context?: Record<string, any>): Promise<void> {
    return this.trackError(error, 'authentication', context);
  }

  async trackSyncError(error: Error, context?: Record<string, any>): Promise<void> {
    return this.trackError(error, 'sync', context);
  }

  async trackOtherError(error: Error, context?: Record<string, any>): Promise<void> {
    return this.trackError(error, 'other', context);
  }
}

export const errorTracking = new ErrorTrackingService();

export const initializeErrorTracking = () => {
  errorTracking.initialize();
};

export const trackError = (error: Error, category: keyof ErrorCategory, context?: Record<string, any>) => {
  errorTracking.trackError(error, category, context);
};

export const trackNetworkError = (error: Error, context?: Record<string, any>) => {
  errorTracking.trackNetworkError(error, context);
};

export const trackUIError = (error: Error, context?: Record<string, any>) => {
  errorTracking.trackUIError(error, context);
};

export const trackDatabaseError = (error: Error, context?: Record<string, any>) => {
  errorTracking.trackDatabaseError(error, context);
};

export const trackAuthenticationError = (error: Error, context?: Record<string, any>) => {
  errorTracking.trackAuthenticationError(error, context);
};

export const trackSyncError = (error: Error, context?: Record<string, any>) => {
  errorTracking.trackSyncError(error, context);
};

export const trackOtherError = (error: Error, context?: Record<string, any>) => {
  errorTracking.trackOtherError(error, context);
};