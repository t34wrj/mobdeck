import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { Button } from '../../components/ui/Button';
import { Text } from '../../components/ui/Text';
import { theme } from '../../components/ui/theme';
import { AuthScreenProps } from '../../navigation/types';
import { authStorageService } from '../../services/AuthStorageService';

interface SetupStep {
  id: number;
  title: string;
  description: string;
  action?: () => void;
}

const SetupScreen: React.FC<AuthScreenProps<'Setup'>> = ({ navigation }) => {
  const [testUrl, setTestUrl] = useState('');
  const [testToken, setTestToken] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const openReadeckDocs = useCallback(() => {
    Linking.openURL('https://readeck.org/en/docs/api/').catch(() => {
      Alert.alert('Error', 'Could not open Readeck documentation');
    });
  }, []);

  const testConnection = useCallback(async () => {
    if (!testUrl.trim() || !testToken.trim()) {
      Alert.alert('Missing Information', 'Please enter both URL and token to test');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      // Test the connection by making a simple API call
      const response = await fetch(`${testUrl.trim()}/api/bookmarks`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${testToken.trim()}`,
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        setTestResult({
          success: true,
          message: 'Connection successful! Your token is valid.',
        });
        
        // Store the validated token
        const stored = await authStorageService.storeToken(testToken);
        if (!stored) {
          Alert.alert('Warning', 'Connection test passed but failed to store token securely');
        }
      } else {
        const errorMessage = response.status === 401 
          ? 'Invalid token. Please check your Bearer token.'
          : `Connection failed with status: ${response.status}`;
        
        setTestResult({
          success: false,
          message: errorMessage,
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error 
          ? `Network error: ${error.message}`
          : 'Failed to connect. Check your URL and network connection.',
      });
    } finally {
      setIsTesting(false);
    }
  }, [testUrl, testToken]);

  const handleBackToLogin = useCallback(() => {
    if (testResult?.success && testUrl && testToken) {
      // Pass validated credentials back to login screen
      navigation.navigate('Login');
    } else {
      navigation.goBack();
    }
  }, [navigation, testResult, testUrl, testToken]);

  const setupSteps: SetupStep[] = [
    {
      id: 1,
      title: 'Access your Readeck settings',
      description: 'Log in to your Readeck web interface and navigate to Settings > API Tokens',
    },
    {
      id: 2,
      title: 'Create a new API token',
      description: 'Click "Create New Token", give it a descriptive name like "Mobdeck Mobile", and set the expiration as needed',
    },
    {
      id: 3,
      title: 'Copy the Bearer token',
      description: 'Copy the generated token immediately - it won\'t be shown again. The token will look like a long string of random characters',
    },
    {
      id: 4,
      title: 'Enter your server details',
      description: 'Use the form below to test your connection',
      action: openReadeckDocs,
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text variant="h3" style={styles.title}>
          Setup Bearer Token
        </Text>
        <Text variant="body2" color="neutral.600" align="center">
          Follow these steps to get your API token from Readeck
        </Text>
      </View>

      <View style={styles.stepsContainer}>
        {setupSteps.map((step) => (
          <View key={step.id} style={styles.step}>
            <View style={styles.stepHeader}>
              <View style={styles.stepNumber}>
                <Text variant="body2" color="neutral.50" weight="bold">
                  {step.id}
                </Text>
              </View>
              <Text variant="h6" style={styles.stepTitle}>
                {step.title}
              </Text>
            </View>
            <Text variant="body2" color="neutral.700" style={styles.stepDescription}>
              {step.description}
            </Text>
            {step.action && (
              <Button
                variant="ghost"
                size="sm"
                onPress={step.action}
                style={styles.stepAction}
              >
                View Documentation
              </Button>
            )}
          </View>
        ))}
      </View>

      <View style={styles.testContainer}>
        <Text variant="h5" style={styles.sectionTitle}>
          Test Your Connection
        </Text>
        
        <View style={styles.inputGroup}>
          <Text variant="body2" weight="medium" style={styles.label}>
            Server URL
          </Text>
          <TextInput
            style={styles.input}
            placeholder="https://readeck.example.com"
            placeholderTextColor={theme.colors.neutral[400]}
            value={testUrl}
            onChangeText={setTestUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            textContentType="URL"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text variant="body2" weight="medium" style={styles.label}>
            Bearer Token
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Paste your token here"
            placeholderTextColor={theme.colors.neutral[400]}
            value={testToken}
            onChangeText={setTestToken}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            multiline={Platform.OS === 'ios'} // Allow multiline on iOS for easier pasting
            numberOfLines={Platform.OS === 'ios' ? 2 : 1}
          />
        </View>

        {testResult && (
          <View style={[
            styles.testResult,
            testResult.success ? styles.testSuccess : styles.testError
          ]}>
            <Text 
              variant="body2" 
              color={testResult.success ? 'success.700' : 'error.700'}
              weight="medium"
            >
              {testResult.message}
            </Text>
          </View>
        )}

        <Button
          variant="primary"
          size="md"
          fullWidth
          onPress={testConnection}
          loading={isTesting}
          disabled={isTesting || !testUrl.trim() || !testToken.trim()}
          style={styles.testButton}
        >
          Test Connection
        </Button>
      </View>

      <View style={styles.footer}>
        <Button
          variant={testResult?.success ? 'primary' : 'outline'}
          size="lg"
          fullWidth
          onPress={handleBackToLogin}
          style={styles.backButton}
        >
          {testResult?.success ? 'Continue to Login' : 'Back to Login'}
        </Button>
        
        <Text variant="caption" color="neutral.500" align="center" style={styles.hint}>
          Your token is stored securely on your device
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.neutral[50],
  },
  scrollContent: {
    paddingHorizontal: theme.spacing[6],
    paddingVertical: theme.spacing[6],
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing[8],
  },
  title: {
    color: theme.colors.neutral[900],
    marginBottom: theme.spacing[2],
  },
  stepsContainer: {
    marginBottom: theme.spacing[8],
  },
  step: {
    marginBottom: theme.spacing[6],
    backgroundColor: theme.colors.neutral[50],
    borderRadius: theme.borderRadius.base,
    padding: theme.spacing[4],
    borderWidth: 1,
    borderColor: theme.colors.neutral[200],
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing[2],
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing[3],
  },
  stepTitle: {
    flex: 1,
    color: theme.colors.neutral[900],
  },
  stepDescription: {
    marginLeft: 40,
    lineHeight: 22,
  },
  stepAction: {
    marginLeft: 40,
    marginTop: theme.spacing[2],
    alignSelf: 'flex-start',
  },
  testContainer: {
    backgroundColor: theme.colors.neutral[100],
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing[6],
    marginBottom: theme.spacing[8],
  },
  sectionTitle: {
    color: theme.colors.neutral[900],
    marginBottom: theme.spacing[4],
  },
  inputGroup: {
    marginBottom: theme.spacing[4],
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
    minHeight: Platform.OS === 'ios' ? 60 : 48,
  },
  testButton: {
    marginTop: theme.spacing[2],
  },
  testResult: {
    borderRadius: theme.borderRadius.base,
    padding: theme.spacing[3],
    marginBottom: theme.spacing[4],
  },
  testSuccess: {
    backgroundColor: theme.colors.success[50],
    borderWidth: 1,
    borderColor: theme.colors.success[200],
  },
  testError: {
    backgroundColor: theme.colors.error[50],
    borderWidth: 1,
    borderColor: theme.colors.error[200],
  },
  footer: {
    marginTop: theme.spacing[4],
  },
  backButton: {
    marginBottom: theme.spacing[3],
  },
  hint: {
    marginTop: theme.spacing[2],
  },
});

export default SetupScreen;