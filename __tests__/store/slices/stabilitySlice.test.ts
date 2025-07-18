import { configureStore } from '@reduxjs/toolkit';
import stabilityReducer, {
  initializeStabilityMonitoring,
  updateStabilityMetrics,
  updateStabilityThresholds,
  loadPerformanceHistory,
  exportStabilityData,
  clearStabilityData,
  setMonitoring,
  clearError,
  setAlertsEnabled,
  addNotification,
  dismissNotification,
  clearAllNotifications,
  updateMetricsLocal,
  updateStatusLocal,
  resetStabilityState,
} from '../../../src/store/slices/stabilitySlice';
import { stabilityMonitoring } from '../../../src/utils/stabilityMonitoring';
// import { logger } from '../../../src/utils/logger';

// Mock dependencies
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
jest.mock('../../../src/utils/stabilityMonitoring');
jest.mock('../../../src/utils/logger');

const mockStabilityMonitoring = stabilityMonitoring as jest.Mocked<typeof stabilityMonitoring>;
// const mockLogger = logger as jest.Mocked<typeof logger>;

describe('StabilitySlice', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    store = configureStore({
      reducer: {
        stability: stabilityReducer,
      },
    });
    
    // Mock stability monitoring methods
    mockStabilityMonitoring.initialize.mockResolvedValue();
    mockStabilityMonitoring.getStabilityMetrics.mockResolvedValue({
      uptime: 300000,
      sessionDuration: 300000,
      crashFrequency: 0,
      errorRate: 0.01,
      performanceScore: 90,
      stabilityScore: 95,
      lastUpdated: Date.now(),
    });
    mockStabilityMonitoring.getStabilityStatus.mockResolvedValue({
      isHealthy: true,
      issues: [],
      recommendations: [],
      severity: 'low',
    });
    mockStabilityMonitoring.getStabilityThresholds.mockResolvedValue({
      maxCrashFrequency: 5,
      maxErrorRate: 0.1,
      minPerformanceScore: 70,
      minStabilityScore: 80,
      maxMemoryUsage: 100 * 1024 * 1024,
      maxRenderTime: 16.67,
    });
    mockStabilityMonitoring.updateStabilityThresholds.mockResolvedValue();
    mockStabilityMonitoring.getPerformanceHistory.mockResolvedValue([]);
    mockStabilityMonitoring.exportStabilityData.mockResolvedValue('{"test": "data"}');
    mockStabilityMonitoring.clearStabilityData.mockResolvedValue();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = store.getState().stability;
      
      expect(state).toEqual({
        metrics: null,
        status: null,
        thresholds: null,
        performanceHistory: [],
        isMonitoring: false,
        loading: false,
        error: null,
        lastUpdated: null,
        alertsEnabled: true,
        notifications: [],
      });
    });
  });

  describe('Synchronous Actions', () => {
    it('should set monitoring state', () => {
      store.dispatch(setMonitoring(true));
      
      const state = store.getState().stability;
      expect(state.isMonitoring).toBe(true);
    });

    it('should clear error', () => {
      store.dispatch(clearError());
      
      const state = store.getState().stability;
      expect(state.error).toBeNull();
    });

    it('should set alerts enabled', () => {
      store.dispatch(setAlertsEnabled(false));
      
      const state = store.getState().stability;
      expect(state.alertsEnabled).toBe(false);
    });

    it('should add notification', () => {
      const notification = {
        type: 'warning' as const,
        message: 'Test notification',
      };
      
      store.dispatch(addNotification(notification));
      
      const state = store.getState().stability;
      expect(state.notifications).toHaveLength(1);
      expect(state.notifications[0].message).toBe('Test notification');
      expect(state.notifications[0].type).toBe('warning');
      expect(state.notifications[0]).toHaveProperty('id');
      expect(state.notifications[0]).toHaveProperty('timestamp');
      expect(state.notifications[0].dismissed).toBe(false);
    });

    it('should dismiss notification', () => {
      const notification = {
        type: 'warning' as const,
        message: 'Test notification',
      };
      
      store.dispatch(addNotification(notification));
      const state1 = store.getState().stability;
      const notificationId = state1.notifications[0].id;
      
      store.dispatch(dismissNotification(notificationId));
      
      const state2 = store.getState().stability;
      expect(state2.notifications[0].dismissed).toBe(true);
    });

    it('should clear all notifications', () => {
      store.dispatch(addNotification({ type: 'warning', message: 'Test 1' }));
      store.dispatch(addNotification({ type: 'error', message: 'Test 2' }));
      
      expect(store.getState().stability.notifications).toHaveLength(2);
      
      store.dispatch(clearAllNotifications());
      
      const state = store.getState().stability;
      expect(state.notifications).toHaveLength(0);
    });

    it('should update metrics locally', () => {
      const metrics = {
        uptime: 300000,
        sessionDuration: 300000,
        crashFrequency: 0,
        errorRate: 0.01,
        performanceScore: 90,
        stabilityScore: 95,
        lastUpdated: Date.now(),
      };
      
      store.dispatch(updateMetricsLocal(metrics));
      
      const state = store.getState().stability;
      expect(state.metrics).toEqual(metrics);
      expect(state.lastUpdated).toBeTruthy();
    });

    it('should update status locally', () => {
      const status = {
        isHealthy: false,
        issues: ['Test issue'],
        recommendations: ['Test recommendation'],
        severity: 'medium' as const,
      };
      
      store.dispatch(updateStatusLocal(status));
      
      const state = store.getState().stability;
      expect(state.status).toEqual(status);
    });

    it('should update status locally and generate notification when unhealthy', () => {
      store.dispatch(setAlertsEnabled(true));
      
      const status = {
        isHealthy: false,
        issues: ['High crash frequency'],
        recommendations: ['Fix crashes'],
        severity: 'critical' as const,
      };
      
      store.dispatch(updateStatusLocal(status));
      
      const state = store.getState().stability;
      expect(state.status).toEqual(status);
      expect(state.notifications).toHaveLength(1);
      expect(state.notifications[0].type).toBe('critical');
      expect(state.notifications[0].message).toContain('High crash frequency');
    });

    it('should not generate notification when alerts disabled', () => {
      store.dispatch(setAlertsEnabled(false));
      
      const status = {
        isHealthy: false,
        issues: ['High crash frequency'],
        recommendations: ['Fix crashes'],
        severity: 'critical' as const,
      };
      
      store.dispatch(updateStatusLocal(status));
      
      const state = store.getState().stability;
      expect(state.notifications).toHaveLength(0);
    });

    it('should reset stability state', () => {
      // Set some state first
      store.dispatch(setMonitoring(true));
      store.dispatch(addNotification({ type: 'warning', message: 'Test' }));
      
      store.dispatch(resetStabilityState());
      
      const state = store.getState().stability;
      expect(state.metrics).toBeNull();
      expect(state.status).toBeNull();
      expect(state.performanceHistory).toEqual([]);
      expect(state.notifications).toEqual([]);
      expect(state.lastUpdated).toBeNull();
      expect(state.error).toBeNull();
      expect(state.isMonitoring).toBe(false);
    });

    it('should limit notifications to 50', () => {
      // Add 55 notifications
      for (let i = 0; i < 55; i++) {
        store.dispatch(addNotification({ type: 'warning', message: `Test ${i}` }));
      }
      
      const state = store.getState().stability;
      expect(state.notifications).toHaveLength(50);
      expect(state.notifications[0].message).toBe('Test 54'); // Most recent first
    });
  });

  describe('Async Actions', () => {
    describe('initializeStabilityMonitoring', () => {
      it('should initialize successfully', async () => {
        const action = initializeStabilityMonitoring();
        await store.dispatch(action);
        
        const state = store.getState().stability;
        expect(state.loading).toBe(false);
        expect(state.error).toBeNull();
        expect(state.isMonitoring).toBe(true);
        expect(state.metrics).toBeTruthy();
        expect(state.status).toBeTruthy();
        expect(state.thresholds).toBeTruthy();
        expect(state.lastUpdated).toBeTruthy();
      });

      it('should handle initialization failure', async () => {
        mockStabilityMonitoring.initialize.mockRejectedValue(new Error('Init failed'));
        
        const action = initializeStabilityMonitoring();
        await store.dispatch(action);
        
        const state = store.getState().stability;
        expect(state.loading).toBe(false);
        expect(state.error).toBe('Stability monitoring initialization failed');
        expect(state.isMonitoring).toBe(false);
      });
    });

    describe('updateStabilityMetrics', () => {
      it('should update metrics successfully', async () => {
        const action = updateStabilityMetrics();
        await store.dispatch(action);
        
        const state = store.getState().stability;
        expect(state.loading).toBe(false);
        expect(state.error).toBeNull();
        expect(state.metrics).toBeTruthy();
        expect(state.status).toBeTruthy();
        expect(state.lastUpdated).toBeTruthy();
      });

      it('should handle metrics update failure', async () => {
        mockStabilityMonitoring.getStabilityMetrics.mockRejectedValue(new Error('Update failed'));
        
        const action = updateStabilityMetrics();
        await store.dispatch(action);
        
        const state = store.getState().stability;
        expect(state.loading).toBe(false);
        expect(state.error).toBe('Failed to update stability metrics');
      });

      it('should handle missing metrics', async () => {
        mockStabilityMonitoring.getStabilityMetrics.mockResolvedValue(null);
        
        const action = updateStabilityMetrics();
        await store.dispatch(action);
        
        const state = store.getState().stability;
        expect(state.loading).toBe(false);
        expect(state.error).toBe('No stability metrics available');
      });

      it('should generate notification for unhealthy status', async () => {
        mockStabilityMonitoring.getStabilityStatus.mockResolvedValue({
          isHealthy: false,
          issues: ['High error rate'],
          recommendations: ['Fix errors'],
          severity: 'high',
        });
        
        const action = updateStabilityMetrics();
        await store.dispatch(action);
        
        const state = store.getState().stability;
        expect(state.notifications).toHaveLength(1);
        expect(state.notifications[0].type).toBe('error');
        expect(state.notifications[0].message).toContain('High error rate');
      });
    });

    describe('updateStabilityThresholds', () => {
      it('should update thresholds successfully', async () => {
        const newThresholds = {
          maxCrashFrequency: 3,
          minPerformanceScore: 80,
        };
        
        const action = updateStabilityThresholds(newThresholds);
        await store.dispatch(action);
        
        const state = store.getState().stability;
        expect(state.loading).toBe(false);
        expect(state.error).toBeNull();
        expect(state.thresholds).toBeTruthy();
        expect(mockStabilityMonitoring.updateStabilityThresholds).toHaveBeenCalledWith(newThresholds);
      });

      it('should handle thresholds update failure', async () => {
        mockStabilityMonitoring.updateStabilityThresholds.mockRejectedValue(new Error('Update failed'));
        
        const action = updateStabilityThresholds({ maxCrashFrequency: 3 });
        await store.dispatch(action);
        
        const state = store.getState().stability;
        expect(state.loading).toBe(false);
        expect(state.error).toBe('Failed to update stability thresholds');
      });
    });

    describe('loadPerformanceHistory', () => {
      it('should load performance history successfully', async () => {
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
        
        mockStabilityMonitoring.getPerformanceHistory.mockResolvedValue(mockHistory);
        
        const action = loadPerformanceHistory();
        await store.dispatch(action);
        
        const state = store.getState().stability;
        expect(state.loading).toBe(false);
        expect(state.error).toBeNull();
        expect(state.performanceHistory).toEqual(mockHistory);
      });

      it('should handle performance history load failure', async () => {
        mockStabilityMonitoring.getPerformanceHistory.mockRejectedValue(new Error('Load failed'));
        
        const action = loadPerformanceHistory();
        await store.dispatch(action);
        
        const state = store.getState().stability;
        expect(state.loading).toBe(false);
        expect(state.error).toBe('Failed to load performance history');
      });
    });

    describe('exportStabilityData', () => {
      it('should export data successfully', async () => {
        const action = exportStabilityData();
        await store.dispatch(action);
        
        const state = store.getState().stability;
        expect(state.loading).toBe(false);
        expect(state.error).toBeNull();
        expect(mockStabilityMonitoring.exportStabilityData).toHaveBeenCalled();
      });

      it('should handle export failure', async () => {
        mockStabilityMonitoring.exportStabilityData.mockRejectedValue(new Error('Export failed'));
        
        const action = exportStabilityData();
        await store.dispatch(action);
        
        const state = store.getState().stability;
        expect(state.loading).toBe(false);
        expect(state.error).toBe('Failed to export stability data');
      });
    });

    describe('clearStabilityData', () => {
      it('should clear data successfully', async () => {
        // Set some state first
        store.dispatch(setMonitoring(true));
        store.dispatch(addNotification({ type: 'warning', message: 'Test' }));
        
        const action = clearStabilityData();
        await store.dispatch(action);
        
        const state = store.getState().stability;
        expect(state.loading).toBe(false);
        expect(state.error).toBeNull();
        expect(state.metrics).toBeNull();
        expect(state.status).toBeNull();
        expect(state.performanceHistory).toEqual([]);
        expect(state.notifications).toEqual([]);
        expect(state.lastUpdated).toBeNull();
        expect(mockStabilityMonitoring.clearStabilityData).toHaveBeenCalled();
      });

      it('should handle clear failure', async () => {
        mockStabilityMonitoring.clearStabilityData.mockRejectedValue(new Error('Clear failed'));
        
        const action = clearStabilityData();
        await store.dispatch(action);
        
        const state = store.getState().stability;
        expect(state.loading).toBe(false);
        expect(state.error).toBe('Failed to clear stability data');
      });
    });
  });

  describe('Loading States', () => {
    it('should set loading state during async operations', async () => {
      // Mock a slow async operation
      let resolveInit: () => void;
      const slowInit = new Promise<void>((resolve) => {
        resolveInit = resolve;
      });
      mockStabilityMonitoring.initialize.mockReturnValue(slowInit);
      
      const action = initializeStabilityMonitoring();
      const promise = store.dispatch(action);
      
      // Check loading state
      let state = store.getState().stability;
      expect(state.loading).toBe(true);
      
      // Resolve the promise
      resolveInit();
      await promise;
      
      // Check final state
      state = store.getState().stability;
      expect(state.loading).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle custom error messages', async () => {
      mockStabilityMonitoring.initialize.mockRejectedValue(new Error('Custom error message'));
      
      const action = initializeStabilityMonitoring();
      await store.dispatch(action);
      
      const state = store.getState().stability;
      expect(state.error).toBe('Custom error message');
    });

    it('should handle unknown errors', async () => {
      mockStabilityMonitoring.initialize.mockRejectedValue('Unknown error');
      
      const action = initializeStabilityMonitoring();
      await store.dispatch(action);
      
      const state = store.getState().stability;
      expect(state.error).toBe('Stability monitoring initialization failed');
    });
  });
});