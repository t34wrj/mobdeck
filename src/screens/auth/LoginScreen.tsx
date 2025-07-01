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
import { loginUser, clearError } from '../../store/slices/authSlice';
import { authStorageService } from '../../services/AuthStorageService';

const LoginScreen: React.FC<AuthScreenProps<'Login'>> = ({ navigation }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { loading, error } = useSelector((state: RootState) => state.auth);
  
  const [serverUrl, setServerUrl] = useState('');
  const [bearerToken, setBearerToken] = useState('');
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
      setTokenError('Bearer token is required');
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
    const isTokenValid = validateToken(bearerToken);
    
    if (!isUrlValid || !isTokenValid) {
      return;
    }

    setIsValidating(true);
    
    try {
      // Store the token securely first
      const tokenStored = await authStorageService.storeToken(bearerToken);
      if (!tokenStored) {
        Alert.alert('Storage Error', 'Failed to store token securely');
        return;
      }

      // For manual Bearer token auth, we simulate the login process
      // In a real implementation, this would validate against the Readeck API
      const mockUser = {
        id: 'manual-auth',
        username: 'Readeck User',
        email: 'user@readeck.local',
        serverUrl: serverUrl.trim(),
        lastLoginAt: new Date().toISOString(),
        tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      };

      // Dispatch success action manually since we're using Bearer tokens
      dispatch({
        type: 'auth/setUser',
        payload: mockUser,
      });

    } catch (err) {
      Alert.alert(
        'Login Failed',
        err instanceof Error ? err.message : 'Failed to authenticate with the server'
      );
    } finally {
      setIsValidating(false);
    }
  }, [serverUrl, bearerToken, dispatch]);

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
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerContainer}>
          <Text variant="h1" align="center" style={styles.title}>
            Mobdeck
          </Text>
          <Text variant="body1" align="center" color="neutral.600">
            Connect to your Readeck server
          </Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text variant="body2" weight="medium" style={styles.label}>
              Server URL
            </Text>
            <TextInput
              style={[styles.input, urlError ? styles.inputError : null]}
              placeholder="https://readeck.example.com"
              placeholderTextColor={theme.colors.neutral[400]}
              value={serverUrl}
              onChangeText={(text) => {
                setServerUrl(text);
                if (urlError) validateUrl(text);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              textContentType="URL"
              accessibilityLabel="Server URL input"
              accessibilityHint="Enter your Readeck server URL"
            />
            {urlError ? (
              <Text variant="caption" color="error.500" style={styles.errorText}>
                {urlError}
              </Text>
            ) : null}
          </View>

          <View style={styles.inputGroup}>
            <Text variant="body2" weight="medium" style={styles.label}>
              Bearer Token
            </Text>
            <TextInput
              style={[styles.input, tokenError ? styles.inputError : null]}
              placeholder="Enter your API token"
              placeholderTextColor={theme.colors.neutral[400]}
              value={bearerToken}
              onChangeText={(text) => {
                setBearerToken(text);
                if (tokenError) validateToken(text);
              }}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              accessibilityLabel="Bearer token input"
              accessibilityHint="Enter your Readeck API bearer token"
            />
            {tokenError ? (
              <Text variant="caption" color="error.500" style={styles.errorText}>
                {tokenError}
              </Text>
            ) : null}
          </View>

          {error ? (
            <View style={styles.errorContainer}>
              <Text variant="body2" color="error.600" align="center">
                {error}
              </Text>
            </View>
          ) : null}

          <Button
            variant="primary"
            size="lg"
            fullWidth
            onPress={handleLogin}
            loading={loading || isValidating}
            disabled={loading || isValidating}
            style={styles.loginButton}
            accessibilityLabel="Login button"
            accessibilityHint="Tap to connect to your Readeck server"
          >
            Connect to Server
          </Button>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text variant="caption" color="neutral.500" style={styles.dividerText}>
              OR
            </Text>
            <View style={styles.dividerLine} />
          </View>

          <Button
            variant="outline"
            size="md"
            fullWidth
            onPress={handleSetupPress}
            disabled={loading || isValidating}
            accessibilityLabel="Setup button"
            accessibilityHint="Tap to get help setting up your Bearer token"
          >
            Need help? Setup Guide
          </Button>
        </View>

        {loading || isValidating ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={theme.colors.primary[500]} />
            <Text variant="body2" color="neutral.600" style={styles.loadingText}>
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