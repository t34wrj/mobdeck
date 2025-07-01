import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import {
  selectIsAuthenticated,
  selectAuthLoading,
} from '../store/selectors/authSelectors';
import { initializeAuth } from '../store/slices/authSlice';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import { View, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { useShareIntent } from '../hooks/useShareIntent';
import { ShareService } from '../services/ShareService';

const AppNavigator: React.FC = () => {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const authLoading = useSelector(selectAuthLoading);
  const { sharedData, clearSharedData } = useShareIntent();

  useEffect(() => {
    dispatch(initializeAuth());
  }, [dispatch]);

  // Handle shared data when user is authenticated
  useEffect(() => {
    if (isAuthenticated && sharedData) {
      const url = ShareService.extractUrl(sharedData.text);

      if (url) {
        Alert.alert(
          'Share Detected',
          `Would you like to add this URL to your articles?\n\n${url}`,
          [
            {
              text: 'Cancel',
              onPress: () => clearSharedData(),
              style: 'cancel',
            },
            {
              text: 'Add Article',
              onPress: () => {
                // TODO: Implement article creation from shared URL
                console.log('Adding article from URL:', url);
                clearSharedData();
              },
            },
          ]
        );
      } else {
        // Clear invalid share data
        clearSharedData();
      }
    }
  }, [isAuthenticated, sharedData, clearSharedData]);

  if (authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size='large' color='#2196F3' />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});

export default AppNavigator;
