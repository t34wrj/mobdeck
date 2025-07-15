import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { SimpleText } from './SimpleText';

interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({ title, children }) => (
  <View style={styles.section}>
    <SimpleText variant="h3" style={styles.sectionTitle}>
      {title}
    </SimpleText>
    <View style={styles.sectionContent}>{children}</View>
  </View>
);

interface SettingsRowProps {
  label: string;
  value?: string;
  children?: React.ReactNode;
  onPress?: () => void;
}

export const SettingsRow: React.FC<SettingsRowProps> = ({
  label,
  value,
  children,
  onPress,
}) => (
  <TouchableOpacity
    style={styles.row}
    onPress={onPress}
    disabled={!onPress}
    activeOpacity={onPress ? 0.7 : 1}
  >
    <View style={styles.rowContent}>
      <SimpleText variant="body" style={styles.label}>
        {label}
      </SimpleText>
      {value && (
        <SimpleText variant="caption" style={styles.value}>
          {value}
        </SimpleText>
      )}
    </View>
    {children && <View style={styles.control}>{children}</View>}
  </TouchableOpacity>
);

// Consolidated stats section
interface SyncStatsSectionProps {
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  lastSync: string;
  dataTransferred: string;
  articlesSynced: number;
}

export const SyncStatsSection: React.FC<SyncStatsSectionProps> = ({
  totalSyncs,
  successfulSyncs,
  failedSyncs,
  lastSync,
  dataTransferred,
  articlesSynced,
}) => (
  <SettingsSection title="Sync Statistics">
    <SettingsRow label="Total Syncs" value={totalSyncs.toString()} />
    <SettingsRow label="Successful Syncs" value={successfulSyncs.toString()} />
    <SettingsRow label="Failed Syncs" value={failedSyncs.toString()} />
    <SettingsRow label="Last Sync" value={lastSync} />
    <SettingsRow label="Data Transferred" value={dataTransferred} />
    <SettingsRow label="Articles Synced" value={`${articlesSynced} total`} />
  </SettingsSection>
);

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 16,
    paddingHorizontal: 16,
    color: '#1f2937',
  },
  sectionContent: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e7eb',
    minHeight: 56,
  },
  rowContent: {
    flex: 1,
    marginRight: 12,
  },
  label: {
    color: '#1f2937',
    marginBottom: 4,
  },
  value: {
    color: '#6b7280',
  },
  control: {
    flexShrink: 0,
  },
});