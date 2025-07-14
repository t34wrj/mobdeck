import React from 'react';
import { SettingsSection } from './SettingsSection';
import { SettingsRow } from './SettingsRow';

export const AppInfoSection: React.FC = () => (
  <SettingsSection title='About'>
    <SettingsRow label='App Version' value='0.1.0' />
    <SettingsRow label='Build' value={__DEV__ ? 'Development' : 'Release'} />
  </SettingsSection>
);
