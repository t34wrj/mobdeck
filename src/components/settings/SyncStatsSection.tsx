import React from 'react';
import { SettingsSection } from './SettingsSection';
import { SettingsRow } from './SettingsRow';

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
  <SettingsSection title='Sync Statistics'>
    <SettingsRow label='Total Syncs' value={totalSyncs.toString()} />
    <SettingsRow label='Successful Syncs' value={successfulSyncs.toString()} />
    <SettingsRow label='Failed Syncs' value={failedSyncs.toString()} />
    <SettingsRow label='Last Sync' value={lastSync} />
    <SettingsRow label='Data Transferred' value={dataTransferred} />
    <SettingsRow label='Articles Synced' value={`${articlesSynced} total`} />
  </SettingsSection>
);