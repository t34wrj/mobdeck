import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from "../../components/theme"';
import { MainScreenProps } from '../../navigation/types';
import { useSettingsHandlers } from '../../hooks/useSettingsHandlers';
import { useSettingsData } from '../../hooks/useSettingsData';
import { AccountSection } from '../../components/settings/AccountSection';
import { SyncConfigSection } from '../../components/settings/SyncConfigSection';
import { SyncStatsSection } from '../../components/settings/SyncStatsSection';
import { AppInfoSection } from '../../components/settings/AppInfoSection';

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
    formatDate,
    formatLastSync,
    formatDataTransfer,
  } = useSettingsData();

  const {
    customSyncInterval,
    setCustomSyncInterval,
    showAdvancedSync,
    setShowAdvancedSync,
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
        <AccountSection
          serverUrl={user?.serverUrl || 'Not connected'}
          username={user?.username || 'Not logged in'}
          lastLoginAt={
            user?.lastLoginAt
              ? formatDate(user.lastLoginAt, {
                  includeTime: false,
                  includeYear: true,
                })
              : 'Never'
          }
          onLogout={handleLogout}
          authLoading={authLoading}
        />

        <SyncConfigSection
          syncConfig={syncConfig}
          customSyncInterval={customSyncInterval}
          setCustomSyncInterval={setCustomSyncInterval}
          showAdvancedSync={showAdvancedSync}
          setShowAdvancedSync={setShowAdvancedSync}
          onBackgroundSyncToggle={handleBackgroundSyncToggle}
          onWifiOnlyToggle={handleWifiOnlyToggle}
          onDownloadImagesToggle={handleDownloadImagesToggle}
          onFullTextSyncToggle={handleFullTextSyncToggle}
          onSyncIntervalChange={handleSyncIntervalChange}
          onResetSyncSettings={handleResetSyncSettings}
        />

        <SyncStatsSection
          totalSyncs={stats.totalSyncs}
          successfulSyncs={stats.successfulSyncs}
          failedSyncs={stats.failedSyncs}
          lastSync={formatLastSync()}
          dataTransferred={formatDataTransfer()}
          articlesSynced={
            stats.itemsSynced.articlesCreated +
            stats.itemsSynced.articlesUpdated
          }
        />

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
});

export default SettingsScreen;
