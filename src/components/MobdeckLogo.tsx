import React from 'react';
import { View, StyleSheet, Image } from 'react-native';

interface MobdeckLogoProps {
  size?: number;
}

const MobdeckLogo: React.FC<MobdeckLogoProps> = ({
  size = 24,
}) => {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Image
        source={require('../../assets/icons/square/web/icon-192.png')}
        style={[
          styles.logo,
          {
            width: size,
            height: size,
          },
        ]}
        resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    borderRadius: 8,
  },
});

export default MobdeckLogo;
