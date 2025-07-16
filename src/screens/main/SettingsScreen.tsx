import React from 'react';
import { View, StyleSheet, ScrollView, TextInput, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../components/theme';
import { MainScreenProps } from '../../navigation/types';
import { useSettingsHandlers } from '../../hooks/useSettingsHandlers';
import { useSettingsData } from '../../hooks/useSettingsData';
import { AppInfoSection } from '../../components/AppInfoSection';
import { SettingsSection } from '../../components/SettingsSection';
import { SettingsRow } from '../../components/SettingsComponents';
import { SyncSettings } from '../../components/SyncSettings';
import { SimpleText as Text } from '../../components/SimpleText';
import { SimpleButton as Button } from '../../components/SimpleButton';

type SettingsScreenProps = MainScreenProps<'Settings'>;

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  navigation: _navigation,
}) => {
  const insets = useSafeAreaInsets();
  const {
    user,
    authLoading,
    syncConfig,
    stats,
    formatLastSync,
    formatDataTransfer,
  } = useSettingsData();

  const {
    customSyncInterval,
    setCustomSyncInterval,
    handleBackgroundSyncToggle,
    handleWifiOnlyToggle,
    handleDownloadImagesToggle,
    handleFullTextSyncToggle,
    handleSyncIntervalChange,
    handleResetSyncSettings,
    handleLogout,
  } = useSettingsHandlers();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Account Information */}
        <SettingsSection title='Account'>
          <SettingsRow label='User' value={user?.username || 'Not logged in'} />
          <SettingsRow
            label='Server'
            value={user?.serverUrl || 'Not configured'}
          />
          <SettingsRow label='Logout'>
            <Button
              variant='outline'
              size='sm'
              onPress={handleLogout}
              disabled={authLoading}
            >
              <Text>Logout</Text>
            </Button>
          </SettingsRow>
        </SettingsSection>

        {/* Sync Settings */}
        <SyncSettings />

        {/* Sync Configuration */}
        <SettingsSection title='Sync Configuration'>
          <SettingsRow
            label='Sync Interval (minutes)'
            value={`${syncConfig.syncInterval} minutes`}
          >
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={customSyncInterval}
                onChangeText={setCustomSyncInterval}
                onBlur={handleSyncIntervalChange}
                keyboardType='numeric'
                placeholder='15'
              />
            </View>
          </SettingsRow>

          <SettingsRow label='Background Sync'>
            <Switch
              value={syncConfig.backgroundSyncEnabled}
              onValueChange={handleBackgroundSyncToggle}
            />
          </SettingsRow>

          <SettingsRow label='WiFi Only'>
            <Switch
              value={syncConfig.syncOnWifiOnly}
              onValueChange={handleWifiOnlyToggle}
            />
          </SettingsRow>

          <SettingsRow label='Download Images'>
            <Switch
              value={syncConfig.downloadImages}
              onValueChange={handleDownloadImagesToggle}
            />
          </SettingsRow>

          <SettingsRow label='Full Text Sync'>
            <Switch
              value={syncConfig.fullTextSync}
              onValueChange={handleFullTextSyncToggle}
            />
          </SettingsRow>

          <SettingsRow label='Reset Settings'>
            <Button
              variant='outline'
              size='sm'
              onPress={handleResetSyncSettings}
            >
              <Text>Reset</Text>
            </Button>
          </SettingsRow>
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
            value={`${stats.articlesSynced} total`}
          />
        </SettingsSection>

        <AppInfoSection />
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
  inputContainer: {
    minWidth: 80,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.neutral[300],
    borderRadius: theme.borderRadius.base,
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[2],
    backgroundColor: theme.colors.neutral[50],
    textAlign: 'center',
    fontSize: theme.typography.fontSize.sm,
  },
});

export default SettingsScreen;
