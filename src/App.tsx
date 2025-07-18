import React from 'react';
import { Provider } from 'react-redux';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Dimensions,
  StatusBar,
  Text,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { store } from './store';
import AppNavigator from './navigation/AppNavigator';
import { useAppInitialization } from './hooks/useAppInitialization';
import { theme } from './components/theme';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initializeCrashReporting } from './utils/crashReporting';
import { initializeErrorTracking } from './services/errorTracking';

// Debug functions for testing through React Native debugger
if (__DEV__) {
  const debugInfo = {
    platform: Platform.OS,
    version: Platform.Version,
    dimensions: Dimensions.get('window'),
    isHermes: !!(global as any).HermesInternal,
  };

  console.log('React Native Debug Info:', debugInfo);

  // Global debug functions
  (global as any).testReactNative = () => {
    console.log('Testing React Native functionality...');
    console.log('Platform:', Platform.OS);
    console.log('Window dimensions:', Dimensions.get('window'));
    console.log('Screen dimensions:', Dimensions.get('screen'));
    console.log('Store state:', store.getState());
    return 'React Native test completed - check console';
  };

  (global as any).testRedux = () => {
    console.log('Testing Redux...');
    const state = store.getState();
    console.log('Current Redux state:', state);
    console.log('Auth state:', state.auth);
    console.log('Articles state:', state.articles);
    return state;
  };
}

const AppContent: React.FC = () => {
  const { isInitialized, isInitializing, error } = useAppInitialization();

  if (isInitializing) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size='large' color={theme.colors.primary[500]} />
        <Text style={styles.loadingText}>Initializing app...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Initialization Error</Text>
        <Text style={styles.errorMessage}>{error}</Text>
      </View>
    );
  }

  if (!isInitialized) {
    return null;
  }

  return (
    <ErrorBoundary componentName="AppContent">
      <AppNavigator />
    </ErrorBoundary>
  );
};

const App: React.FC = () => {
  // Initialize crash reporting and error tracking
  React.useEffect(() => {
    const initializeReporting = async () => {
      try {
        await initializeCrashReporting();
        await initializeErrorTracking();
      } catch (error) {
        console.error('Failed to initialize crash reporting:', error);
      }
    };

    initializeReporting();
  }, []);

  // Set status bar imperatively for Android following best practices
  React.useEffect(() => {
    if (Platform.OS === 'android') {
      // Clear any existing translucent flags
      StatusBar.setTranslucent(false);

      // Enable drawing system bar backgrounds
      StatusBar.setBackgroundColor(theme.colors.neutral[100], false);

      // Set bar style for proper icon contrast
      StatusBar.setBarStyle('dark-content', false);

      // Ensure status bar is visible
      StatusBar.setHidden(false, 'none');
    }
  }, []);

  return (
    <ErrorBoundary componentName="App">
      <SafeAreaProvider>
        <Provider store={store}>
          <ErrorBoundary componentName="AppProvider">
            <StatusBar
              backgroundColor={theme.colors.neutral[100]}
              barStyle='dark-content'
              translucent={false}
              animated={false}
              hidden={false}
            />
            <AppContent />
          </ErrorBoundary>
        </Provider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.neutral[50],
    padding: theme.spacing[4],
  },
  loadingText: {
    marginTop: theme.spacing[4],
    color: theme.colors.neutral[600],
  },
  errorText: {
    color: theme.colors.error[600],
    marginBottom: theme.spacing[2],
  },
  errorMessage: {
    color: theme.colors.error[500],
    textAlign: 'center',
  },
});

export default App;
