import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SimpleText as Text } from './SimpleText';
import { theme } from './theme';

interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  children,
}) => (
  <View style={styles.section}>
    <Text variant='h3' style={styles.sectionTitle}>
      {title}
    </Text>
    <View style={styles.sectionContent}>{children}</View>
  </View>
);

const styles = StyleSheet.create({
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
});
