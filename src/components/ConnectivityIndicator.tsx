import React, { useEffect, useState } from 'react';
import { Text, StyleSheet, Animated } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';
import { connectivityManager, ConnectivityStatus } from '../utils/connectivityManager';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export const ConnectivityIndicator: React.FC = () => {
  const theme = useAppTheme();
  const [status, setStatus] = useState<ConnectivityStatus>(connectivityManager.getStatus());
  const [visible, setVisible] = useState(false);
  const animatedValue = new Animated.Value(0);
  
  useEffect(() => {
    const handleStatusChange = (newStatus: ConnectivityStatus) => {
      setStatus(newStatus);
      
      // Show indicator when offline or server unreachable
      const shouldShow = newStatus !== ConnectivityStatus.ONLINE;
      setVisible(shouldShow);
      
      // Animate in/out
      Animated.timing(animatedValue, {
        toValue: shouldShow ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    };
    
    // Set initial state
    handleStatusChange(connectivityManager.getStatus());
    
    // Listen for changes
    connectivityManager.on('statusChanged', handleStatusChange);
    
    return () => {
      connectivityManager.off('statusChanged', handleStatusChange);
    };
  }, [animatedValue]);
  
  if (!visible && animatedValue._value === 0) {
    return null;
  }
  
  const getStatusConfig = () => {
    switch (status) {
      case ConnectivityStatus.OFFLINE:
        return {
          icon: 'wifi-off',
          text: 'No Internet Connection',
          backgroundColor: theme.colors.error,
        };
      case ConnectivityStatus.SERVER_UNREACHABLE:
        return {
          icon: 'server-network-off',
          text: 'Server Unreachable',
          backgroundColor: theme.colors.warning || theme.colors.error,
        };
      case ConnectivityStatus.CHECKING:
        return {
          icon: 'sync',
          text: 'Checking Connection...',
          backgroundColor: theme.colors.primary,
        };
      default:
        return null;
    }
  };
  
  const config = getStatusConfig();
  if (!config) return null;
  
  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: config.backgroundColor,
          opacity: animatedValue,
          transform: [
            {
              translateY: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [-50, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Icon name={config.icon} size={20} color={theme.colors.neutral[50]} style={styles.icon} />
      <Text style={[styles.text, { color: theme.colors.neutral[50] }]}>{config.text}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    zIndex: 1000,
  },
  icon: {
    marginRight: 8,
  },
  text: {
    fontSize: 14,
    fontWeight: '500',
  },
});