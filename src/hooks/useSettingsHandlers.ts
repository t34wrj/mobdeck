import { useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Alert } from 'react-native';
import { RootState } from '../store';
import { updateSyncConfig, resetSyncConfig } from '../store/slices/syncSlice';
import { logoutUser } from '../store/slices/authSlice';

export const useSettingsHandlers = () => {
  const dispatch = useDispatch();
  const { config: syncConfig } = useSelector((state: RootState) => state.sync);
  
  const [customSyncInterval, setCustomSyncInterval] = useState(
    syncConfig.syncInterval.toString()
  );
  const [showAdvancedSync, setShowAdvancedSync] = useState(false);

  const handleBackgroundSyncToggle = useCallback(
    (value: boolean) => {
      dispatch(updateSyncConfig({ config: { backgroundSyncEnabled: value } }));
    },
    [dispatch]
  );

  const handleWifiOnlyToggle = useCallback(
    (value: boolean) => {
      dispatch(
        updateSyncConfig({
          config: { syncOnWifiOnly: value, syncOnCellular: !value },
        })
      );
    },
    [dispatch]
  );

  const handleDownloadImagesToggle = useCallback(
    (value: boolean) => {
      dispatch(updateSyncConfig({ config: { downloadImages: value } }));
    },
    [dispatch]
  );

  const handleFullTextSyncToggle = useCallback(
    (value: boolean) => {
      dispatch(updateSyncConfig({ config: { fullTextSync: value } }));
    },
    [dispatch]
  );

  const handleSyncIntervalChange = useCallback(() => {
    const interval = parseInt(customSyncInterval, 10);
    if (isNaN(interval) || interval < 1) {
      Alert.alert(
        'Invalid Interval',
        'Please enter a valid sync interval (minimum 1 minute)'
      );
      setCustomSyncInterval(syncConfig.syncInterval.toString());
      return;
    }

    if (interval > 1440) {
      Alert.alert(
        'Invalid Interval',
        'Sync interval cannot exceed 24 hours (1440 minutes)'
      );
      setCustomSyncInterval(syncConfig.syncInterval.toString());
      return;
    }

    dispatch(updateSyncConfig({ config: { syncInterval: interval } }));
  }, [customSyncInterval, dispatch, syncConfig.syncInterval]);

  const handleResetSyncSettings = useCallback(() => {
    Alert.alert(
      'Reset Sync Settings',
      'Are you sure you want to reset all sync settings to default values?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            dispatch(resetSyncConfig());
            setCustomSyncInterval('15');
          },
        },
      ]
    );
  }, [dispatch]);

  const handleLogout = useCallback(() => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout? You will need to enter your credentials again to access your articles.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => dispatch(logoutUser()),
        },
      ]
    );
  }, [dispatch]);

  return {
    customSyncInterval,
    setCustomSyncInterval,
    showAdvancedSync,
    setShowAdvancedSync,
    handleBackgroundSyncToggle,
    handleWifiOnlyToggle,
    handleDownloadImagesToggle,
    handleFullTextSyncToggle,
    handleSyncIntervalChange,
    handleResetSyncSettings,
    handleLogout,
  };
};