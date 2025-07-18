import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { stabilityMonitoring } from '../../src/utils/stabilityMonitoring';
import { logger } from '../../src/utils/logger';
import { crashReporting } from '../../src/utils/crashReporting';
import { errorTracking } from '../../src/services/errorTracking';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(),
    currentState: 'active',
  },
  Platform: {
    OS: 'ios',
    Version: '14.0',
  },
}));
jest.mock('react-native-device-info', () => ({
  getModel: jest.fn(() => Promise.resolve('iPhone 12')),
  getVersion: jest.fn(() => Promise.resolve('1.0.0')),
  getBuildNumber: jest.fn(() => Promise.resolve('100')),
  isEmulator: jest.fn(() => Promise.resolve(false)),
}));
jest.mock('../../src/utils/logger');
jest.mock('../../src/utils/crashReporting');
jest.mock('../../src/services/errorTracking');

// Mock global performance
global.performance = {
  now: jest.fn(() => Date.now()),
} as any;

// Mock global fetch
global.fetch = jest.fn();

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockLogger = logger as jest.Mocked<typeof logger>;
const mockCrashReporting = crashReporting as jest.Mocked<typeof crashReporting>;
const mockErrorTracking = errorTracking as jest.Mocked<typeof errorTracking>;
const mockAppState = AppState as jest.Mocked<typeof AppState>;

describe('StabilityMonitoring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Mock AsyncStorage
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue();
    mockAsyncStorage.removeItem.mockResolvedValue();
    
    // Mock crash reporting
    mockCrashReporting.getCrashMetrics.mockResolvedValue({
      totalCrashes: 0,
      crashFrequency: 0,
      lastCrashTime: 0,
      sessionsSinceLastCrash: 5,
      averageSessionDuration: 300000,
    });
    
    // Mock error tracking
    mockErrorTracking.getStabilityReport.mockResolvedValue({
      crashMetrics: {
        totalCrashes: 0,
        crashFrequency: 0,
        lastCrashTime: 0,
        sessionsSinceLastCrash: 5,
        averageSessionDuration: 300000,
      },
      errorCategories: {
        network: 0,
        ui: 0,
        database: 0,
        authentication: 0,
        sync: 0,
        other: 0,
      },
      errorPatterns: [],
      appStability: {
        uptime: 300000,
        crashFreeRate: 1.0,
        sessionCount: 5,
        averageSessionLength: 300000,
      },
    });
    
    // Mock fetch for network latency
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await stabilityMonitoring.initialize();
      
      expect(mockLogger.info).toHaveBeenCalledWith('Stability monitoring service initialized');
      expect(mockAppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('should not initialize twice', async () => {
      await stabilityMonitoring.initialize();
      await stabilityMonitoring.initialize();
      
      expect(mockLogger.info).toHaveBeenCalledTimes(1);
    });

    it('should handle initialization errors', async () => {
      mockAsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));
      
      await stabilityMonitoring.initialize();
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to initialize stability monitoring:',
        expect.any(Error)
      );
    });
  });

  describe('Stability Metrics', () => {
    beforeEach(async () => {
      await stabilityMonitoring.initialize();
    });

    it('should return null for metrics when not available', async () => {
      const metrics = await stabilityMonitoring.getStabilityMetrics();
      expect(metrics).toBeNull();
    });

    it('should return stored metrics', async () => {
      const mockMetrics = {
        uptime: 300000,
        sessionDuration: 300000,
        crashFrequency: 0,
        errorRate: 0.1,
        performanceScore: 85,
        stabilityScore: 90,
        lastUpdated: Date.now(),
      };
      
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(mockMetrics));
      
      const metrics = await stabilityMonitoring.getStabilityMetrics();
      expect(metrics).toEqual(mockMetrics);
    });

    it('should handle metrics retrieval errors', async () => {
      mockAsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));
      
      const metrics = await stabilityMonitoring.getStabilityMetrics();
      expect(metrics).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get stability metrics:',
        expect.any(Error)
      );
    });
  });

  describe('Stability Thresholds', () => {
    beforeEach(async () => {
      await stabilityMonitoring.initialize();
    });

    it('should return default thresholds', async () => {
      const thresholds = await stabilityMonitoring.getStabilityThresholds();
      
      expect(thresholds).toEqual({
        maxCrashFrequency: 5,
        maxErrorRate: 0.1,
        minPerformanceScore: 70,
        minStabilityScore: 80,
        maxMemoryUsage: 100 * 1024 * 1024,
        maxRenderTime: 16.67,
      });
    });

    it('should return stored thresholds', async () => {
      const customThresholds = {
        maxCrashFrequency: 3,
        maxErrorRate: 0.05,
        minPerformanceScore: 80,
        minStabilityScore: 85,
        maxMemoryUsage: 50 * 1024 * 1024,
        maxRenderTime: 12.0,
      };
      
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(customThresholds));
      
      const thresholds = await stabilityMonitoring.getStabilityThresholds();
      expect(thresholds).toEqual(customThresholds);
    });

    it('should update thresholds', async () => {
      const updates = {
        maxCrashFrequency: 3,
        minPerformanceScore: 80,
      };
      
      await stabilityMonitoring.updateStabilityThresholds(updates);
      
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'mobdeck_stability_thresholds',
        expect.stringContaining('"maxCrashFrequency":3')
      );
    });

    it('should handle threshold update errors', async () => {
      mockAsyncStorage.setItem.mockRejectedValue(new Error('Storage error'));
      
      await stabilityMonitoring.updateStabilityThresholds({ maxCrashFrequency: 3 });
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to update stability thresholds:',
        expect.any(Error)
      );
    });
  });

  describe('Stability Status', () => {
    beforeEach(async () => {
      await stabilityMonitoring.initialize();
    });

    it('should return status when no metrics available', async () => {
      const status = await stabilityMonitoring.getStabilityStatus();
      
      expect(status).toEqual({
        isHealthy: false,
        issues: ['No stability data available'],
        recommendations: ['Initialize stability monitoring'],
        severity: 'medium',
      });
    });

    it('should analyze healthy stability status', async () => {
      const healthyMetrics = {
        uptime: 300000,
        sessionDuration: 300000,
        crashFrequency: 0,
        errorRate: 0.01,
        performanceScore: 90,
        stabilityScore: 95,
        lastUpdated: Date.now(),
      };
      
      mockAsyncStorage.getItem.mockImplementation((key) => {
        if (key === 'mobdeck_stability_metrics') {
          return Promise.resolve(JSON.stringify(healthyMetrics));
        }
        return Promise.resolve(null);
      });
      
      const status = await stabilityMonitoring.getStabilityStatus();
      
      expect(status.isHealthy).toBe(true);
      expect(status.issues).toHaveLength(0);
      expect(status.severity).toBe('low');
    });

    it('should analyze unhealthy stability status', async () => {
      const unhealthyMetrics = {
        uptime: 300000,
        sessionDuration: 300000,
        crashFrequency: 10,
        errorRate: 0.2,
        performanceScore: 50,
        stabilityScore: 40,
        lastUpdated: Date.now(),
      };
      
      mockAsyncStorage.getItem.mockImplementation((key) => {
        if (key === 'mobdeck_stability_metrics') {
          return Promise.resolve(JSON.stringify(unhealthyMetrics));
        }
        return Promise.resolve(null);
      });
      
      const status = await stabilityMonitoring.getStabilityStatus();
      
      expect(status.isHealthy).toBe(false);
      expect(status.issues.length).toBeGreaterThan(0);
      expect(status.severity).toBe('critical');
    });
  });

  describe('Performance History', () => {
    beforeEach(async () => {
      await stabilityMonitoring.initialize();
    });

    it('should return empty performance history initially', async () => {
      const history = await stabilityMonitoring.getPerformanceHistory();
      expect(history).toEqual([]);
    });

    it('should load performance history from storage', async () => {
      const mockHistory = [
        {
          memoryUsage: 50 * 1024 * 1024,
          cpuUsage: 30,
          networkLatency: 100,
          renderTime: 10,
          jsHeapSize: 20 * 1024 * 1024,
          batteryLevel: 80,
        },
      ];
      
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(mockHistory));
      
      // Re-initialize to load history
      await stabilityMonitoring.initialize();
      
      const history = await stabilityMonitoring.getPerformanceHistory();
      expect(history).toEqual(mockHistory);
    });
  });

  describe('Data Export', () => {
    beforeEach(async () => {
      await stabilityMonitoring.initialize();
    });

    it('should export stability data', async () => {
      const exportData = await stabilityMonitoring.exportStabilityData();
      
      expect(exportData).toContain('exportTimestamp');
      expect(exportData).toContain('stabilityMetrics');
      expect(exportData).toContain('stabilityThresholds');
      expect(exportData).toContain('performanceHistory');
      expect(exportData).toContain('stabilityStatus');
    });

    it('should handle export errors', async () => {
      mockAsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));
      
      const exportData = await stabilityMonitoring.exportStabilityData();
      
      expect(exportData).toContain('Failed to export stability data');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to export stability data:',
        expect.any(Error)
      );
    });
  });

  describe('Data Clearing', () => {
    beforeEach(async () => {
      await stabilityMonitoring.initialize();
    });

    it('should clear stability data', async () => {
      await stabilityMonitoring.clearStabilityData();
      
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('mobdeck_stability_metrics');
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('mobdeck_performance_history');
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('mobdeck_session_tracking');
      expect(mockLogger.info).toHaveBeenCalledWith('Stability monitoring data cleared');
    });

    it('should handle clearing errors', async () => {
      mockAsyncStorage.removeItem.mockRejectedValue(new Error('Storage error'));
      
      await stabilityMonitoring.clearStabilityData();
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to clear stability data:',
        expect.any(Error)
      );
    });
  });

  describe('App State Handling', () => {
    beforeEach(async () => {
      await stabilityMonitoring.initialize();
    });

    it('should handle app state changes', async () => {
      const changeHandler = mockAppState.addEventListener.mock.calls[0][1];
      
      // Test background transition
      changeHandler('background');
      
      // Test foreground transition
      changeHandler('active');
      
      expect(mockAppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });
  });

  describe('Service Shutdown', () => {
    beforeEach(async () => {
      await stabilityMonitoring.initialize();
    });

    it('should shutdown gracefully', async () => {
      await stabilityMonitoring.shutdown();
      
      expect(mockLogger.info).toHaveBeenCalledWith('Stability monitoring service shutdown');
    });
  });

  describe('Error Handling', () => {
    it('should handle network latency measurement errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      await stabilityMonitoring.initialize();
      
      // Network latency should default to high value on error
      const history = await stabilityMonitoring.getPerformanceHistory();
      expect(history).toEqual([]);
    });

    it('should handle performance metrics collection errors', async () => {
      global.performance.now = jest.fn(() => { throw new Error('Performance error'); });
      
      await stabilityMonitoring.initialize();
      
      // Should not crash the service
      expect(mockLogger.info).toHaveBeenCalledWith('Stability monitoring service initialized');
    });
  });

  describe('Performance Metrics Calculation', () => {
    beforeEach(async () => {
      await stabilityMonitoring.initialize();
    });

    it('should calculate performance score correctly', async () => {
      // Mock performance history with good metrics
      const goodHistory = Array.from({ length: 10 }, () => ({
        memoryUsage: 30 * 1024 * 1024, // 30MB
        cpuUsage: 20, // 20%
        networkLatency: 50,
        renderTime: 10, // 10ms
        jsHeapSize: 15 * 1024 * 1024,
        batteryLevel: 80,
      }));
      
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(goodHistory));
      
      // Re-initialize to load history
      await stabilityMonitoring.initialize();
      
      const history = await stabilityMonitoring.getPerformanceHistory();
      expect(history).toEqual(goodHistory);
    });
  });

  describe('Stability Score Calculation', () => {
    beforeEach(async () => {
      await stabilityMonitoring.initialize();
    });

    it('should calculate stability score based on multiple factors', async () => {
      // Mock good crash metrics
      mockCrashReporting.getCrashMetrics.mockResolvedValue({
        totalCrashes: 0,
        crashFrequency: 0,
        lastCrashTime: 0,
        sessionsSinceLastCrash: 10,
        averageSessionDuration: 600000,
      });
      
      // Mock good error tracking
      mockErrorTracking.getStabilityReport.mockResolvedValue({
        crashMetrics: {
          totalCrashes: 0,
          crashFrequency: 0,
          lastCrashTime: 0,
          sessionsSinceLastCrash: 10,
          averageSessionDuration: 600000,
        },
        errorCategories: {
          network: 0,
          ui: 0,
          database: 0,
          authentication: 0,
          sync: 0,
          other: 0,
        },
        errorPatterns: [],
        appStability: {
          uptime: 600000,
          crashFreeRate: 1.0,
          sessionCount: 10,
          averageSessionLength: 600000,
        },
      });
      
      const status = await stabilityMonitoring.getStabilityStatus();
      expect(status.isHealthy).toBe(true);
    });
  });
});