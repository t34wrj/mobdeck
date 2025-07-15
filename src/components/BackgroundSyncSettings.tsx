/**
 * BackgroundSyncSettings - Settings Component for Background Sync
 *
 * Provides UI controls for configuring background sync preferences
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from 'react-native';
import { useBackgroundSync, SYNC_INTERVALS } from '../hooks/useBackgroundSync';
import { theme } from "../../components/theme"';

interface SyncIntervalOption {
  label: string;
  value: number;
}

const SYNC_INTERVAL_OPTIONS: SyncIntervalOption[] = [
  { label: 'Manual Only', value: SYNC_INTERVALS.MANUAL },
  { label: '15 Minutes', value: SYNC_INTERVALS.FIFTEEN_MINUTES },
  { label: '30 Minutes', value: SYNC_INTERVALS.THIRTY_MINUTES },
  { label: '1 Hour', value: SYNC_INTERVALS.ONE_HOUR },
  { label: '2 Hours', value: SYNC_INTERVALS.TWO_HOURS },
];

export default function BackgroundSyncSettings() {
  const {
    isEnabled,
    syncInterval,
    isWifiOnly,
    isSyncing,
    lastSyncTime,
    nextSyncTime,
    setEnabled,
    setSyncInterval,
    setWifiOnly,
    triggerManualSync,
    getSyncHistory,
  } = useBackgroundSync();

  const [syncHistory, setSyncHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const loadSyncHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const history = await getSyncHistory();
      setSyncHistory(history);
    } catch (error) {
      console.error('Failed to load sync history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [getSyncHistory]);

  // Load sync history on component mount
  useEffect(() => {
    loadSyncHistory();
  }, [loadSyncHistory]);

  const handleToggleEnabled = async (enabled: boolean) => {
    try {
      await setEnabled(enabled);
    } catch (error) {
      Alert.alert('Error', 'Failed to update background sync setting');
    }
  };

  const handleSyncIntervalChange = async (interval: number) => {
    try {
      await setSyncInterval(interval);
    } catch (error) {
      Alert.alert('Error', 'Failed to update sync interval');
    }
  };

  const handleToggleWifiOnly = async (wifiOnly: boolean) => {
    try {
      await setWifiOnly(wifiOnly);
    } catch (error) {
      Alert.alert('Error', 'Failed to update WiFi-only setting');
    }
  };

  const handleManualSync = async () => {
    try {
      await triggerManualSync();
      Alert.alert('Success', 'Manual sync started');
      // Reload history after sync
      setTimeout(loadSyncHistory, 2000);
    } catch (error) {
      Alert.alert('Error', 'Failed to start manual sync');
    }
  };

  const formatTime = (timeString: string | null) => {
    if (!timeString) return 'Never';
    return new Date(timeString).toLocaleString();
  };

  const getCurrentIntervalLabel = () => {
    const option = SYNC_INTERVAL_OPTIONS.find(
      opt => opt.value === syncInterval
    );
    return option?.label || 'Unknown';
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Background Sync Settings</Text>

      {/* Enable/Disable Background Sync */}
      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>Enable Background Sync</Text>
        <Switch
          value={isEnabled}
          onValueChange={handleToggleEnabled}
          disabled={isSyncing}
        />
      </View>

      {/* Sync Interval */}
      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>Sync Interval</Text>
        <Text style={styles.settingValue}>{getCurrentIntervalLabel()}</Text>
      </View>

      {/* Sync Interval Options */}
      {isEnabled && (
        <View style={styles.intervalOptions}>
          {SYNC_INTERVAL_OPTIONS.map(option => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.intervalOption,
                syncInterval === option.value && styles.selectedOption,
              ]}
              onPress={() => handleSyncIntervalChange(option.value)}
              disabled={isSyncing}
            >
              <Text
                style={[
                  styles.intervalOptionText,
                  syncInterval === option.value && styles.selectedOptionText,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* WiFi Only */}
      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>WiFi Only</Text>
        <Switch
          value={isWifiOnly}
          onValueChange={handleToggleWifiOnly}
          disabled={!isEnabled || isSyncing}
        />
      </View>

      {/* Sync Status */}
      <View style={styles.statusSection}>
        <Text style={styles.sectionTitle}>Sync Status</Text>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Currently Syncing:</Text>
          <Text style={styles.statusValue}>{isSyncing ? 'Yes' : 'No'}</Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Last Sync:</Text>
          <Text style={styles.statusValue}>{formatTime(lastSyncTime)}</Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Next Sync:</Text>
          <Text style={styles.statusValue}>
            {syncInterval === SYNC_INTERVALS.MANUAL
              ? 'Manual Only'
              : formatTime(nextSyncTime)}
          </Text>
        </View>
      </View>

      {/* Manual Sync Button */}
      <TouchableOpacity
        style={[styles.manualSyncButton, isSyncing && styles.disabledButton]}
        onPress={handleManualSync}
        disabled={isSyncing}
      >
        <Text style={styles.manualSyncButtonText}>
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </Text>
      </TouchableOpacity>

      {/* Sync History */}
      <View style={styles.historySection}>
        <View style={styles.historyHeader}>
          <Text style={styles.sectionTitle}>Recent Sync History</Text>
          <TouchableOpacity
            onPress={loadSyncHistory}
            disabled={isLoadingHistory}
          >
            <Text style={styles.refreshButton}>
              {isLoadingHistory ? 'Loading...' : 'Refresh'}
            </Text>
          </TouchableOpacity>
        </View>

        {syncHistory.slice(0, 5).map((entry, index) => (
          <View key={index} style={styles.historyEntry}>
            <Text style={styles.historyTime}>
              {formatTime(entry.timestamp)}
            </Text>
            <Text
              style={[
                styles.historyStatus,
                entry.success ? styles.successStatus : styles.errorStatus,
              ]}
            >
              {entry.success ? '✓ Success' : '✗ Failed'}
            </Text>
            <Text style={styles.historyDetails}>
              {entry.success
                ? `${entry.itemsSynced} items in ${entry.duration}ms`
                : entry.error || 'Unknown error'}
            </Text>
          </View>
        ))}

        {syncHistory.length === 0 && !isLoadingHistory && (
          <Text style={styles.noHistory}>No sync history available</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.neutral[200],
  },
  settingLabel: {
    fontSize: 16,
    color: theme.colors.neutral[700],
  },
  settingValue: {
    fontSize: 16,
    color: theme.colors.neutral[500],
  },
  intervalOptions: {
    marginVertical: 10,
  },
  intervalOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginVertical: 2,
    borderRadius: 6,
    backgroundColor: theme.colors.neutral[100],
  },
  selectedOption: {
    backgroundColor: theme.colors.primary[500],
  },
  intervalOptionText: {
    fontSize: 14,
    color: theme.colors.neutral[700],
  },
  selectedOptionText: {
    color: theme.colors.neutral[50],
  },
  statusSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: theme.colors.neutral[200],
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  statusLabel: {
    fontSize: 14,
    color: theme.colors.neutral[500],
  },
  statusValue: {
    fontSize: 14,
    color: theme.colors.neutral[700],
    fontWeight: '500',
  },
  manualSyncButton: {
    backgroundColor: theme.colors.primary[500],
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  disabledButton: {
    backgroundColor: theme.colors.neutral[400],
  },
  manualSyncButtonText: {
    color: theme.colors.neutral[50],
    fontSize: 16,
    fontWeight: '600',
  },
  historySection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: theme.colors.neutral[200],
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  refreshButton: {
    color: theme.colors.primary[500],
    fontSize: 14,
  },
  historyEntry: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.neutral[100],
  },
  historyTime: {
    fontSize: 12,
    color: theme.colors.neutral[500],
  },
  historyStatus: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  successStatus: {
    color: theme.colors.success[700],
  },
  errorStatus: {
    color: theme.colors.error[500],
  },
  historyDetails: {
    fontSize: 12,
    color: theme.colors.neutral[400],
    marginTop: 2,
  },
  noHistory: {
    fontSize: 14,
    color: theme.colors.neutral[400],
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
});
