import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { logger } from '../../utils/logger';
import { 
  stabilityMonitoring, 
  StabilityMetrics, 
  StabilityStatus, 
  StabilityThresholds, 
  PerformanceMetrics 
} from '../../utils/stabilityMonitoring';

export interface StabilityState {
  metrics: StabilityMetrics | null;
  status: StabilityStatus | null;
  thresholds: StabilityThresholds | null;
  performanceHistory: PerformanceMetrics[];
  isMonitoring: boolean;
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
  alertsEnabled: boolean;
  notifications: StabilityNotification[];
}

export interface StabilityNotification {
  id: string;
  type: 'warning' | 'error' | 'critical';
  message: string;
  timestamp: number;
  dismissed: boolean;
}

const initialState: StabilityState = {
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
};

export const initializeStabilityMonitoring = createAsyncThunk<
  { metrics: StabilityMetrics | null; status: StabilityStatus; thresholds: StabilityThresholds },
  void,
  { rejectValue: string }
>('stability/initialize', async (_, { rejectWithValue }) => {
  try {
    logger.info('Initializing stability monitoring');
    
    // Initialize the monitoring service
    await stabilityMonitoring.initialize();
    
    // Get initial data
    const [metrics, status, thresholds] = await Promise.all([
      stabilityMonitoring.getStabilityMetrics(),
      stabilityMonitoring.getStabilityStatus(),
      stabilityMonitoring.getStabilityThresholds(),
    ]);
    
    logger.info('Stability monitoring initialized successfully');
    return { metrics, status, thresholds };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Stability monitoring initialization failed';
    logger.error('Failed to initialize stability monitoring:', error);
    return rejectWithValue(errorMessage);
  }
});

export const updateStabilityMetrics = createAsyncThunk<
  { metrics: StabilityMetrics; status: StabilityStatus },
  void,
  { rejectValue: string }
>('stability/updateMetrics', async (_, { rejectWithValue }) => {
  try {
    const [metrics, status] = await Promise.all([
      stabilityMonitoring.getStabilityMetrics(),
      stabilityMonitoring.getStabilityStatus(),
    ]);
    
    if (!metrics) {
      throw new Error('No stability metrics available');
    }
    
    return { metrics, status };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to update stability metrics';
    logger.error('Failed to update stability metrics:', error);
    return rejectWithValue(errorMessage);
  }
});

export const updateStabilityThresholds = createAsyncThunk<
  StabilityThresholds,
  Partial<StabilityThresholds>,
  { rejectValue: string }
>('stability/updateThresholds', async (newThresholds, { rejectWithValue }) => {
  try {
    await stabilityMonitoring.updateStabilityThresholds(newThresholds);
    const updatedThresholds = await stabilityMonitoring.getStabilityThresholds();
    
    logger.info('Stability thresholds updated', newThresholds);
    return updatedThresholds;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to update stability thresholds';
    logger.error('Failed to update stability thresholds:', error);
    return rejectWithValue(errorMessage);
  }
});

export const loadPerformanceHistory = createAsyncThunk<
  PerformanceMetrics[],
  void,
  { rejectValue: string }
>('stability/loadPerformanceHistory', async (_, { rejectWithValue }) => {
  try {
    const history = await stabilityMonitoring.getPerformanceHistory();
    return history;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load performance history';
    logger.error('Failed to load performance history:', error);
    return rejectWithValue(errorMessage);
  }
});

export const exportStabilityData = createAsyncThunk<
  string,
  void,
  { rejectValue: string }
>('stability/exportData', async (_, { rejectWithValue }) => {
  try {
    const exportData = await stabilityMonitoring.exportStabilityData();
    logger.info('Stability data exported successfully');
    return exportData;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to export stability data';
    logger.error('Failed to export stability data:', error);
    return rejectWithValue(errorMessage);
  }
});

export const clearStabilityData = createAsyncThunk<
  void,
  void,
  { rejectValue: string }
>('stability/clearData', async (_, { rejectWithValue }) => {
  try {
    await stabilityMonitoring.clearStabilityData();
    logger.info('Stability data cleared successfully');
    return undefined;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to clear stability data';
    logger.error('Failed to clear stability data:', error);
    return rejectWithValue(errorMessage);
  }
});

const stabilitySlice = createSlice({
  name: 'stability',
  initialState,
  reducers: {
    setMonitoring: (state, action: PayloadAction<boolean>) => {
      state.isMonitoring = action.payload;
    },
    
    clearError: (state) => {
      state.error = null;
    },
    
    setAlertsEnabled: (state, action: PayloadAction<boolean>) => {
      state.alertsEnabled = action.payload;
    },
    
    addNotification: (state, action: PayloadAction<Omit<StabilityNotification, 'id' | 'timestamp' | 'dismissed'>>) => {
      const notification: StabilityNotification = {
        id: `stability_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        dismissed: false,
        ...action.payload,
      };
      
      state.notifications.unshift(notification);
      
      // Keep only last 50 notifications
      if (state.notifications.length > 50) {
        state.notifications = state.notifications.slice(0, 50);
      }
    },
    
    dismissNotification: (state, action: PayloadAction<string>) => {
      const notification = state.notifications.find(n => n.id === action.payload);
      if (notification) {
        notification.dismissed = true;
      }
    },
    
    clearAllNotifications: (state) => {
      state.notifications = [];
    },
    
    clearDismissedNotifications: (state) => {
      state.notifications = state.notifications.filter(n => !n.dismissed);
    },
    
    updateMetricsLocal: (state, action: PayloadAction<StabilityMetrics>) => {
      state.metrics = action.payload;
      state.lastUpdated = Date.now();
    },
    
    updateStatusLocal: (state, action: PayloadAction<StabilityStatus>) => {
      state.status = action.payload;
      
      // Generate notifications for stability issues
      if (state.alertsEnabled && !action.payload.isHealthy) {
        const notification: StabilityNotification = {
          id: `stability_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: action.payload.severity === 'critical' ? 'critical' : 
                action.payload.severity === 'high' ? 'error' : 'warning',
          message: `Stability issues detected: ${action.payload.issues.join(', ')}`,
          timestamp: Date.now(),
          dismissed: false,
        };
        
        state.notifications.unshift(notification);
        
        // Keep only last 50 notifications
        if (state.notifications.length > 50) {
          state.notifications = state.notifications.slice(0, 50);
        }
      }
    },
    
    updatePerformanceHistory: (state, action: PayloadAction<PerformanceMetrics[]>) => {
      state.performanceHistory = action.payload;
    },
    
    resetStabilityState: (state) => {
      state.metrics = null;
      state.status = null;
      state.performanceHistory = [];
      state.notifications = [];
      state.lastUpdated = null;
      state.error = null;
      state.isMonitoring = false;
    },
  },
  
  extraReducers: (builder) => {
    builder
      // Initialize stability monitoring
      .addCase(initializeStabilityMonitoring.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(initializeStabilityMonitoring.fulfilled, (state, action) => {
        state.loading = false;
        state.metrics = action.payload.metrics;
        state.status = action.payload.status;
        state.thresholds = action.payload.thresholds;
        state.isMonitoring = true;
        state.lastUpdated = Date.now();
        state.error = null;
      })
      .addCase(initializeStabilityMonitoring.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Stability monitoring initialization failed';
        state.isMonitoring = false;
      })
      
      // Update stability metrics
      .addCase(updateStabilityMetrics.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateStabilityMetrics.fulfilled, (state, action) => {
        state.loading = false;
        state.metrics = action.payload.metrics;
        state.status = action.payload.status;
        state.lastUpdated = Date.now();
        state.error = null;
        
        // Generate notifications for stability issues
        if (state.alertsEnabled && !action.payload.status.isHealthy) {
          const notification: StabilityNotification = {
            id: `stability_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: action.payload.status.severity === 'critical' ? 'critical' : 
                  action.payload.status.severity === 'high' ? 'error' : 'warning',
            message: `Stability issues detected: ${action.payload.status.issues.join(', ')}`,
            timestamp: Date.now(),
            dismissed: false,
          };
          
          state.notifications.unshift(notification);
          
          // Keep only last 50 notifications
          if (state.notifications.length > 50) {
            state.notifications = state.notifications.slice(0, 50);
          }
        }
      })
      .addCase(updateStabilityMetrics.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to update stability metrics';
      })
      
      // Update stability thresholds
      .addCase(updateStabilityThresholds.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateStabilityThresholds.fulfilled, (state, action) => {
        state.loading = false;
        state.thresholds = action.payload;
        state.error = null;
      })
      .addCase(updateStabilityThresholds.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to update stability thresholds';
      })
      
      // Load performance history
      .addCase(loadPerformanceHistory.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadPerformanceHistory.fulfilled, (state, action) => {
        state.loading = false;
        state.performanceHistory = action.payload;
        state.error = null;
      })
      .addCase(loadPerformanceHistory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to load performance history';
      })
      
      // Export stability data
      .addCase(exportStabilityData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(exportStabilityData.fulfilled, (state) => {
        state.loading = false;
        state.error = null;
      })
      .addCase(exportStabilityData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to export stability data';
      })
      
      // Clear stability data
      .addCase(clearStabilityData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(clearStabilityData.fulfilled, (state) => {
        state.loading = false;
        state.metrics = null;
        state.status = null;
        state.performanceHistory = [];
        state.notifications = [];
        state.lastUpdated = null;
        state.error = null;
      })
      .addCase(clearStabilityData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to clear stability data';
      });
  },
});

export const {
  setMonitoring,
  clearError,
  setAlertsEnabled,
  addNotification,
  dismissNotification,
  clearAllNotifications,
  clearDismissedNotifications,
  updateMetricsLocal,
  updateStatusLocal,
  updatePerformanceHistory,
  resetStabilityState,
} = stabilitySlice.actions;

export default stabilitySlice.reducer;