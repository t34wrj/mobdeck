import React, { Component, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from './theme';
import { reportCrash, setCurrentComponent } from '../utils/crashReporting';
import { trackUIError } from '../services/errorTracking';
import { stabilityIntegrationService } from '../services/StabilityIntegrationService';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: any) => void;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Update state with error info
    this.setState({ errorInfo });
    
    // Set current component for crash reporting
    if (this.props.componentName) {
      setCurrentComponent(this.props.componentName);
    }
    
    // Report crash with detailed context
    const crashContext = {
      componentName: this.props.componentName || 'Unknown Component',
      errorInfo,
      componentStack: errorInfo?.componentStack,
      errorBoundary: true,
    };
    
    reportCrash(error, crashContext);
    
    // Track as UI error
    trackUIError(error, crashContext);
    
    // Trigger stability check after UI error
    stabilityIntegrationService.triggerStabilityCheck().catch((stabilityError) => {
      console.warn('Failed to trigger stability check after UI error:', stabilityError);
    });
    
    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            The app encountered an unexpected error. The error has been reported automatically.
          </Text>
          
          {__DEV__ && this.state.error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorDetails}>
                Error: {this.state.error.message}
              </Text>
              {this.props.componentName && (
                <Text style={styles.componentName}>
                  Component: {this.props.componentName}
                </Text>
              )}
              {this.state.errorInfo?.componentStack && (
                <Text style={styles.stackTrace}>
                  Stack: {this.state.errorInfo.componentStack.slice(0, 200)}...
                </Text>
              )}
            </View>
          )}
          
          <TouchableOpacity style={styles.retryButton} onPress={this.handleRetry}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing[4],
    backgroundColor: theme.colors.neutral[50],
  },
  title: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: 'bold',
    color: theme.colors.neutral[900],
    marginBottom: theme.spacing[2],
    textAlign: 'center',
  },
  message: {
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.neutral[700],
    textAlign: 'center',
    marginBottom: theme.spacing[4],
    lineHeight: 20,
  },
  errorContainer: {
    backgroundColor: theme.colors.error[50],
    padding: theme.spacing[3],
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing[4],
    width: '100%',
  },
  errorDetails: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.error[600],
    marginBottom: theme.spacing[2],
    fontWeight: '600',
  },
  componentName: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.error[500],
    marginBottom: theme.spacing[1],
    fontWeight: '500',
  },
  stackTrace: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.error[400],
    fontFamily: 'monospace',
    lineHeight: 14,
  },
  retryButton: {
    backgroundColor: theme.colors.primary[500],
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[2],
    borderRadius: theme.borderRadius.md,
  },
  retryButtonText: {
    color: theme.colors.neutral[50],
    fontSize: theme.typography.fontSize.md,
    fontWeight: '600',
  },
});