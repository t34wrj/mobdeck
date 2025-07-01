import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../components/ui/Text';
import { Button } from '../../components/ui/Button';
import { theme } from '../../components/ui/theme';
import { MainScreenProps } from '../../navigation/types';
import { RootState } from '../../store';
import {
  updateSyncConfig,
  resetSyncConfig,
} from '../../store/slices/syncSlice';
import { logoutUser } from '../../store/slices/authSlice';
import { SyncSettings } from '../../components/SyncSettings';

type SettingsScreenProps = MainScreenProps<'Settings'>;

interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
}

const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  children,
}) => (
  <View style={styles.section}>
    <Text variant='h5' style={styles.sectionTitle}>
      {title}
    </Text>
    <View style={styles.sectionContent}>{children}</View>
  </View>
);

interface SettingsRowProps {
  label: string;
  value?: string;
  children?: React.ReactNode;
  onPress?: () => void;
}

const SettingsRow: React.FC<SettingsRowProps> = ({
  label,
  value,
  children,
  onPress,
}) => (
  <TouchableOpacity
    style={styles.settingsRow}
    onPress={onPress}
    disabled={!onPress}
    activeOpacity={onPress ? 0.7 : 1}
  >
    <View style={styles.settingsRowContent}>
      <Text variant='body1' style={styles.settingsLabel}>
        {label}
      </Text>
      {value && (
        <Text variant='body2' style={styles.settingsValue}>
          {value}
        </Text>
      )}
    </View>
    {children && <View style={styles.settingsControl}>{children}</View>}
  </TouchableOpacity>
);

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  navigation,
}) => {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();

  const { user, loading: authLoading } = useSelector(
    (state: RootState) => state.auth
  );
  const { config: syncConfig, stats } = useSelector(
    (state: RootState) => state.sync
  );

  const [customSyncInterval, setCustomSyncInterval] = useState(
    syncConfig.syncInterval.toString()
  );
  const [showAdvancedSync, setShowAdvancedSync] = useState(false);

  // Sync configuration handlers
  const handleBackgroundSyncToggle = useCallback(
    (value: boolean) => {
      dispatch(updateSyncConfig({ config: { backgroundSyncEnabled: value } }));
    },
    [dispatch]
  );

  const handleWifiOnlyToggle = useCallback(
    (value: boolean) => {
      dispatch(
        updateSyncConfig({
          config: { syncOnWifiOnly: value, syncOnCellular: !value },
        })
      );
    },
    [dispatch]
  );

  const handleDownloadImagesToggle = useCallback(
    (value: boolean) => {
      dispatch(updateSyncConfig({ config: { downloadImages: value } }));
    },
    [dispatch]
  );

  const handleFullTextSyncToggle = useCallback(
    (value: boolean) => {
      dispatch(updateSyncConfig({ config: { fullTextSync: value } }));
    },
    [dispatch]
  );

  const handleSyncIntervalChange = useCallback(() => {
    const interval = parseInt(customSyncInterval, 10);
    if (isNaN(interval) || interval < 1) {
      Alert.alert(
        'Invalid Interval',
        'Please enter a valid sync interval (minimum 1 minute)'
      );
      setCustomSyncInterval(syncConfig.syncInterval.toString());
      return;
    }

    if (interval > 1440) {
      Alert.alert(
        'Invalid Interval',
        'Sync interval cannot exceed 24 hours (1440 minutes)'
      );
      setCustomSyncInterval(syncConfig.syncInterval.toString());
      return;
    }

    dispatch(updateSyncConfig({ config: { syncInterval: interval } }));
  }, [customSyncInterval, dispatch, syncConfig.syncInterval]);

  const handleResetSyncSettings = useCallback(() => {
    Alert.alert(
      'Reset Sync Settings',
      'Are you sure you want to reset all sync settings to default values?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            dispatch(resetSyncConfig());
            setCustomSyncInterval('15');
          },
        },
      ]
    );
  }, [dispatch]);

  // Account management handlers
  const handleLogout = useCallback(() => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout? You will need to enter your credentials again to access your articles.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => dispatch(logoutUser()),
        },
      ]
    );
  }, [dispatch]);

  const formatLastSync = () => {
    if (!stats.lastSyncDuration) return 'Never';
    const duration = Math.round(stats.lastSyncDuration / 1000);
    return `${duration}s ago`;
  };

  const formatDataTransfer = () => {
    const { bytesDownloaded, bytesUploaded } = stats.dataTransfer;
    const totalMB = (bytesDownloaded + bytesUploaded) / (1024 * 1024);
    return totalMB > 0.1 ? `${totalMB.toFixed(1)} MB` : '< 0.1 MB';
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Account Information */}
        <SettingsSection title='Account'>
          <SettingsRow
            label='Server URL'
            value={user?.serverUrl || 'Not connected'}
          />
          <SettingsRow
            label='Username'
            value={user?.username || 'Not logged in'}
          />
          <SettingsRow
            label='Last Login'
            value={
              user?.lastLoginAt
                ? new Date(user.lastLoginAt).toLocaleDateString()
                : 'Never'
            }
          />
          <View style={styles.buttonContainer}>
            <Button
              variant='destructive'
              onPress={handleLogout}
              loading={authLoading}
              fullWidth
            >
              Logout
            </Button>
          </View>
        </SettingsSection>

        {/* Sync Settings */}
        <SettingsSection title='Sync Settings'>
          <SyncSettings />

          <SettingsRow label='Background Sync'>
            <Switch
              value={syncConfig.backgroundSyncEnabled}
              onValueChange={handleBackgroundSyncToggle}
              trackColor={{
                false: theme.colors.neutral[300],
                true: theme.colors.primary[200],
              }}
              thumbColor={
                syncConfig.backgroundSyncEnabled
                  ? theme.colors.primary[500]
                  : theme.colors.neutral[400]
              }
            />
          </SettingsRow>

          <SettingsRow label='WiFi Only'>
            <Switch
              value={syncConfig.syncOnWifiOnly}
              onValueChange={handleWifiOnlyToggle}
              trackColor={{
                false: theme.colors.neutral[300],
                true: theme.colors.primary[200],
              }}
              thumbColor={
                syncConfig.syncOnWifiOnly
                  ? theme.colors.primary[500]
                  : theme.colors.neutral[400]
              }
            />
          </SettingsRow>

          <SettingsRow label='Download Images'>
            <Switch
              value={syncConfig.downloadImages}
              onValueChange={handleDownloadImagesToggle}
              trackColor={{
                false: theme.colors.neutral[300],
                true: theme.colors.primary[200],
              }}
              thumbColor={
                syncConfig.downloadImages
                  ? theme.colors.primary[500]
                  : theme.colors.neutral[400]
              }
            />
          </SettingsRow>

          <SettingsRow label='Full Text Sync'>
            <Switch
              value={syncConfig.fullTextSync}
              onValueChange={handleFullTextSyncToggle}
              trackColor={{
                false: theme.colors.neutral[300],
                true: theme.colors.primary[200],
              }}
              thumbColor={
                syncConfig.fullTextSync
                  ? theme.colors.primary[500]
                  : theme.colors.neutral[400]
              }
            />
          </SettingsRow>

          <View style={styles.syncIntervalContainer}>
            <Text variant='body1' style={styles.settingsLabel}>
              Sync Interval (minutes)
            </Text>
            <View style={styles.syncIntervalInput}>
              <TextInput
                style={styles.textInput}
                value={customSyncInterval}
                onChangeText={setCustomSyncInterval}
                onBlur={handleSyncIntervalChange}
                keyboardType='numeric'
                placeholder='15'
                maxLength={4}
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.advancedToggle}
            onPress={() => setShowAdvancedSync(!showAdvancedSync)}
          >
            <Text variant='body2' style={styles.advancedToggleText}>
              {showAdvancedSync ? 'Hide' : 'Show'} Advanced Settings
            </Text>
          </TouchableOpacity>

          {showAdvancedSync && (
            <View style={styles.advancedSettings}>
              <SettingsRow
                label='Batch Size'
                value={`${syncConfig.batchSize} articles`}
              />
              <SettingsRow
                label='Conflict Resolution'
                value={syncConfig.conflictResolutionStrategy
                  .replace('_', ' ')
                  .toLowerCase()}
              />
              <View style={styles.buttonContainer}>
                <Button
                  variant='outline'
                  onPress={handleResetSyncSettings}
                  fullWidth
                >
                  Reset to Defaults
                </Button>
              </View>
            </View>
          )}
        </SettingsSection>

        {/* Sync Statistics */}
        <SettingsSection title='Sync Statistics'>
          <SettingsRow
            label='Total Syncs'
            value={stats.totalSyncs.toString()}
          />
          <SettingsRow
            label='Successful Syncs'
            value={stats.successfulSyncs.toString()}
          />
          <SettingsRow
            label='Failed Syncs'
            value={stats.failedSyncs.toString()}
          />
          <SettingsRow label='Last Sync' value={formatLastSync()} />
          <SettingsRow label='Data Transferred' value={formatDataTransfer()} />
          <SettingsRow
            label='Articles Synced'
            value={`${stats.itemsSynced.articlesCreated + stats.itemsSynced.articlesUpdated} total`}
          />
        </SettingsSection>

        {/* App Information */}
        <SettingsSection title='About'>
          <SettingsRow label='App Version' value='1.0.0' />
          <SettingsRow label='Build' value='Development' />
        </SettingsSection>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.neutral[100],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: theme.spacing[6],
  },
  section: {
    marginBottom: theme.spacing[6],
  },
  sectionTitle: {
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
    backgroundColor: theme.colors.neutral[200],
    color: theme.colors.neutral[800],
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.neutral[300],
  },
  sectionContent: {
    backgroundColor: theme.colors.neutral[50],
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.neutral[200],
    minHeight: 56,
  },
  settingsRowContent: {
    flex: 1,
    marginRight: theme.spacing[3],
  },
  settingsLabel: {
    color: theme.colors.neutral[900],
    marginBottom: theme.spacing[1],
  },
  settingsValue: {
    color: theme.colors.neutral[600],
  },
  settingsControl: {
    flexShrink: 0,
  },
  buttonContainer: {
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
  },
  syncIntervalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.neutral[200],
  },
  syncIntervalInput: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textInput: {
    borderWidth: 1,
    borderColor: theme.colors.neutral[300],
    borderRadius: theme.borderRadius.base,
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[2],
    minWidth: 80,
    textAlign: 'center',
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.neutral[900],
    backgroundColor: theme.colors.neutral[50],
  },
  advancedToggle: {
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
    alignItems: 'center',
  },
  advancedToggleText: {
    color: theme.colors.primary[600],
    textDecorationLine: 'underline',
  },
  advancedSettings: {
    backgroundColor: theme.colors.neutral[100],
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.neutral[300],
  },
});

export default SettingsScreen;
