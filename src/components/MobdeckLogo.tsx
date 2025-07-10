import React from 'react';
import { View, StyleSheet, Image } from 'react-native';

interface MobdeckLogoProps {
  size?: number;
  color?: string;
}

const MobdeckLogo: React.FC<MobdeckLogoProps> = ({ 
  size = 24, 
  color: _color = '#f9bd4d' // This prop is now unused but kept for compatibility
}) => {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Image
        source={require('../../assets/icons/circle/android/res/mipmap-hdpi/ic_launcher.png')}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2, // Make it circular
        }}
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
});

export default MobdeckLogo;