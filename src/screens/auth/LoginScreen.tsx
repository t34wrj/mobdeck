import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Button } from '../../components/ui/Button';
import { Text } from '../../components/ui/Text';
import { theme } from '../../components/ui/theme';
import { AuthScreenProps } from '../../navigation/types';
import { AppDispatch, RootState } from '../../store';
import { clearError } from '../../store/slices/authSlice';
import { authStorageService } from '../../services/AuthStorageService';
import { validateApiToken } from '../../services/api';
import { readeckApiService } from '../../services/ReadeckApiService';

const LoginScreen: React.FC<AuthScreenProps<'Login'>> = ({ navigation }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { loading, error } = useSelector((state: RootState) => state.auth);

  const [serverUrl, setServerUrl] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [urlError, setUrlError] = useState('');
  const [tokenError, setTokenError] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    dispatch(clearError());
  }, [dispatch]);

  const validateUrl = (url: string): boolean => {
    if (!url.trim()) {
      setUrlError('Server URL is required');
      return false;
    }

    try {
      const urlObj = new URL(url);
      if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
        setUrlError('URL must start with http:// or https://');
        return false;
      }
      setUrlError('');
      return true;
    } catch {
      setUrlError('Please enter a valid URL');
      return false;
    }
  };

  const validateToken = (token: string): boolean => {
    if (!token.trim()) {
      setTokenError('API token is required');
      return false;
    }

    if (token.length < 10) {
      setTokenError('Token seems too short');
      return false;
    }

    setTokenError('');
    return true;
  };

  const handleLogin = useCallback(async () => {
    const isUrlValid = validateUrl(serverUrl);
    const isTokenValid = validateToken(apiToken);

    if (!isUrlValid || !isTokenValid) {
      return;
    }

    console.log('[LoginScreen] Starting login process...');
    console.log('[LoginScreen] Server URL:', serverUrl);
    console.log('[LoginScreen] Token length:', apiToken.length);

    setIsValidating(true);

    try {
      // Validate the API token against the Readeck server
      const validationResult = await validateApiToken(serverUrl.trim(), apiToken);
      
      if (!validationResult.isValid) {
        console.error('[LoginScreen] Validation failed - result not valid');
        Alert.alert('Login Failed', 'Invalid credentials. Please check your server URL and API token.');
        return;
      }

      console.log('[LoginScreen] Validation successful, storing token...');
      
      // Create user object for storage
      const userForStorage = {
        ...validationResult.user,
        serverUrl: serverUrl.trim().replace(/\/$/, ''),
      };
      
      // Store the token securely after successful validation
      const tokenStored = await authStorageService.storeToken(apiToken, userForStorage);
      if (!tokenStored) {
        console.error('[LoginScreen] Failed to store token');
        Alert.alert('Storage Error', 'Failed to store token securely');
        return;
      }

      console.log('[LoginScreen] Token stored, configuring API service...');
      
      // Configure the ReadeckApiService with the server URL
      // Ensure the URL includes the /api path
      const cleanUrl = serverUrl.trim().replace(/\/$/, '');
      const apiUrl = cleanUrl.includes('/api') ? cleanUrl : `${cleanUrl}/api`;
      
      readeckApiService.updateConfig({
        baseUrl: apiUrl,
      });
      
      // Dispatch success action with validated user data
      dispatch({
        type: 'auth/setUser',
        payload: validationResult.user,
      });
      
      console.log('[LoginScreen] Login successful!');
    } catch (err) {
      console.error('[LoginScreen] Login error:', err);
      Alert.alert(
        'Login Failed',
        err instanceof Error
          ? err.message
          : 'Failed to authenticate with the server'
      );
    } finally {
      setIsValidating(false);
    }
  }, [serverUrl, apiToken, dispatch]);

  const handleSetupPress = useCallback(() => {
    navigation.navigate('Setup');
  }, [navigation]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps='handled'
      >
        <View style={styles.headerContainer}>
          <Text variant='h1' align='center' style={styles.title}>
            Mobdeck
          </Text>
          <Text variant='body1' align='center' color='neutral.600'>
            Connect to your Readeck server
          </Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text variant='body2' weight='medium' style={styles.label}>
              Server URL
            </Text>
            <TextInput
              style={[styles.input, urlError ? styles.inputError : null]}
              placeholder='https://readeck.example.com'
              placeholderTextColor={theme.colors.neutral[400]}
              value={serverUrl}
              onChangeText={(text: string) => {
                setServerUrl(text);
                if (urlError) validateUrl(text);
              }}
              onBlur={() => validateUrl(serverUrl)}
              autoCapitalize='none'
              autoCorrect={false}
              keyboardType='url'
              textContentType='URL'
              accessibilityLabel='Server URL input'
              accessibilityHint='Enter your Readeck server URL'
            />
            {urlError ? (
              <Text
                variant='caption'
                color='error.500'
                style={styles.errorText}
              >
                {urlError}
              </Text>
            ) : null}
          </View>

          <View style={styles.inputGroup}>
            <Text variant='body2' weight='medium' style={styles.label}>
              API Token
            </Text>
            <TextInput
              style={[styles.input, tokenError ? styles.inputError : null]}
              placeholder='Enter your API token'
              placeholderTextColor={theme.colors.neutral[400]}
              value={apiToken}
              onChangeText={(text: string) => {
                setApiToken(text);
                if (tokenError) validateToken(text);
              }}
              onBlur={() => validateToken(apiToken)}
              secureTextEntry
              autoCapitalize='none'
              autoCorrect={false}
              textContentType='password'
              accessibilityLabel='API token input'
              accessibilityHint='Enter your Readeck API token'
            />
            {tokenError ? (
              <Text
                variant='caption'
                color='error.500'
                style={styles.errorText}
              >
                {tokenError}
              </Text>
            ) : null}
          </View>

          {error ? (
            <View style={styles.errorContainer}>
              <Text variant='body2' color='error.600' align='center'>
                {error}
              </Text>
            </View>
          ) : null}

          <Button
            variant='primary'
            size='lg'
            fullWidth
            onPress={handleLogin}
            loading={loading || isValidating}
            disabled={loading || isValidating}
            style={styles.loginButton}
            accessibilityLabel='Login button'
            accessibilityHint='Tap to connect to your Readeck server'
          >
            Connect to Server
          </Button>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text
              variant='caption'
              color='neutral.500'
              style={styles.dividerText}
            >
              OR
            </Text>
            <View style={styles.dividerLine} />
          </View>

          <Button
            variant='outline'
            size='md'
            fullWidth
            onPress={handleSetupPress}
            disabled={loading || isValidating}
            accessibilityLabel='Setup button'
            accessibilityHint='Tap to get help setting up your API token'
          >
            Need help? Setup Guide
          </Button>
        </View>

        {loading || isValidating ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size='large' color={theme.colors.primary[500]} />
            <Text
              variant='body2'
              color='neutral.600'
              style={styles.loadingText}
            >
              Validating connection...
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.neutral[50],
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing[6],
    paddingVertical: theme.spacing[8],
  },
  headerContainer: {
    marginTop: theme.spacing[8],
    marginBottom: theme.spacing[10],
    alignItems: 'center',
  },
  title: {
    color: theme.colors.primary[500],
    marginBottom: theme.spacing[2],
  },
  formContainer: {
    flex: 1,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  inputGroup: {
    marginBottom: theme.spacing[6],
  },
  label: {
    marginBottom: theme.spacing[2],
    color: theme.colors.neutral[700],
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.neutral[300],
    borderRadius: theme.borderRadius.base,
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.neutral[900],
    backgroundColor: theme.colors.neutral[50],
  },
  inputError: {
    borderColor: theme.colors.error[500],
  },
  errorText: {
    marginTop: theme.spacing[1],
  },
  errorContainer: {
    backgroundColor: theme.colors.error[50],
    borderRadius: theme.borderRadius.base,
    padding: theme.spacing[3],
    marginBottom: theme.spacing[4],
  },
  loginButton: {
    marginTop: theme.spacing[2],
    marginBottom: theme.spacing[6],
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: theme.spacing[6],
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.neutral[300],
  },
  dividerText: {
    marginHorizontal: theme.spacing[3],
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.spacing[3],
  },
});

export default LoginScreen;
