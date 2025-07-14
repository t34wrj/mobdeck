import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '../ui/Text';
import { Button } from '../ui/Button';
import { theme } from '../ui/theme';
import { SettingsSection } from './SettingsSection';
import { SettingsRow } from './SettingsRow';

interface AccountSectionProps {
  serverUrl: string;
  username: string;
  lastLoginAt: string;
  onLogout: () => void;
  authLoading: boolean;
}

export const AccountSection: React.FC<AccountSectionProps> = ({
  serverUrl,
  username,
  lastLoginAt,
  onLogout,
  authLoading,
}) => (
  <SettingsSection title='Account'>
    <SettingsRow label='Server URL' value={serverUrl} />
    <SettingsRow label='Username' value={username} />
    <SettingsRow label='Last Login' value={lastLoginAt} />
    <View style={styles.buttonContainer}>
      <Button
        variant='destructive'
        onPress={onLogout}
        loading={authLoading}
        fullWidth
      >
        <Text>Logout</Text>
      </Button>
    </View>
  </SettingsSection>
);

const styles = StyleSheet.create({
  buttonContainer: {
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
  },
});
