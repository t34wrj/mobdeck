import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { theme } from './theme';

interface MobdeckLogoProps {
  size?: number;
  color?: string;
}

const MobdeckLogo: React.FC<MobdeckLogoProps> = ({
  size = 24,
  color = theme.colors.secondary[500], // Use theme color instead of hardcoded value
}) => {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <View
        style={[
          styles.logo,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          },
        ]}
      >
        <Text
          style={[
            styles.logoText,
            {
              fontSize: size * 0.4,
              color: theme.colors.neutral[50],
            },
          ]}
        >
          M
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default MobdeckLogo;
