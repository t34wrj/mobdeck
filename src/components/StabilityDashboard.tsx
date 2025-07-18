import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { theme } from './theme';
import { useAppDispatch, useAppSelector } from '../store';
import {
  initializeStabilityMonitoring,
  updateStabilityMetrics,
  clearStabilityData,
  exportStabilityData,
  dismissNotification,
  clearDismissedNotifications,
} from '../store/slices/stabilitySlice';
import { StabilityMetrics } from './StabilityMetrics';
import { StabilityAlerts } from './StabilityAlerts';

interface StabilityDashboardProps {
  onClose?: () => void;
}

export const StabilityDashboard: React.FC<StabilityDashboardProps> = ({ onClose }) => {
  const dispatch = useAppDispatch();
  const {
    metrics,
    status,
    thresholds,
    performanceHistory,
    isMonitoring,
    loading,
    error,
    lastUpdated,
    notifications,
  } = useAppSelector(state => state.stability);

  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'metrics' | 'alerts' | 'settings'>('overview');

  useEffect(() => {
    if (!isMonitoring) {
      dispatch(initializeStabilityMonitoring());
    }
  }, [dispatch, isMonitoring]);

  useEffect(() => {
    if (isMonitoring) {
      const interval = setInterval(() => {
        dispatch(updateStabilityMetrics());
      }, 30000); // Update every 30 seconds

      return () => clearInterval(interval);
    }
    return undefined;
  }, [dispatch, isMonitoring]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await dispatch(updateStabilityMetrics()).unwrap();
    } catch (refreshError) {
      console.error('Failed to refresh stability data:', refreshError);
    } finally {
      setRefreshing(false);
    }
  };

  const handleExportData = async () => {
    try {
      const exportData = await dispatch(exportStabilityData()).unwrap();
      Alert.alert(
        'Export Successful',
        'Stability data has been exported to the console',
        [
          {
            text: 'OK',
            onPress: () => console.log('Exported Stability Data:', exportData),
          },
        ]
      );
    } catch {
      Alert.alert('Export Failed', 'Failed to export stability data');
    }
  };

  const handleClearData = () => {
    Alert.alert(
      'Clear Stability Data',
      'Are you sure you want to clear all stability monitoring data? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await dispatch(clearStabilityData()).unwrap();
              Alert.alert('Success', 'Stability data has been cleared');
            } catch {
              Alert.alert('Error', 'Failed to clear stability data');
            }
          },
        },
      ]
    );
  };

  const renderTabBar = (): React.ReactElement => (
    <View style={styles.tabBar}>
      {[
        { key: 'overview', label: 'Overview' },
        { key: 'metrics', label: 'Metrics' },
        { key: 'alerts', label: 'Alerts' },
        { key: 'settings', label: 'Settings' },
      ].map(tab => (
        <TouchableOpacity
          key={tab.key}
          style={[
            styles.tabButton,
            selectedTab === tab.key && styles.tabButtonActive,
          ]}
          onPress={() => setSelectedTab(tab.key as any)}
        >
          <Text
            style={[
              styles.tabButtonText,
              selectedTab === tab.key && styles.tabButtonTextActive,
            ]}
          >
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderOverview = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>App Stability Overview</Text>
      
      {status && (
        <View style={[
          styles.statusCard,
          status.isHealthy ? styles.statusHealthy : styles.statusUnhealthy,
        ]}>
          <Text style={styles.statusTitle}>
            {status.isHealthy ? '✅ Healthy' : '⚠️ Issues Detected'}
          </Text>
          <Text style={styles.statusSeverity}>
            Severity: {status.severity.charAt(0).toUpperCase() + status.severity.slice(1)}
          </Text>
        </View>
      )}

      {metrics && (
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{metrics.stabilityScore.toFixed(1)}</Text>
            <Text style={styles.metricLabel}>Stability Score</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{metrics.performanceScore.toFixed(1)}</Text>
            <Text style={styles.metricLabel}>Performance Score</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{metrics.crashFrequency}</Text>
            <Text style={styles.metricLabel}>Crashes (24h)</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{Math.round(metrics.uptime / 1000 / 60)}m</Text>
            <Text style={styles.metricLabel}>Uptime</Text>
          </View>
        </View>
      )}

      {lastUpdated && (
        <Text style={styles.lastUpdated}>
          Last updated: {new Date(lastUpdated).toLocaleTimeString()}
        </Text>
      )}
    </View>
  );

  const renderMetrics = () => (
    <StabilityMetrics
      metrics={metrics}
      performanceHistory={performanceHistory}
      thresholds={thresholds}
    />
  );

  const renderAlerts = () => (
    <StabilityAlerts
      notifications={notifications}
      onDismiss={(id) => dispatch(dismissNotification(id))}
      onClearDismissed={() => dispatch(clearDismissedNotifications())}
    />
  );

  const renderSettings = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Settings</Text>
      
      <View style={styles.settingsSection}>
        <Text style={styles.settingsLabel}>Data Management</Text>
        <TouchableOpacity style={styles.settingsButton} onPress={handleExportData}>
          <Text style={styles.settingsButtonText}>Export Data</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.settingsButton, styles.settingsButtonDanger]} 
          onPress={handleClearData}
        >
          <Text style={[styles.settingsButtonText, styles.settingsButtonTextDanger]}>
            Clear All Data
          </Text>
        </TouchableOpacity>
      </View>

      {thresholds && (
        <View style={styles.settingsSection}>
          <Text style={styles.settingsLabel}>Current Thresholds</Text>
          <View style={styles.thresholdsList}>
            <Text style={styles.thresholdItem}>
              Max Crash Frequency: {thresholds.maxCrashFrequency}
            </Text>
            <Text style={styles.thresholdItem}>
              Max Error Rate: {(thresholds.maxErrorRate * 100).toFixed(1)}%
            </Text>
            <Text style={styles.thresholdItem}>
              Min Performance Score: {thresholds.minPerformanceScore}
            </Text>
            <Text style={styles.thresholdItem}>
              Min Stability Score: {thresholds.minStabilityScore}
            </Text>
          </View>
        </View>
      )}
    </View>
  );

  const renderContent = (): React.ReactElement => {
    switch (selectedTab) {
      case 'overview':
        return renderOverview();
      case 'metrics':
        return renderMetrics();
      case 'alerts':
        return renderAlerts();
      case 'settings':
        return renderSettings();
      default:
        return renderOverview();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Stability Dashboard</Text>
        {onClose && (
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>×</Text>
          </TouchableOpacity>
        )}
      </View>

      {renderTabBar()}

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary[500]]}
          />
        }
      >
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {loading && !refreshing && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading stability data...</Text>
          </View>
        )}

        {renderContent()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.neutral[50],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing[4],
    backgroundColor: theme.colors.primary[500],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.primary[600],
  },
  title: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.neutral[50],
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: theme.typography.fontSize.xl,
    color: theme.colors.neutral[50],
    fontWeight: theme.typography.fontWeight.bold,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: theme.colors.neutral[100],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.neutral[200],
  },
  tabButton: {
    flex: 1,
    paddingVertical: theme.spacing[3],
    paddingHorizontal: theme.spacing[2],
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: theme.colors.primary[50],
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.primary[500],
  },
  tabButtonText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.neutral[600],
    fontWeight: theme.typography.fontWeight.medium,
  },
  tabButtonTextActive: {
    color: theme.colors.primary[700],
    fontWeight: theme.typography.fontWeight.semibold,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: theme.spacing[4],
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.neutral[900],
    marginBottom: theme.spacing[3],
  },
  statusCard: {
    padding: theme.spacing[4],
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing[4],
  },
  statusHealthy: {
    backgroundColor: theme.colors.success[50],
    borderColor: theme.colors.success[200],
    borderWidth: 1,
  },
  statusUnhealthy: {
    backgroundColor: theme.colors.error[50],
    borderColor: theme.colors.error[200],
    borderWidth: 1,
  },
  statusTitle: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.neutral[900],
    marginBottom: theme.spacing[1],
  },
  statusSeverity: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.neutral[700],
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: theme.spacing[4],
  },
  metricCard: {
    width: '48%',
    backgroundColor: theme.colors.neutral[100],
    padding: theme.spacing[3],
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing[2],
    alignItems: 'center',
  },
  metricValue: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.primary[600],
    marginBottom: theme.spacing[1],
  },
  metricLabel: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.neutral[700],
    textAlign: 'center',
  },
  lastUpdated: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.neutral[500],
    textAlign: 'center',
    fontStyle: 'italic',
  },
  errorContainer: {
    margin: theme.spacing[4],
    padding: theme.spacing[3],
    backgroundColor: theme.colors.error[50],
    borderRadius: theme.borderRadius.md,
    borderColor: theme.colors.error[200],
    borderWidth: 1,
  },
  errorText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.error[700],
    textAlign: 'center',
  },
  loadingContainer: {
    margin: theme.spacing[4],
    padding: theme.spacing[3],
    backgroundColor: theme.colors.info[50],
    borderRadius: theme.borderRadius.md,
    borderColor: theme.colors.info[200],
    borderWidth: 1,
  },
  loadingText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.info[700],
    textAlign: 'center',
  },
  settingsSection: {
    marginBottom: theme.spacing[4],
  },
  settingsLabel: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.neutral[900],
    marginBottom: theme.spacing[2],
  },
  settingsButton: {
    backgroundColor: theme.colors.primary[500],
    paddingVertical: theme.spacing[3],
    paddingHorizontal: theme.spacing[4],
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing[2],
  },
  settingsButtonDanger: {
    backgroundColor: theme.colors.error[500],
  },
  settingsButtonText: {
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.neutral[50],
    textAlign: 'center',
    fontWeight: theme.typography.fontWeight.semibold,
  },
  settingsButtonTextDanger: {
    color: theme.colors.neutral[50],
  },
  thresholdsList: {
    backgroundColor: theme.colors.neutral[100],
    padding: theme.spacing[3],
    borderRadius: theme.borderRadius.md,
  },
  thresholdItem: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.neutral[700],
    marginBottom: theme.spacing[1],
  },
});