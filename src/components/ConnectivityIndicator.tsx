import React, { useEffect, useState, useMemo } from 'react';
import { Text, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { theme } from './theme';
import {
  connectivityManager,
  NetworkStatus,
} from '../utils/connectivityManager';
import { selectIsUserAuthenticated } from '../store/selectors/authSelectors';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export const ConnectivityIndicator: React.FC = () => {
  const [status, setStatus] = useState<NetworkStatus>(
    connectivityManager.getCurrentNetworkStatus()
  );
  const [visible, setVisible] = useState(false);
  const animatedValue = useMemo(() => new Animated.Value(0), []);
  const insets = useSafeAreaInsets();
  const isUserAuthenticated = useSelector(selectIsUserAuthenticated);

  useEffect(() => {
    const handleStatusChange = (newStatus: NetworkStatus) => {
      setStatus(newStatus);

      // Only show indicator when offline
      const shouldShow = !newStatus.isConnected;
      setVisible(shouldShow);

      // Animate in/out
      Animated.timing(animatedValue, {
        toValue: shouldShow ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    };

    // Set initial state
    handleStatusChange(connectivityManager.getCurrentNetworkStatus());

    // Listen for changes
    connectivityManager.addNetworkListener(handleStatusChange);

    return () => {
      connectivityManager.removeNetworkListener(handleStatusChange);
    };
  }, [animatedValue, isUserAuthenticated]);

  if (!visible && (animatedValue as any)._value === 0) {
    return null;
  }

  const getStatusConfig = () => {
    if (!status.isConnected) {
      return {
        icon: 'wifi-off',
        text: 'No Internet Connection',
        backgroundColor: theme.colors.error[500],
      };
    }
    return null;
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
          top: insets.top,
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
      <Icon
        name={config.icon}
        size={20}
        color={theme.colors.neutral[50]}
        style={styles.icon}
      />
      <Text style={[styles.text, { color: theme.colors.neutral[50] }]}>
        {config.text}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
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
