import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from "../../components/theme";
import { MainScreenProps } from '../../navigation/types';
import { useSettingsHandlers } from '../../hooks/useSettingsHandlers';
import { useSettingsData } from '../../hooks/useSettingsData';
import { AppInfoSection } from '../../components/AppInfoSection';

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
{/* TODO: Restore settings sections - temporarily removed for build fix */}

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
