import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { stabilityAlertService } from '../../src/services/StabilityAlertService';
import { logger } from '../../src/utils/logger';
import { stabilityMonitoring } from '../../src/utils/stabilityMonitoring';
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
jest.mock('../../src/utils/stabilityMonitoring');
jest.mock('../../src/services/errorTracking');

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockLogger = logger as jest.Mocked<typeof logger>;
const mockStabilityMonitoring = stabilityMonitoring as jest.Mocked<typeof stabilityMonitoring>;
const mockErrorTracking = errorTracking as jest.Mocked<typeof errorTracking>;
const mockAppState = AppState as jest.Mocked<typeof AppState>;

describe('StabilityAlertService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Mock AsyncStorage
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue();
    mockAsyncStorage.removeItem.mockResolvedValue();
    
    // Mock stability monitoring
    mockStabilityMonitoring.getStabilityStatus.mockResolvedValue({
      isHealthy: true,
      issues: [],
      recommendations: [],
      severity: 'low',
    });
    
    mockStabilityMonitoring.getStabilityMetrics.mockResolvedValue({
      uptime: 300000,
      sessionDuration: 300000,
      crashFrequency: 0,
      errorRate: 0.01,
      performanceScore: 90,
      stabilityScore: 95,
      lastUpdated: Date.now(),
    });
    
    mockStabilityMonitoring.getStabilityThresholds.mockResolvedValue({
      maxCrashFrequency: 5,
      maxErrorRate: 0.1,
      minPerformanceScore: 70,
      minStabilityScore: 80,
      maxMemoryUsage: 100 * 1024 * 1024,
      maxRenderTime: 16.67,
    });
    
    // Mock error tracking
    mockErrorTracking.trackError.mockResolvedValue();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await stabilityAlertService.initialize();
      
      expect(mockLogger.info).toHaveBeenCalledWith('Stability alert service initialized');
      expect(mockAppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('should not initialize twice', async () => {
      await stabilityAlertService.initialize();
      await stabilityAlertService.initialize();
      
      expect(mockLogger.info).toHaveBeenCalledTimes(1);
    });

    it('should handle initialization errors', async () => {
      mockAsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));
      
      await stabilityAlertService.initialize();
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to initialize stability alert service:',
        expect.any(Error)
      );
    });
  });

  describe('Alert Configuration', () => {
    beforeEach(async () => {
      await stabilityAlertService.initialize();
    });

    it('should return default alert configuration', async () => {
      const config = await stabilityAlertService.getAlertConfig();
      
      expect(config).toEqual({
        enabled: true,
        severity: 'medium',
        throttleMs: 300000,
        maxAlertsPerHour: 10,
        developerOnly: true, // __DEV__ is true in test environment
      });
    });

    it('should load stored alert configuration', async () => {
      const storedConfig = {
        enabled: false,
        severity: 'high',
        throttleMs: 600000,
        maxAlertsPerHour: 5,
        developerOnly: false,
      };
      
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(storedConfig));
      
      // Re-initialize to load config
      await stabilityAlertService.initialize();
      
      const config = await stabilityAlertService.getAlertConfig();
      expect(config.enabled).toBe(false);
      expect(config.severity).toBe('high');
    });

    it('should update alert configuration', async () => {
      const updates = {
        enabled: false,
        maxAlertsPerHour: 5,
      };
      
      await stabilityAlertService.updateAlertConfig(updates);
      
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'mobdeck_stability_alert_config',
        expect.stringContaining('"enabled":false')
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Alert config updated:', updates);
    });
  });

  describe('Alert Rules', () => {
    beforeEach(async () => {
      await stabilityAlertService.initialize();
    });

    it('should return alert rules', async () => {
      const rules = await stabilityAlertService.getAlertRules();
      
      expect(rules).toHaveLength(5);
      expect(rules[0].id).toBe('crash_spike');
      expect(rules[1].id).toBe('error_rate_high');
      expect(rules[2].id).toBe('performance_degradation');
      expect(rules[3].id).toBe('stability_decline');
      expect(rules[4].id).toBe('memory_leak');
    });

    it('should update alert rule', async () => {
      const updates = {
        enabled: false,
        throttleMs: 900000,
      };
      
      await stabilityAlertService.updateAlertRule('crash_spike', updates);
      
      expect(mockLogger.info).toHaveBeenCalledWith('Alert rule updated: crash_spike', updates);
    });
  });

  describe('Alert Triggering', () => {
    beforeEach(async () => {
      await stabilityAlertService.initialize();
    });

    it('should trigger crash spike alert', async () => {
      // Mock high crash frequency
      mockStabilityMonitoring.getStabilityMetrics.mockResolvedValue({
        uptime: 300000,
        sessionDuration: 300000,
        crashFrequency: 10, // Above threshold
        errorRate: 0.01,
        performanceScore: 90,
        stabilityScore: 95,
        lastUpdated: Date.now(),
      });
      
      mockStabilityMonitoring.getStabilityStatus.mockResolvedValue({
        isHealthy: false,
        issues: ['High crash frequency'],
        recommendations: ['Fix crashes'],
        severity: 'critical',
      });
      
      // Fast forward to trigger alert check
      jest.advanceTimersByTime(60000);
      
      await jest.runAllTimersAsync();
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Stability alert triggered: Crash Spike Detected'),
        expect.any(Object)
      );
    });

    it('should trigger error rate alert', async () => {
      // Mock high error rate
      mockStabilityMonitoring.getStabilityMetrics.mockResolvedValue({
        uptime: 300000,
        sessionDuration: 300000,
        crashFrequency: 0,
        errorRate: 0.2, // Above threshold
        performanceScore: 90,
        stabilityScore: 95,
        lastUpdated: Date.now(),
      });
      
      mockStabilityMonitoring.getStabilityStatus.mockResolvedValue({
        isHealthy: false,
        issues: ['High error rate'],
        recommendations: ['Fix errors'],
        severity: 'high',
      });
      
      // Fast forward to trigger alert check
      jest.advanceTimersByTime(60000);
      
      await jest.runAllTimersAsync();
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Stability alert triggered: High Error Rate'),
        expect.any(Object)
      );
    });

    it('should trigger performance degradation alert', async () => {
      // Mock low performance score
      mockStabilityMonitoring.getStabilityMetrics.mockResolvedValue({
        uptime: 300000,
        sessionDuration: 300000,
        crashFrequency: 0,
        errorRate: 0.01,
        performanceScore: 50, // Below threshold
        stabilityScore: 95,
        lastUpdated: Date.now(),
      });
      
      mockStabilityMonitoring.getStabilityStatus.mockResolvedValue({
        isHealthy: false,
        issues: ['Low performance score'],
        recommendations: ['Optimize performance'],
        severity: 'medium',
      });
      
      // Fast forward to trigger alert check
      jest.advanceTimersByTime(60000);
      
      await jest.runAllTimersAsync();
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Stability alert triggered: Performance Degradation'),
        expect.any(Object)
      );
    });

    it('should respect alert throttling', async () => {
      // Mock high crash frequency
      mockStabilityMonitoring.getStabilityMetrics.mockResolvedValue({
        uptime: 300000,
        sessionDuration: 300000,
        crashFrequency: 10,
        errorRate: 0.01,
        performanceScore: 90,
        stabilityScore: 95,
        lastUpdated: Date.now(),
      });
      
      mockStabilityMonitoring.getStabilityStatus.mockResolvedValue({
        isHealthy: false,
        issues: ['High crash frequency'],
        recommendations: ['Fix crashes'],
        severity: 'critical',
      });
      
      // Trigger first alert
      jest.advanceTimersByTime(60000);
      await jest.runAllTimersAsync();
      
      // Trigger second alert within throttle period
      jest.advanceTimersByTime(60000);
      await jest.runAllTimersAsync();
      
      // Should only trigger once due to throttling
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    });

    it('should respect hourly rate limit', async () => {
      // Mock stored alert history with many recent alerts
      const recentAlerts = Array.from({ length: 10 }, (_, i) => ({
        id: `alert_${i}`,
        type: 'crash_spike',
        severity: 'critical',
        message: 'Test alert',
        data: {},
        timestamp: Date.now() - (i * 60000), // 1 minute apart
        acknowledged: false,
        dismissed: false,
      }));
      
      mockAsyncStorage.getItem.mockImplementation((key) => {
        if (key === 'mobdeck_stability_alert_history') {
          return Promise.resolve(JSON.stringify(recentAlerts));
        }
        return Promise.resolve(null);
      });
      
      // Re-initialize to load history
      await stabilityAlertService.initialize();
      
      // Mock high crash frequency
      mockStabilityMonitoring.getStabilityMetrics.mockResolvedValue({
        uptime: 300000,
        sessionDuration: 300000,
        crashFrequency: 10,
        errorRate: 0.01,
        performanceScore: 90,
        stabilityScore: 95,
        lastUpdated: Date.now(),
      });
      
      mockStabilityMonitoring.getStabilityStatus.mockResolvedValue({
        isHealthy: false,
        issues: ['High crash frequency'],
        recommendations: ['Fix crashes'],
        severity: 'critical',
      });
      
      // Fast forward to trigger alert check
      jest.advanceTimersByTime(60000);
      await jest.runAllTimersAsync();
      
      // Should not trigger due to rate limit
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Alert rate limit exceeded for crash_spike'
      );
    });
  });

  describe('Alert History', () => {
    beforeEach(async () => {
      await stabilityAlertService.initialize();
    });

    it('should return empty alert history initially', async () => {
      const history = await stabilityAlertService.getAlertHistory();
      expect(history).toEqual([]);
    });

    it('should return active alerts only', async () => {
      const alerts = [
        {
          id: 'alert_1',
          type: 'crash_spike',
          severity: 'critical',
          message: 'Active alert',
          data: {},
          timestamp: Date.now(),
          acknowledged: false,
          dismissed: false,
        },
        {
          id: 'alert_2',
          type: 'error_rate',
          severity: 'high',
          message: 'Dismissed alert',
          data: {},
          timestamp: Date.now(),
          acknowledged: false,
          dismissed: true,
        },
      ];
      
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(alerts));
      
      // Re-initialize to load history
      await stabilityAlertService.initialize();
      
      const activeAlerts = await stabilityAlertService.getActiveAlerts();
      expect(activeAlerts).toHaveLength(1);
      expect(activeAlerts[0].id).toBe('alert_1');
    });

    it('should acknowledge alert', async () => {
      const alerts = [
        {
          id: 'alert_1',
          type: 'crash_spike',
          severity: 'critical',
          message: 'Test alert',
          data: {},
          timestamp: Date.now(),
          acknowledged: false,
          dismissed: false,
        },
      ];
      
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(alerts));
      
      // Re-initialize to load history
      await stabilityAlertService.initialize();
      
      await stabilityAlertService.acknowledgeAlert('alert_1');
      
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'mobdeck_stability_alert_history',
        expect.stringContaining('"acknowledged":true')
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Alert acknowledged: alert_1');
    });

    it('should dismiss alert', async () => {
      const alerts = [
        {
          id: 'alert_1',
          type: 'crash_spike',
          severity: 'critical',
          message: 'Test alert',
          data: {},
          timestamp: Date.now(),
          acknowledged: false,
          dismissed: false,
        },
      ];
      
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(alerts));
      
      // Re-initialize to load history
      await stabilityAlertService.initialize();
      
      await stabilityAlertService.dismissAlert('alert_1');
      
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'mobdeck_stability_alert_history',
        expect.stringContaining('"dismissed":true')
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Alert dismissed: alert_1');
    });

    it('should clear alert history', async () => {
      await stabilityAlertService.clearAlertHistory();
      
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'mobdeck_stability_alert_history',
        '[]'
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Alert history cleared');
    });
  });

  describe('Test Alerts', () => {
    beforeEach(async () => {
      await stabilityAlertService.initialize();
    });

    it('should trigger test alert', async () => {
      await stabilityAlertService.testAlert('crash_spike');
      
      expect(mockLogger.info).toHaveBeenCalledWith('Test alert triggered: crash_spike');
    });

    it('should handle test alert for unknown type', async () => {
      await stabilityAlertService.testAlert('unknown_type' as any);
      
      // Should not crash or log error
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('Test alert triggered: unknown_type')
      );
    });
  });

  describe('Data Export', () => {
    beforeEach(async () => {
      await stabilityAlertService.initialize();
    });

    it('should export alert data', async () => {
      const exportData = await stabilityAlertService.exportAlertData();
      
      expect(exportData).toContain('config');
      expect(exportData).toContain('history');
      expect(exportData).toContain('rules');
      expect(exportData).toContain('throttleMap');
      expect(exportData).toContain('exportTimestamp');
    });

    it('should handle export errors', async () => {
      // Mock JSON.stringify to throw error
      const originalStringify = JSON.stringify;
      JSON.stringify = jest.fn(() => { throw new Error('Stringify error'); });
      
      const exportData = await stabilityAlertService.exportAlertData();
      
      expect(exportData).toContain('Failed to export alert data');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to export alert data:',
        expect.any(Error)
      );
      
      // Restore original stringify
      JSON.stringify = originalStringify;
    });
  });

  describe('App State Handling', () => {
    beforeEach(async () => {
      await stabilityAlertService.initialize();
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
      await stabilityAlertService.initialize();
    });

    it('should shutdown gracefully', async () => {
      await stabilityAlertService.shutdown();
      
      expect(mockLogger.info).toHaveBeenCalledWith('Stability alert service shutdown');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await stabilityAlertService.initialize();
    });

    it('should handle stability check errors', async () => {
      mockStabilityMonitoring.getStabilityStatus.mockRejectedValue(new Error('Monitoring error'));
      
      // Fast forward to trigger alert check
      jest.advanceTimersByTime(60000);
      await jest.runAllTimersAsync();
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to check stability alerts:',
        expect.any(Error)
      );
    });

    it('should handle alert storage errors', async () => {
      mockAsyncStorage.setItem.mockRejectedValue(new Error('Storage error'));
      
      // Mock high crash frequency to trigger alert
      mockStabilityMonitoring.getStabilityMetrics.mockResolvedValue({
        uptime: 300000,
        sessionDuration: 300000,
        crashFrequency: 10,
        errorRate: 0.01,
        performanceScore: 90,
        stabilityScore: 95,
        lastUpdated: Date.now(),
      });
      
      mockStabilityMonitoring.getStabilityStatus.mockResolvedValue({
        isHealthy: false,
        issues: ['High crash frequency'],
        recommendations: ['Fix crashes'],
        severity: 'critical',
      });
      
      // Fast forward to trigger alert check
      jest.advanceTimersByTime(60000);
      await jest.runAllTimersAsync();
      
      // Should still trigger alert but log storage error
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Stability alert triggered'),
        expect.any(Object)
      );
    });
  });
});