import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from './theme';

const packageJson = require('../../package.json');

export const AppInfoSection: React.FC = () => (
  <View style={styles.container}>
    <Text style={styles.title}>About</Text>
    <View style={styles.row}>
      <Text style={styles.label}>App Version</Text>
      <Text style={styles.value}>{packageJson.version}</Text>
    </View>
    <View style={styles.row}>
      <Text style={styles.label}>Build</Text>
      <Text style={styles.value}>{__DEV__ ? 'Development' : 'Release'}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.neutral[50],
    marginHorizontal: theme.spacing[4],
    marginBottom: theme.spacing[4],
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing[4],
  },
  title: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.primary[600],
    marginBottom: theme.spacing[3],
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing[2],
  },
  label: {
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.neutral[700],
  },
  value: {
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.neutral[500],
  },
});
