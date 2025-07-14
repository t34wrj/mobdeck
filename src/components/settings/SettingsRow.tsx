import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from '../ui/Text';
import { theme } from '../ui/theme';

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
    style={styles.settingsRow}
    onPress={onPress}
    disabled={!onPress}
    activeOpacity={onPress ? 0.7 : 1}
    accessibilityRole={onPress ? 'button' : 'text'}
    accessibilityLabel={value ? `${label}: ${value}` : label}
    accessibilityHint={onPress ? 'Tap to modify this setting' : undefined}
    accessibilityState={{
      disabled: !onPress,
    }}
  >
    <View style={styles.settingsRowContent}>
      <Text variant='body1' style={styles.settingsLabel}>
        {label}
      </Text>
      {value && (
        <Text variant='body2' style={styles.settingsValue}>
          {value}
        </Text>
      )}
    </View>
    {children && <View style={styles.settingsControl}>{children}</View>}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.neutral[200],
    minHeight: Math.max(56, theme.accessibility.minTouchTarget.height),
  },
  settingsRowContent: {
    flex: 1,
    marginRight: theme.spacing[3],
  },
  settingsLabel: {
    color: theme.colors.neutral[900],
    marginBottom: theme.spacing[1],
  },
  settingsValue: {
    color: theme.colors.neutral[600],
  },
  settingsControl: {
    flexShrink: 0,
  },
});