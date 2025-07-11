import React from 'react';
import { View, StyleSheet, Switch, TextInput, TouchableOpacity } from 'react-native';
import { Text } from '../ui/Text';
import { Button } from '../ui/Button';
import { theme } from '../ui/theme';
import { SettingsSection } from './SettingsSection';
import { SettingsRow } from './SettingsRow';
import { SyncSettings } from '../SyncSettings';

interface SyncConfigSectionProps {
  syncConfig: any;
  customSyncInterval: string;
  setCustomSyncInterval: (value: string) => void;
  showAdvancedSync: boolean;
  setShowAdvancedSync: (value: boolean) => void;
  onBackgroundSyncToggle: (value: boolean) => void;
  onWifiOnlyToggle: (value: boolean) => void;
  onDownloadImagesToggle: (value: boolean) => void;
  onFullTextSyncToggle: (value: boolean) => void;
  onSyncIntervalChange: () => void;
  onResetSyncSettings: () => void;
}

export const SyncConfigSection: React.FC<SyncConfigSectionProps> = ({
  syncConfig,
  customSyncInterval,
  setCustomSyncInterval,
  showAdvancedSync,
  setShowAdvancedSync,
  onBackgroundSyncToggle,
  onWifiOnlyToggle,
  onDownloadImagesToggle,
  onFullTextSyncToggle,
  onSyncIntervalChange,
  onResetSyncSettings,
}) => (
  <SettingsSection title='Sync Settings'>
    <SyncSettings />

    <SettingsRow label='Background Sync'>
      <Switch
        value={syncConfig.backgroundSyncEnabled}
        onValueChange={onBackgroundSyncToggle}
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
        onValueChange={onWifiOnlyToggle}
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
        onValueChange={onDownloadImagesToggle}
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
        onValueChange={onFullTextSyncToggle}
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
          onBlur={onSyncIntervalChange}
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
            onPress={onResetSyncSettings}
            fullWidth
          >
            <Text>Reset to Defaults</Text>
          </Button>
        </View>
      </View>
    )}
  </SettingsSection>
);

const styles = StyleSheet.create({
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
  settingsLabel: {
    color: theme.colors.neutral[900],
    marginBottom: theme.spacing[1],
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
  buttonContainer: {
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
  },
});